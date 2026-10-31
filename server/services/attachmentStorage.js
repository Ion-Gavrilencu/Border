const fs = require("node:fs/promises");
const path = require("node:path");

// In production, new files are stored in Vercel Blob.
const isLocalStorage = () => process.env.NODE_ENV !== "production";
const UPLOAD_ROOT = path.resolve(__dirname, "../uploads");
const LOCAL_PREFIX = "local:";

function resolveLocalPath(filePath) {
  if (typeof filePath !== "string" || !filePath.startsWith(LOCAL_PREFIX)) return null;
  const relative = filePath.slice(LOCAL_PREFIX.length);
  if (
    !/^attachments\/(telegrame|ordine|legislatie|informatii_utile|news)\/[1-9]\d*\/[^/]+$/.test(
      relative,
    )
  ) {
    return null;
  }
  const full = path.resolve(UPLOAD_ROOT, ...relative.split("/"));
  if (!full.startsWith(UPLOAD_ROOT + path.sep)) return null;
  return full;
}

async function saveLocalFile(relativePath, buffer) {
  const storedPath = `${LOCAL_PREFIX}${relativePath}`;
  const full = resolveLocalPath(storedPath);
  if (!full || !Buffer.isBuffer(buffer)) throw new Error("Cale sau conținut local invalid");
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer, { flag: "wx" });
  return storedPath;
}

async function removeLocalFile(storedPath) {
  const full = resolveLocalPath(storedPath);
  if (!full) throw new Error("Cale locală invalidă");
  await fs.unlink(full).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}

module.exports = { isLocalStorage, resolveLocalPath, saveLocalFile, removeLocalFile };
