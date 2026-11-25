import { useState } from "react";
import api from "../../services/api";
import { initials } from "./monitoringUtils";

function avatarUrl(user) {
  const value = user?.avatarURL || user?.avatar_url;
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const base = new URL(api.defaults.baseURL || "/api", window.location.origin);
    const raw = value.trim();
    if (
      !/^https?:\/\//i.test(raw) &&
      (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\"))
    )
      return "";
    const url = new URL(raw, base.origin);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}

export default function MonitoringAvatar({ user, large = false }) {
  const [failed, setFailed] = useState("");
  const url = avatarUrl(user);
  return (
    <span className={`mon-avatar${large ? " mon-avatar-lg" : ""}`} aria-hidden="true">
      {url && failed !== url ? (
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(url)} />
      ) : (
        initials(user?.full_name || user?.username)
      )}
    </span>
  );
}
