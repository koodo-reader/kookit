export const makeComicBook = (
  { entries, loadBlob, getSize },
  file,
  readerMode
) => {
  const cache = new Map();
  const urls = new Map();
  const load = async (name, nameExtra) => {
    if (cache.has(name)) return cache.get(name);
    if (nameExtra) {
      const src = URL.createObjectURL(await loadBlob(name));
      const srcExtra = URL.createObjectURL(await loadBlob(nameExtra));
      const page = URL.createObjectURL(
        new Blob(
          [
            `<div style="width:100%; height:100%"><img src="${src}"></div><div style="width:100%; height:100%"><img src="${srcExtra}"></div>`,
          ],
          { type: "text/html" }
        )
      );
      urls.set(name, [src, page]);
      cache.set(name, page);
      return page;
    } else {
      const src = URL.createObjectURL(await loadBlob(name));
      const page = URL.createObjectURL(
        new Blob(
          [`<div style="width:100%; height:100%"><img src="${src}"></div>`],
          { type: "text/html" }
        )
      );
      urls.set(name, [src, page]);
      cache.set(name, page);
      return page;
    }
  };
  const unload = (name) => {
    urls.get(name)?.forEach?.((url) => URL.revokeObjectURL(url));
    urls.delete(name);
    cache.delete(name);
  };

  const exts = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".svg",
    ".avif",
    ".apng",
    ".ico",
    ".cur",
    ".jfif",
    ".pjpeg",
    ".pjp",
  ];
  const files = entries
    .map((entry) => entry.filename)
    .filter((name) => exts.some((ext) => name.endsWith(ext)))
    .sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

  const book = {};
  book.getCover = () => loadBlob(files[0]);
  book.metadata = { title: file.name };
  book.sections = files
    .map((name, index) => ({
      id: name,
      load: () => {
        if (readerMode === "double") {
          const nameExtra = files[index + 1];
          return load(name, nameExtra);
        } else {
          return load(name);
        }
      },
      unload: () => unload(name),
      size: getSize(name),
    }))
    .filter((_, i) => {
      if (readerMode === "double") {
        return i % 2 === 0;
      } else {
        return true;
      }
    });
  book.toc = files
    .map((name) => ({ label: name, href: name }))
    .filter((_, i) => {
      if (readerMode === "double") {
        return i % 2 === 0;
      } else {
        return true;
      }
    });
  book.rendition = { layout: "pre-paginated" };
  book.resolveHref = (href) => ({
    index: book.sections.findIndex((s) => s.id === href),
  });
  book.resolveHrefIndex = (href) => ({
    index: book.sections.findIndex((s) => s.id === href),
  });
  book.splitTOCHref = (href) => [href, null];
  book.getTOCFragment = (doc) => doc.documentElement;
  return book;
};
