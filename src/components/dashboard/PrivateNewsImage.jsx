import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import api from "../../services/api";

function PrivateNewsImage({ attachment, className = "" }) {
  const wrapperRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  const id = attachment?.id;

  useEffect(() => {
    setVisible(false);
    const node = wrapperRef.current;
    if (!node || !id) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "250px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [id]);

  useEffect(() => {
    setSrc("");
    setFailed(false);
    if (!id || !visible) return;
    let active = true;
    let objectUrl = "";
    const load = async () => {
      try {
        const response = await api.get(`/attachments/file/${id}`, { responseType: "blob" });
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setSrc(objectUrl);
      } catch (error) {
        if (active) {
          console.error("PRIVATE NEWS IMAGE ERROR:", error);
          setFailed(true);
        }
      }
    };
    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, visible]);

  return (
    <span ref={wrapperRef} style={{ display: "block", width: "100%", height: "100%" }}>
      {!attachment || !src || failed ? (
        <div className={`border-news-photo border-news-placeholder ${className}`}>
          <ImageIcon size={27} />
        </div>
      ) : (
        <img
          src={src}
          alt={attachment.original_name || attachment.name || "Fotografie atașată"}
          className={className}
          loading="lazy"
        />
      )}
    </span>
  );
}

export default PrivateNewsImage;
