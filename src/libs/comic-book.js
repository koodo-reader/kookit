const getExt = (name) => {
  const idx = name.lastIndexOf(".");
  return idx > -1 ? name.slice(idx).toLowerCase() : "";
};

export const makeComicBook = ({ entries, loadBlob, getSize }, file) => {
  const cache = new Map();
  const urls = new Map();
  const load = async (name) => {
    if (cache.has(name)) return cache.get(name);
    const src = URL.createObjectURL(await loadBlob(name));
    const page = URL.createObjectURL(
      new Blob(
        [
          `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden;"><img src="${src}" style="max-width:100%; max-height:100%; object-fit:contain;"></div>`,
        ],
        { type: "text/html" }
      )
    );
    urls.set(name, [src, page]);
    cache.set(name, page);
    return page;
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
  // 每张图片始终是一个独立 section，double 模式的两页合并由渲染层的
  // CSS 双列布局完成，与 PdfRender 的分页模型保持一致
  book.sections = files.map((name, index) => ({
    id: name,
    load: () => load(name),
    unload: () => unload(name),
    size: getSize(name),
  }));
  book.toc = files.map((name, index) => ({
    label: name.split("/").pop() || name,
    href: name,
  }));
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
