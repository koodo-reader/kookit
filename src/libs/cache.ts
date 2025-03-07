import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import GeneralParser from "../utils/generalParser";
import { mimetype, mimetypeReverse } from "../utils/mimetype";
import JSZip from "jszip";
import _ from "underscore";
import { getImageElement } from "../utils/layoutUtil";

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
export const getCache = (book: any) => {
  return new Promise<ArrayBuffer | string>(async (resolve, reject) => {
    let parser = new GeneralParser(book);
    let chapterList = await parser.getChapter(book.toc);
    let chapterDocList = await parser.getChapterDoc();
    let toc = chapterList;
    let sections = chapterDocList.map((item: ChapterDoc) => {
      return { href: item.href, label: item.label };
    });
    let chapterTexts = await Promise.all(
      chapterDocList.map(async (item) => {
        let chapterText = "";
        if (item.text.load) {
          let blob = await fetch(await item.text.load()).then((r) => r.blob());
          chapterText = await blob.text();
        }
        return chapterText;
      })
    );
    let zip = new JSZip();
    zip.file("toc.json", JSON.stringify(toc));
    zip.file("sections.json", JSON.stringify(sections));
    let chapters: any = [];
    //todo get css, fonts and images blob
    for (let index = 0; index < chapterTexts.length; index++) {
      let chapterDoc = new DOMParser().parseFromString(
        chapterTexts[index],
        "text/html"
      ) as any;

      let imgDomList = getImageElement(chapterDoc) as any;
      for (let subindex = 0; subindex < imgDomList.length; subindex++) {
        let subImgZip = zip.folder("imgs/" + index);
        if (!subImgZip) {
          break;
        }

        let imageUrl =
          imgDomList[subindex].getAttribute("src") ||
          imgDomList[subindex].getAttribute("xlink:href");
        if (imageUrl) {
          try {
            let blob = await fetch(await imageUrl).then((r) => r.blob());
            subImgZip.file(subindex + "." + mimetypeReverse[blob.type], blob);
            let newUrl =
              "imgs/" +
              index +
              "/" +
              subindex +
              "." +
              mimetypeReverse[blob.type];
            imgDomList[subindex].src = newUrl;
            if (imgDomList[subindex].getAttribute("xlink:href")) {
              imgDomList[subindex].setAttribute("xlink:href", newUrl);
            }
          } catch (error) {
            console.error(error);
          }
        }
      }
      let linkList = Array.from(chapterDoc.getElementsByTagName("link"));
      for (let subindex = 0; subindex < linkList.length; subindex++) {
        let link: any = linkList[subindex];
        let subCssZip = zip.folder("css/" + index);
        if (!subCssZip) {
          break;
        }
        if (link.getAttribute("href")) {
          try {
            let blob = await fetch(await link.getAttribute("href")).then((r) =>
              r.blob()
            );
            subCssZip.file(subindex + "." + mimetypeReverse[blob.type], blob);
            link.href =
              "css/" +
              index +
              "/" +
              subindex +
              "." +
              mimetypeReverse[blob.type];
          } catch (error) {
            console.error(error);
          }
        }
      }
      chapters.push(chapterDoc.documentElement.innerHTML);
    }
    let configZip = zip.folder("chapters");
    if (!configZip) {
      return;
    }
    for (let index = 0; index < chapters.length; index++) {
      configZip.file(index + ".html", chapters[index]);
    }
    zip
      .generateAsync({ type: "blob" })
      .then(async (blob: any) => {
        resolve(await new Response(blob).arrayBuffer());
      })
      .catch((err: any) => {
        resolve("err");
      });
  });
};
