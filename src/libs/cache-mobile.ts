import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import { mimetype } from "../utils/mimetype";
import _ from "underscore";
declare var window: any;

export const makeCacheBook = async (toc, sections) => {
  const load = async (index: number) => {
    let chapter = await fetchChapter(index);
    return URL.createObjectURL(new Blob([chapter], { type: "text/html" }));
  };
  const unload = (index: number) => {};
  const book: any = {};
  book.getCover = () => "";
  const loadAsset = async (url: string) => {
    if (url.endsWith(".css")) {
      return fetchStyle(url);
    } else {
      return fetchImage(url);
    }
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
const fetchChapter = (index: number) => {
  return new Promise<string>((resolve, reject) => {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ event: "fetch-chapter", ChapterDocIndex: index })
    );
    document.addEventListener("message", (event: any) => {
      let data = event.data;
      if (data && data.event === "fetch-chapter") {
        resolve(event.data.chapter);
      }
    });
  });
};
const fetchImage = (url: string) => {
  return new Promise<string>((resolve, reject) => {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ event: "fetch-image", url: url })
    );
    document.addEventListener("message", (event: any) => {
      let data = event.data;
      if (data && data.event === "fetch-image") {
        resolve(event.data.chapter);
      }
    });
  });
};
const fetchStyle = (url: string) => {
  return new Promise<string>((resolve, reject) => {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ event: "fetch-style", url: url })
    );
    document.addEventListener("message", (event: any) => {
      let data = event.data;
      if (data && data.event === "fetch-style") {
        resolve(
          URL.createObjectURL(
            new Blob([event.data.style], {
              type: mimetype[url.split(".").reverse()[0]],
            })
          )
        );
      }
    });
  });
};
