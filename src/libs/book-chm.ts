import {
  ChmFile,
  ChmEnumerateFlags,
  parseSystemInfo,
  parseToc,
  decodeText,
} from "./chmlib";
import type { ChmTocEntry, ChmUnitInfo } from "./chmlib";
import { mimetype } from "../utils/mimetype";

const HTML_EXTS = ["html", "htm", "xhtml"];

const pathKey = (path: string) => path.toLowerCase().replace(/\\/g, "/");

const getExt = (path: string) => {
  const base = path.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > -1 ? base.slice(dot + 1).toLowerCase() : "";
};

const isHtmlPath = (path: string) => HTML_EXTS.indexOf(getExt(path)) > -1;

const isExternalHref = (href: string) =>
  /^(https?:|mailto:|tel:|ftp:|file:|ms-its:|mk:)/i.test((href || "").trim());

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getBaseDir = (path: string) => {
  const slash = path.lastIndexOf("/");
  return slash > -1 ? path.slice(0, slash + 1) : "/";
};

const resolveRelativePath = (baseDir: string, rel: string) => {
  const raw = (rel || "").replace(/\\/g, "/").trim();
  if (!raw) return "";
  let source = raw;
  const segments: string[] = [];
  if (raw.startsWith("/")) {
    source = raw.slice(1);
  } else {
    segments.push(
      ...baseDir.split("/").filter((item) => item).map((item) => safeDecode(item))
    );
  }
  for (const segment of source.split("/")) {
    const decoded = safeDecode(segment);
    if (!decoded || decoded === ".") continue;
    if (decoded === "..") {
      segments.pop();
      continue;
    }
    segments.push(decoded);
  }
  return "/" + segments.join("/");
};

const pathToLabel = (path: string) => {
  const base = path.split("/").pop() || path;
  const name = base.replace(/\.[^.]+$/, "");
  return safeDecode(name) || path;
};

const cleanHtml = (html: string) =>
  html.replace(/<meta[^>]+charset[^>]*>/gi, "");

const stripAnchor = (href: string) => (href || "").split("#")[0].split("?")[0];

export const makeChmBook = async (chm: ChmFile) => {
  const entryMap = new Map<string, ChmUnitInfo>();
  const htmlEntries: ChmUnitInfo[] = [];
  for await (const entry of chm.enumerate(
    ChmEnumerateFlags.Normal | ChmEnumerateFlags.Files
  )) {
    entryMap.set(pathKey(entry.path), entry);
    if (isHtmlPath(entry.path)) htmlEntries.push(entry);
  }

  const systemRaw = await chm.getSystemRaw();
  const systemInfo = systemRaw ? parseSystemInfo(systemRaw) : {};

  const findEntry = (path: string) => {
    const key = pathKey(path);
    return entryMap.get(key) || null;
  };

  const sectionIndexMap = new Map<string, number>();
  const tocLabelMap = new Map<string, string>();

  const CSS_REF_PATTERN = /url\(\s*(['"]?)([^'")]*)\1\s*\)|@import\s+(['"])([^'"]+)\3/gi;

  const rewriteCssRefs = async (cssText: string, baseDir: string, depth: number) => {
    const matches = [...cssText.matchAll(CSS_REF_PATTERN)];
    if (!matches.length) return cssText;
    const pieces: string[] = [];
    let last = 0;
    for (const match of matches) {
      const idx = match.index ?? 0;
      pieces.push(cssText.slice(last, idx));
      last = idx + match[0].length;
      let replaced = match[0];
      const raw = match[2] ?? match[4];
      if (
        raw &&
        !isExternalHref(raw) &&
        !/^(data:|#)/i.test(raw)
      ) {
        const target = resolveRelativePath(baseDir, stripAnchor(raw));
        if (target) {
          const blobUrl = await loadAssetFromEntry(findEntry(target), depth);
          if (blobUrl) {
            replaced = match[0].split(raw).join(blobUrl);
          }
        }
      }
      pieces.push(replaced);
    }
    pieces.push(cssText.slice(last));
    return pieces.join("");
  };

  const loadAssetFromEntry = async (
    entry: ChmUnitInfo | null,
    depth: number = 0
  ) => {
    if (!entry) return "";
    try {
      const ext = getExt(entry.path);
      if (ext === "css" && depth < 3) {
        const data = await chm.retrieve(entry);
        const text = await rewriteCssRefs(
          decodeText(data).text,
          getBaseDir(entry.path),
          depth + 1
        );
        return URL.createObjectURL(new Blob([text], { type: "text/css" }));
      }
      const data = await chm.retrieve(entry);
      return URL.createObjectURL(
        new Blob([data.slice()], {
          type: mimetype[ext] || "application/octet-stream",
        })
      );
    } catch (error) {
      console.error(error);
      return "";
    }
  };

  const sections = htmlEntries.map((entry, index) => {
    sectionIndexMap.set(pathKey(entry.path), index);
    const baseDir = getBaseDir(entry.path);
    let blobUrl = "";
    return {
      id: entry.path,
      href: entry.path,
      size: Number(entry.length),
      linear: "yes",
      load: async () => {
        if (!blobUrl) {
          const data = await chm.retrieve(entry);
          const text = cleanHtml(decodeText(data).text);
          blobUrl = URL.createObjectURL(
            new Blob([text], { type: "text/html" })
          );
        }
        return blobUrl;
      },
      unload: () => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
          blobUrl = "";
        }
      },
      loadAsset: async (url: string) => {
        const raw = (url || "").trim();
        if (!raw || isExternalHref(raw)) return "";
        const target = resolveRelativePath(baseDir, stripAnchor(raw));
        if (!target) return "";
        return loadAssetFromEntry(findEntry(target));
      },
    };
  });

  const resolveTocHref = (local: string, baseDir: string) => {
    const raw = (local || "").trim();
    if (!raw || isExternalHref(raw)) return "";
    const path = resolveRelativePath(baseDir, stripAnchor(raw));
    if (!isHtmlPath(path)) return "";
    if (!sectionIndexMap.has(pathKey(path))) return "";
    const anchor = (raw || "").indexOf("#") > -1 ? raw.split("#").slice(1).join("#") : "";
    return anchor ? `${path}#${anchor}` : path;
  };

  const mapTocEntries = (entries: ChmTocEntry[], baseDir: string): any[] => {
    const result: any[] = [];
    for (const entry of entries) {
      const subitems = mapTocEntries(entry.children, baseDir);
      const href = entry.local ? resolveTocHref(entry.local, baseDir) : "";
      if (!href) {
        result.push(...subitems);
        continue;
      }
      const label = entry.name || pathToLabel(href);
      tocLabelMap.set(pathKey(stripAnchor(href)), label);
      result.push({ label, href, subitems });
    }
    return result;
  };

  let toc: any[] = [];
  const tocFile = (systemInfo.tocFile || "").trim();
  if (tocFile && !isExternalHref(tocFile)) {
    const tocEntry = findEntry(resolveRelativePath("/", stripAnchor(tocFile)));
    if (tocEntry) {
      try {
        const tocData = await chm.retrieve(tocEntry);
        const mapped = mapTocEntries(
          parseToc(decodeText(tocData).text).entries,
          getBaseDir(tocEntry.path)
        );
        if (mapped.length) toc = mapped;
      } catch (error) {
        console.error(error);
      }
    }
  }
  if (!toc.length) {
    const hhcEntries = [...entryMap.values()]
      .filter((entry) => /\.hhc$/i.test(entry.path))
      .sort(
        (a, b) =>
          a.path.split("/").length - b.path.split("/").length ||
          a.path.length - b.path.length
      );
    for (const candidate of hhcEntries) {
      try {
        const tocData = await chm.retrieve(candidate);
        const mapped = mapTocEntries(
          parseToc(decodeText(tocData).text).entries,
          getBaseDir(candidate.path)
        );
        if (mapped.length) {
          toc = mapped;
          break;
        }
      } catch (error) {
        console.error(error);
      }
    }
  }
  if (!toc.length) {
    toc = htmlEntries.map((entry) => ({
      label: pathToLabel(entry.path),
      href: entry.path,
      subitems: [],
    }));
  }

  const findSectionIndex = (href: string) => {
    if (!href) return -1;
    const key = pathKey(resolveRelativePath("/", stripAnchor(href)));
    if (sectionIndexMap.has(key)) return sectionIndexMap.get(key)!;
    if (key.length > 3) {
      for (const [candidate, index] of sectionIndexMap) {
        if (candidate.endsWith(key)) return index;
      }
    }
    return -1;
  };

  const book: any = {};
  book.metadata = {
    title: systemInfo.title || "",
    author: "",
    description: "",
    publisher: "",
  };
  book.getCover = () => "";
  book.sections = sections;
  book.toc = toc;
  book.rendition = { layout: "pre-paginated" };
  book.resolveHref = (href: string) => {
    const index = findSectionIndex(href);
    if (index === -1) return null;
    const path = stripAnchor(href);
    const anchor = (href || "").indexOf("#") > -1
      ? href.split("#").slice(1).join("#")
      : "";
    return {
      index,
      href,
      label: tocLabelMap.get(pathKey(path)) || pathToLabel(path),
      anchor: anchor
        ? (doc: Document) =>
            doc.getElementById(anchor) ||
            doc.querySelector(`[name="${CSS.escape(anchor)}"]`)
        : () => 0,
    };
  };
  book.resolveHrefIndex = (href: string) => {
    const index = findSectionIndex(href);
    return index === -1 ? null : { index };
  };
  book.splitTOCHref = (href: string) => (href ? href.split("#") : []);
  book.getTOCFragment = (doc: Document, id: string) =>
    id ? doc.getElementById(id) : doc.documentElement;
  return book;
};
