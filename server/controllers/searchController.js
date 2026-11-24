const pool = require("../config/database");
const { logMonitoringEvent } = require("../services/monitoringService");

const MAX_SEARCH_LENGTH = 120;
const TYPES = new Set(["telegrama", "ordin", "legislatie", "informatii"]);
const SEARCH_SQL = `
WITH documents AS (
  SELECT id, 'telegrama'::text AS type, title, content, created_at,
         number::text AS number, telegram_date AS document_date, NULL::text AS category FROM public.telegrame
  UNION ALL
  SELECT id, 'ordin', title, content, created_at, number::text, order_date, NULL::text FROM public.ordine
  UNION ALL
  SELECT id, 'legislatie', title, content, created_at, law_number::text, law_date, NULL::text FROM public.legislatie
  UNION ALL
  SELECT id, 'informatii', title, content, created_at, NULL::text, NULL::date, category::text FROM public.informatii_utile
), normalized AS (
  SELECT *, lower(unaccent(coalesce(title,''))) AS nt,
    lower(unaccent(coalesce(number,''))) AS nn,
    lower(unaccent(coalesce(content,''))) AS nc,
    lower(unaccent(coalesce(category,''))) AS ng,
    concat_ws(' ', to_char(document_date,'DD.MM.YYYY'), to_char(document_date,'YYYY-MM-DD')) AS nd
  FROM documents WHERE ($4::text IS NULL OR type = $4)
), fields AS (
  SELECT *, concat_ws(' ',nt,nn,ng,nd) AS metadata,
    substring(nn from '[0-9]+') AS primary_number,
    substring(nn from '[0-9]+[[:space:]]*/[[:space:]]*[0-9]+') AS full_number
  FROM normalized
), scored AS (
  SELECT *,
    coalesce($3::text <> '' AND (
      CASE WHEN strpos($3,'/') > 0 THEN
        replace(full_number,' ','') = $3 OR
        (full_number IS NULL AND primary_number || '/' || to_char(document_date,'YYYY') = $3)
      ELSE primary_number = $3 END),false) AS exact_number,
    NOT EXISTS (SELECT 1 FROM unnest($2::text[]) AS t(term)
      WHERE CASE WHEN term ~ '^[0-9]+$' THEN
        concat_ws(' ',metadata,nc) !~ ('(^|[^0-9])' || term || '([^0-9]|$)')
      ELSE strpos(concat_ws(' ',metadata,nc),term) = 0 END) AS all_terms,
    NOT EXISTS (SELECT 1 FROM unnest($2::text[]) AS t(term)
      WHERE CASE WHEN term ~ '^[0-9]+$' THEN
        metadata !~ ('(^|[^0-9])' || term || '([^0-9]|$)')
      ELSE strpos(metadata,term) = 0 END) AS metadata_terms,
    NOT EXISTS (SELECT 1 FROM unnest($2::text[]) AS t(term)
      WHERE CASE WHEN term ~ '^[0-9]+$' THEN
        metadata !~ ('(^|[^0-9])' || term || '([^0-9]|$)')
      WHEN strpos(metadata,term) > 0 THEN false
      WHEN term ~ '^[[:alpha:]]{5,}$' THEN word_similarity(term, concat_ws(' ',nt,ng)) < 0.5
      ELSE true END) AS fuzzy_terms
  FROM fields
), ranked AS (
  SELECT *, CASE
    WHEN exact_number THEN 1000
    WHEN NOT all_terms AND NOT fuzzy_terms THEN 0
    WHEN all_terms AND nt = $1 THEN 850
    WHEN all_terms AND strpos(nt,$1) > 0 THEN 700
    WHEN all_terms AND strpos(nn,$1) > 0 THEN 550
    WHEN metadata_terms THEN 450
    WHEN all_terms AND strpos(nc,$1) > 0 THEN 300
    WHEN all_terms THEN 200
    WHEN fuzzy_terms AND $3 = '' THEN 100
    ELSE 0 END AS relevance
  FROM scored
)
SELECT id,type,title,content,created_at,number,category,document_date,relevance,
  exact_number AS exact_match, (relevance = 100) AS approximate_match
FROM ranked WHERE relevance > 0
ORDER BY relevance DESC, created_at DESC NULLS LAST,type,id
LIMIT 50`;

const globalSearch = async (req, res) => {
  try {
    const { q, type } = req.query;
    const searchTerm = typeof q === "string" ? q.trim() : "";
    if (!searchTerm) return res.status(200).json({ results: [] });
    if (searchTerm.length > MAX_SEARCH_LENGTH)
      return res
        .status(400)
        .json({ message: `Căutarea nu poate depăși ${MAX_SEARCH_LENGTH} de caractere.` });
    const filter =
      type == null || type === "all" ? null : type === "informatie" ? "informatii" : type;
    if (filter !== null && !TYPES.has(filter))
      return res.status(400).json({ message: "Categoria căutării nu este validă." });
    const query = searchTerm
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!query) return res.status(200).json({ results: [] });
    const numeric =
      query
        .match(
          /^(?:(?:legea|lege|hg|hotararea|hotarare|ordinul|ordin|telegrama)\s+)?(?:nr\.?\s*)?(\d+(?:\s*\/\s*\d+)?)$/,
        )?.[1]
        ?.replace(/\s/g, "") || "";
    const terms = [...new Set((numeric ? numeric.split("/") : query.split(/\s+/)).filter(Boolean))];
    const result = await pool.query(SEARCH_SQL, [query, terms, numeric, filter]);
    try {
      await logMonitoringEvent({
        userId: req.user.id,
        action: "search",
        details: `Căutare globală: ${searchTerm} | Rezultate: ${result.rows.length}`,
        req,
      });
    } catch (error) {
      console.error("GLOBAL SEARCH MONITORING ERROR:", error);
    }
    return res.status(200).json({ results: result.rows });
  } catch (error) {
    console.error("GLOBAL SEARCH ERROR:", error);
    return res.status(500).json({ message: "Eroare la efectuarea căutării." });
  }
};
module.exports = { globalSearch };
