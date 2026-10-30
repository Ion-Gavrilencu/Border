
const axios = require("axios");
const cheerio = require("cheerio");
const pool = require("../config/database");

const SOURCE_URL = "https://border.gov.md/noutati";
const SOURCE_NAME = "Poliția de Frontieră";

const SOURCE_HOSTS = new Set([
  "border.gov.md",
  "www.border.gov.md",
]);

const cleanText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

function normalizeUrl(href) {
  if (!href || typeof href !== "string") return null;

  try {
    const url = new URL(href, SOURCE_URL);

    if (
      url.protocol !== "https:" ||
      !SOURCE_HOSTS.has(url.hostname) ||
      url.username ||
      url.password
    ) {
      return null;
    }

    url.hostname = "border.gov.md";
    url.hash = "";
    url.search = "";

    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return null;
  }
}

async function fetchBorderNews() {
  const response = await axios.get(SOURCE_URL, {
    timeout: 15000,
    maxContentLength: 2 * 1024 * 1024,
    maxRedirects: 3,
    headers: {
      "User-Agent": "BORDER-NewsSync/1.0",
      Accept: "text/html",
    },
  });

  if (typeof response.data !== "string") {
    throw new Error("Răspunsul sursei nu conține HTML.");
  }

  const $ = cheerio.load(response.data);
  const articles = [];
  const seen = new Set();

  $("a[href]").each((_, element) => {
    const anchor = $(element);
    const title = cleanText(anchor.text());
    const url = normalizeUrl(anchor.attr("href"));

    if (!url || title.length < 15 || title.length > 300) {
      return;
    }

    const pathname = new URL(url).pathname;

    if (
      ["/", "/noutati", "/news", "/contacte"].includes(pathname) ||
      seen.has(url)
    ) {
      return;
    }

    const container = anchor.closest(
      "article, .views-row, .node, .news-item"
    );

    if (!container.length) return;

    const imageElement = container.find("img").first();

    const imageUrl = normalizeUrl(
      imageElement.attr("data-src") ||
      imageElement.attr("src")
    );

    const summary = cleanText(
      container
        .find(
          ".field--name-body, .field--name-field-description, .summary, p"
        )
        .first()
        .text()
    ).slice(0, 300);

    seen.add(url);

    articles.push({
      title,
      type: "external",
      url,
      content: summary || null,
      category: "altele",
      source: SOURCE_NAME,
      image_url: imageUrl,
      images: [],
      external_source_id: url,
    });
  });

  if (articles.length === 0) {
    throw new Error(
      "Nu au fost identificate articole. Verifică structura HTML a sursei."
    );
  }

  return articles;
}

async function syncBorderNews() {
  const articles = await fetchBorderNews();
  const client = await pool.connect();

  let imported = 0;
  let skipped = 0;

  try {
    await client.query("BEGIN");

    // O singură sincronizare poate scrie în tabel la un moment dat.
    await client.query(
      "SELECT pg_advisory_xact_lock(4391, 2026)"
    );

    for (const article of articles) {
      const result = await client.query(
        `
        INSERT INTO public.news (
          title,
          type,
          url,
          content,
          category,
          source,
          image_url,
          images,
          created_by,
          external_source_id
        )
        SELECT
          $1,
          'external',
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::jsonb,
          NULL,
          $8
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.news
          WHERE
            external_source_id = $8
            OR (
              type = 'external'
              AND (
                url = $2
                OR regexp_replace(
                  regexp_replace(
                    url,
                    '^https?://(www\\.)?',
                    ''
                  ),
                  '/+$',
                  ''
                ) = regexp_replace(
                  regexp_replace(
                    $2,
                    '^https?://(www\\.)?',
                    ''
                  ),
                  '/+$',
                  ''
                )
              )
            )
        )
        ON CONFLICT (external_source_id)
        WHERE external_source_id IS NOT NULL
        DO NOTHING
        RETURNING id
        `,
        [
          article.title,
          article.url,
          article.content,
          article.category,
          article.source,
          article.image_url,
          JSON.stringify(article.images),
          article.external_source_id,
        ]
      );

      if (result.rowCount === 1) {
        imported++;
      } else {
        skipped++;
      }
    }

    await client.query("COMMIT");

    return {
      success: true,
      source: SOURCE_NAME,
      found: articles.length,
      imported,
      skipped,
      synchronizedAt: new Date().toISOString(),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("BORDER NEWS SYNC ERROR:", error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  fetchBorderNews,
  syncBorderNews,
};
