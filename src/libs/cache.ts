import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import { mimetype } from "../utils/mimetype";
import JSZip from "jszip";
import _ from "underscore";

export const makeCacheBook = async (bookBuffer: ArrayBuffer) => {
  let zip = await JSZip.loadAsync(bookBuffer);
  var tocZip = zip.file("toc.json");
  let toc = [];
  if (tocZip) {
    toc = JSON.parse(await tocZip.async("string"));
  }
  var sectionsZip = zip.file("sections.json");
  let sections = [];
  if (sectionsZip) {
    sections = JSON.parse(await sectionsZip.async("string"));
  }
  const load = async (index: number) => {
    var chapterZip = zip.file("chapters/" + index + ".html");
    let chapter = "";
    if (chapterZip) {
      chapter = await chapterZip.async("string");
    }
    return URL.createObjectURL(new Blob([chapter], { type: "text/html" }));
  };
  const unload = (index: number) => {};
  const book: any = {};
  book.getCover = () => "";
  const loadAsset = async (url: string) => {
    var assetZip = zip.file(url);
    let asset: any;
    if (assetZip) {
      asset = await assetZip.async("arraybuffer");
    }
    return URL.createObjectURL(
      new Blob([asset], { type: mimetype[url.split(".").reverse()[0]] })
    );
  };
  book.sections = sections.map((item: ChapterDoc, index: number) => ({
    id: item.href,
    load: () => load(index),
    unload: () => unload(index),
    loadAsset: (url) => loadAsset(url),
  }));
  book.toc = toc.map((item: Chapter) => ({
    label: item.label,
    href: item.href,
    subitems: item.subitems,
  }));
  book.rendition = { layout: "pre-paginated" };
  book.resolveHref = (href: string) => {
    return { index: _.findLastIndex(sections, { href }) };
  };
  book.splitTOCHref = (href) => [href, null];
  book.getTOCFragment = (doc) => doc.documentElement;
  return book;
};
