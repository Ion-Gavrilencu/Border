import { ArrowRight, ArrowUpRight, ExternalLink, Pencil, Trash2 } from "lucide-react";
import "./NewsCard.css";

const categories = [
  { value: "documente", label: "Documente falsificate" },
  { value: "transport", label: "Control transport" },
  { value: "contrabanda", label: "Contrabandă" },
  { value: "migratie", label: "Migrație ilegală" },
  { value: "altele", label: "Alte noutăți" },
];

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ro-RO");
};

function NewsCard({ article, mainImage, ImageComponent, PrivateImageComponent, canEdit, canDelete, deletingId, onOpen, onEdit, onDelete }) {
  const category = categories.find((item) => item.value === article.category);
  const isInternal = article.type === "internal";
  const handleOpen = () => onOpen(article);

  return (
    <article
      className="border-news-article border-news-clickable"
      role="link"
      tabIndex={0}
      aria-label={`Deschide știrea: ${article.title}`}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("a, button")) return;
        handleOpen();
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          handleOpen();
        }
      }}
    >
      <div className="border-news-media">
        {mainImage ? (
          <div className="border-news-photo">
            <PrivateImageComponent attachment={mainImage} className="border-news-card-image" />
          </div>
        ) : (
          <ImageComponent src={article.image_url} title={article.title} />
        )}
        <span className={`border-news-media-category category-${article.category}`}>
          {category?.label || "Noutăți"}
        </span>
      </div>

      <div className="border-news-article-body">
        <div className="border-news-meta">
          <span className={`border-news-category category-${article.category}`}>
            {category?.label || "Noutăți"}
          </span>
          {article.source && <span className="border-news-source-name">{article.source}</span>}
          <time>{formatDate(article.created_at)}</time>
        </div>
        <h3>{article.title}</h3>
        {isInternal ? (
          <>
            <p className="border-news-excerpt">
              {article.content?.slice(0, 160)}
              {article.content?.length > 160 ? "..." : ""}
            </p>
            <span className="border-news-read">Citește știrea <ArrowRight size={15} /></span>
          </>
        ) : (
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="border-news-read">
            Citește articolul <ExternalLink size={15} />
          </a>
        )}
        {canEdit && (
          <div className="border-news-article-actions">
            <button type="button" onClick={() => onEdit(article)}><Pencil size={15} />Editează</button>
            {canDelete && (
              <button type="button" className="border-news-delete" disabled={deletingId === article.id} onClick={() => onDelete(article.id)}>
                <Trash2 size={15} />Șterge
              </button>
            )}
          </div>
        )}
      </div>
      {!isInternal ? (
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="border-news-open-icon" aria-label={`Deschide ${article.title}`}>
          <ArrowUpRight size={18} />
        </a>
      ) : (
        <ArrowUpRight size={18} className="border-news-open-icon" aria-hidden="true" />
      )}
    </article>
  );
}

export default NewsCard;
