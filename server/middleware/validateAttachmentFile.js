"use strict";

// Validate actual file signatures, not just the MIME type supplied by the browser.
// Works with multer.memoryStorage() on Vercel (no local filesystem required).
const signatures = {
  "image/jpeg": (b) => b.length >= 3 && b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  "image/png": (b) =>
    b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  "image/webp": (b) =>
    b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  "application/pdf": (b) => b.length >= 5 && b.toString("ascii", 0, 5) === "%PDF-",
  "application/msword": (b) =>
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (b) => {
    if (b.length < 30 || !b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])))
      return false;
    // OOXML .docx is a ZIP container. Entry names occur in its central directory.
    // This check rejects ordinary ZIPs renamed as .docx; it is not an antivirus scan.
    const tail = b.subarray(Math.max(0, b.length - 65557)).toString("latin1");
    return tail.includes("word/document.xml") && tail.includes("[Content_Types].xml");
  },
  "video/mp4": (b) => b.length >= 12 && b.toString("ascii", 4, 8) === "ftyp",
  "video/quicktime": (b) =>
    b.length >= 12 &&
    b.toString("ascii", 4, 8) === "ftyp" &&
    b.toString("ascii", 8, 12).startsWith("qt"),
  "video/webm": (b) =>
    b.length >= 4 && b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
};

const extensions = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
  "video/quicktime": [".mov"],
};

function validateAttachmentFile(req, res, next) {
  const file = req.file;
  if (!file) return res.status(400).json({ message: "Selectează un fișier." });
  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    return res.status(400).json({ message: "Fișierul este gol sau invalid." });
  }

  const check = signatures[file.mimetype];
  const name = String(file.originalname || "").toLowerCase();
  const expected = extensions[file.mimetype];
  if (!check || !expected || !expected.some((ext) => name.endsWith(ext)) || !check(file.buffer)) {
    return res.status(400).json({
      message: "Formatul real al fișierului nu corespunde tipului sau extensiei declarate.",
    });
  }
  return next();
}

module.exports = validateAttachmentFile;
