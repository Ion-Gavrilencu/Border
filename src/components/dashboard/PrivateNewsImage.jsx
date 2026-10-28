import { useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import api from "../../services/api";

function PrivateNewsImage({ attachment, className = "" }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!attachment?.id) return;

    let active = true;
    let objectUrl = "";

    setSrc("");
    setFailed(false);

    const loadImage = async () => {
      try {
        const response = await api.get(`/attachments/file/${attachment.id}`, {
          responseType: "blob",
        });

        if (!active) return;

        objectUrl = URL.createObjectURL(response.data);
        setSrc(objectUrl);
      } catch (error) {
        console.error("PRIVATE NEWS IMAGE ERROR:", error);

        if (active) {
          setFailed(true);
        }
      }
    };

    loadImage();

    return () => {
      active = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment?.id]);

  if (!attachment || !src || failed) {
    return (
      <div className={`border-news-photo border-news-placeholder ${className}`}>
        <ImageIcon size={27} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={attachment.original_name || attachment.name || "Fotografie atașată"}
      className={className}
      loading="lazy"
    />
  );
}

export default PrivateNewsImage;
