import Chapter from "./model/chapter";
import ChapterDoc from "./model/chapterDoc";
import {
  convertStyleNum,
  getImageElement,
  progressInfo,
} from "./utils/layoutUtil";
import StorageUtil from "./utils/storageUtil";
import {
  getCloestBlock,
  getSearchResult,
  getVisibleText,
  getAudioText,
  handleNextChapter,
  handlePrevChapter,
  handleRecord,
  handleRenderChatper,
  handleScrollPage,
  handleScrollPosition,
  handleHighlightNode,
} from "./utils/navigationUtil";
import EventEmitter from "./utils/EventEmitter";
import GeneralParser from "./utils/generalParser";
import { mimetypeReverse } from "./utils/mimetype";
declare var window: any;

class GeneralRender extends EventEmitter {
  mode: string;
  format: string;
  book: any;
  chapterList: Chapter[];
  flattenChapters: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(mode: string, format: string) {
    super();
    this.mode = mode;
    this.format = format;
    this.chapterList = [];
    this.chapterDocList = [];
    this.flattenChapters = [];
    this.book = "";
    this.element = "";
  }
  getPageSize() {
    return {
      width: this.element.clientWidth,
      height: this.element.clientHeight,
    };
  }
  getCache(book: any) {
    return new Promise<ArrayBuffer | string>(async (resolve, reject) => {
      let parser = new GeneralParser(book);
      this.chapterList = await parser.getChapter(book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      let toc = this.chapterList;
      let sections = this.chapterDocList.map((item) => {
        return { href: item.href, title: item.title };
      });
      let chapterTexts = await Promise.all(
        this.chapterDocList.map(async (item) => {
          let chapterText = "";
          if (item.text.load) {
            let blob = await fetch(await item.text.load()).then((r) =>
              r.blob()
            );
            chapterText = await blob.text();
          }
          return chapterText;
        })
      );
      let zip = new window.JSZip();
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
          let blob = await fetch(await imgDomList[subindex].src).then((r) =>
            r.blob()
          );
          subImgZip.file(subindex + "." + mimetypeReverse[blob.type], blob);
          imgDomList[subindex].src =
            "imgs/" + index + "/" + subindex + "." + mimetypeReverse[blob.type];
        }
        let linkList = Array.from(chapterDoc.getElementsByTagName("link"));
        linkList.forEach(async (link: any, subindex: number) => {
          let subCssZip = zip.folder("css/" + index);
          let blob = await fetch(await link.href).then((r) => r.blob());
          subCssZip.file(subindex + "." + mimetypeReverse[blob.type], blob);
          link.href =
            "css/" + index + "/" + subindex + "." + mimetypeReverse[blob.type];
        });
        chapters.push(chapterDoc.documentElement.innerHTML);
      }
      let configZip = zip.folder("chapters");
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
  }
  resolveChapter(href: string) {
    let path = href;

    let chapterIndex = -1;
    for (let index = 0; index < this.flattenChapters.length; index++) {
      if (this.flattenChapters[index].href.includes(path)) {
        chapterIndex = index;
        break;
      }
    }

    if (chapterIndex > -1) {
      return this.flattenChapters[chapterIndex];
    } else {
      let pathWithoutHash = href.split("#")[0];
      for (let index = 0; index < this.flattenChapters.length; index++) {
        if (
          this.flattenChapters[index].href.includes(
            pathWithoutHash.substring(1)
          )
        ) {
          chapterIndex = index;
          break;
        }
      }
      if (chapterIndex > -1) {
        return this.flattenChapters[chapterIndex];
      } else {
        return null;
      }
    }
  }
  flatChapter(chapters: any) {
    let newChapter: any = [];
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].subitems && chapters[i].subitems.length > 0) {
        newChapter.push(chapters[i]);
        newChapter = newChapter.concat(this.flatChapter(chapters[i].subitems));
      } else {
        newChapter.push(chapters[i]);
      }
    }
    this.flattenChapters = newChapter;
    return newChapter;
  }
  getChapter() {
    return this.chapterList;
  }
  getChapterDoc() {
    return this.chapterDocList;
  }
  async goToChapter(chapterDocIndex, chapterHref, chapterTitle) {
    await handleRenderChatper(
      parseInt(chapterDocIndex),
      chapterTitle,
      chapterHref,
      this.chapterDocList,
      this.element,
      this.mode,
      this.format
    );
    if (chapterHref && chapterHref.indexOf("#") > -1) {
      await handleScrollPosition(
        this.element,
        this.mode,
        "",
        "",
        chapterHref,
        ""
      );
    }
    await this.record();
    this.trigger("rendered");
  }
  async goToPosition(cfi: string) {
    let { text, chapterDocIndex, chapterTitle, chapterHref, count, page } =
      JSON.parse(cfi);
    await handleRenderChatper(
      parseInt(chapterDocIndex),
      chapterTitle,
      chapterHref,
      this.chapterDocList,
      this.element,
      this.mode,
      this.format
    );
    await handleScrollPosition(this.element, this.mode, text, count, "", page);
    await this.record();
    this.trigger("rendered");
  }
  async goToNode(node: any) {
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc: any = iframe.contentDocument;
    if (!doc) {
      return;
    }

    let targetNode = getCloestBlock(node, this.element);
    let left = targetNode ? convertStyleNum(targetNode.offsetLeft) : 0;
    let top = targetNode ? convertStyleNum(targetNode.offsetTop) : 0;
    if (this.mode !== "scroll") {
      doc.body.scrollTo(left, 0);
    } else {
      this.element.scrollTo(0, top);
    }
    await this.record();
    this.trigger("rendered");
  }
  removeContent() {
    this.element.innerHTML = "";
  }
  async prev() {
    this.trigger("page-changed");
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc = iframe.contentDocument;
    if (!doc) {
      return;
    }
    if (this.mode === "scroll" || convertStyleNum(doc.body.scrollLeft) === 0) {
      await handlePrevChapter(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode,
        this.format
      );
      let chapterDocIndex = parseInt(
        StorageUtil.getKookitConfig("chapterDocIndex") || "0"
      );
      if (chapterDocIndex > 0) {
        doc.body.scrollTo(doc.body.scrollWidth, 0);
      }

      this.trigger("rendered");
    } else {
      await handleScrollPage(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode,
        this.format,
        1,
        this.trigger
      );
    }
    await this.record();
  }
  async next() {
    this.trigger("page-changed");
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc = iframe.contentDocument;
    if (!doc) {
      return;
    }
    if (
      Math.abs(
        doc.body.scrollWidth -
          convertStyleNum(doc.body.scrollLeft) -
          doc.body.clientWidth
      ) < 10 ||
      this.mode === "scroll"
    ) {
      await handleNextChapter(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode,
        this.format
      );
      this.trigger("rendered");
    } else {
      await handleScrollPage(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode,
        this.format,
        -1,
        this.trigger
      );
    }
    await this.record();
  }
  async prevChapter() {
    this.trigger("page-changed");
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc = iframe.contentDocument;
    if (!doc) {
      return;
    }
    await handlePrevChapter(
      this.element,
      this.flatChapter(this.chapterList),
      this.chapterDocList,
      this.mode,
      this.format
    );
    await this.record();
    this.trigger("rendered");
  }
  async nextChapter() {
    this.trigger("page-changed");
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc = iframe.contentDocument;
    if (!doc) {
      return;
    }
    await handleNextChapter(
      this.element,
      this.flatChapter(this.chapterList),
      this.chapterDocList,
      this.mode,
      this.format
    );
    await this.record();
    this.trigger("rendered");
  }
  visibleText() {
    return getVisibleText(this.element, this.mode);
  }
  audioText() {
    return getAudioText(this.element, this.mode);
  }
  highlightNode(text: string, style: string) {
    handleHighlightNode(this.element, this.mode, text, style);
  }
  async doSearch(keyword: string) {
    return await getSearchResult(keyword, this.chapterDocList);
  }
  async getProgress() {
    return await progressInfo(this.mode);
  }
  async record() {
    let isSliding =
      StorageUtil.getReaderConfig("isSliding") === "yes" ? true : false;
    if (isSliding) {
      await new Promise((r) => setTimeout(r, 1000));
    }
    await handleRecord(
      this.element,
      this.mode,
      this.flatChapter(this.chapterList)
    );
  }
  getPosition() {
    return {
      text: StorageUtil.getKookitConfig("text"),
      chapterTitle: StorageUtil.getKookitConfig("chapterTitle"),
      chapterDocIndex: StorageUtil.getKookitConfig("chapterDocIndex"),
      chapterHref: StorageUtil.getKookitConfig("chapterHref"),
      count: StorageUtil.getKookitConfig("count"),
      percentage: StorageUtil.getKookitConfig("percentage"),
      page: StorageUtil.getKookitConfig("page"),
    };
  }
  setStyle(css: string) {
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return;
    let doc = iframe.contentDocument;
    if (!doc) {
      return;
    }
    doc.body.setAttribute("style", css + doc.body.getAttribute("style"));
  }
}
export default GeneralRender;
