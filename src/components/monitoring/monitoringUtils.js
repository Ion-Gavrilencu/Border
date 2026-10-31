export const dateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("ro-RO", { dateStyle: "short", timeStyle: "short" });
};
export const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
export const readDevice = (ua) => {
  if (!ua) return "Necunoscut";
  const os = /iPhone|iPad|iPod/i.test(ua)
    ? "iOS"
    : /Android/i.test(ua)
      ? "Android"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Macintosh|Mac OS X/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Alt sistem";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /Firefox\/|FxiOS\//i.test(ua)
      ? "Firefox"
      : /(?:Chrome|CriOS)\//i.test(ua)
        ? "Chrome"
        : /Safari\//i.test(ua)
          ? "Safari"
          : "Alt browser";
  return `${os} / ${browser}`;
};
export const actionNames = {
  login: "Autentificare",
  logout: "Deconectare",
  search: "Căutare",
  download: "Descărcare document",
  view: "Vizualizare document",
  page_view: "Accesare pagină",
};
