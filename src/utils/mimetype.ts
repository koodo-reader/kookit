export const mimetype = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  zip: "application/zip",
  rar: "application/x-rar-compressed",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  html: "text/html",
  htm: "text/html",
  xml: "text/xml",
  xhtml: "application/xhtml+xml",
  css: "text/css",
};
export const mimetypeReverse = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/zip": "zip",
  "application/x-rar-compressed": "rar",
  "application/x-7z-compressed": "7z",
  "application/x-tar": "tar",
  "text/html": "html",
  "text/xml": "xml",
  "application/xhtml+xml": "xhtml",
  "text/css": "css",
};
export const removeExtraQuestionMark = (html: any) => {
  return html
    .replaceAll("–?", "–")
    .replaceAll("“?", "“")
    .replaceAll("”?", "”")
    .replaceAll("©?", "©")
    .replaceAll("’?", "’")
    .replaceAll("“?", "“")
    .replaceAll("…?", "…")
    .replaceAll("—?", "—")
    .replaceAll("‘?", "‘")
    .replaceAll("“?", "“");
};
