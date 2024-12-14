import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import {
  convertStyleNum,
  getImageElement,
  progressInfo,
} from "../utils/layoutUtil";
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
} from "../utils/navigationUtil";
import EventEmitter from "../utils/EventEmitter";
import GeneralParser from "../utils/generalParser";
import { mimetypeReverse } from "../utils/mimetype";
import { CFI } from "../libs/cfi";
import { clearHighlight, showNoteHighlight } from "../utils/noteUtil";
import JSZip from "jszip";
declare var window: any;

class GeneralRender extends EventEmitter {
  mode: string;
  format: string;
  animation: string;
  book: any;
  tempLocation: any;
  chapterList: Chapter[];
  flattenChapters: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  constructor(mode: string, format: string, animation: string) {
    super();
    this.mode = mode;
    this.animation = animation;
    this.format = format;
    this.chapterList = [];
    this.chapterDocList = [];
    this.flattenChapters = [];
    this.book = "";
    this.element = "";
    this.tempLocation = {};
  }
  getPageSize() {
    let scale = this.mode === "double" ? 2 : 1;
    let section = Math.floor(this.element.clientWidth / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    return {
      width: this.element.clientWidth,
      height: this.element.clientHeight,
      left: this.element.offsetLeft,
      top: this.element.offsetTop,
      scrollTop: this.element.scrollTop,
      sectionWidth: (this.element.clientWidth - gap) / scale,
      gap: gap,
    };
  }
  getCache(book: any) {
    return new Promise<ArrayBuffer | string>(async (resolve, reject) => {
      let parser = new GeneralParser(book);
      this.chapterList = await parser.getChapter(book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      let toc = this.chapterList;
      let sections = this.chapterDocList.map((item: ChapterDoc) => {
        return { href: item.href, label: item.label };
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
          if (imgDomList[subindex].getAttribute("src")) {
            try {
              let blob = await fetch(
                await imgDomList[subindex].getAttribute("src")
              ).then((r) => r.blob());
              subImgZip.file(subindex + "." + mimetypeReverse[blob.type], blob);
              imgDomList[subindex].src =
                "imgs/" +
                index +
                "/" +
                subindex +
                "." +
                mimetypeReverse[blob.type];
            } catch (error) {
              console.log(error);
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
              let blob = await fetch(await link.getAttribute("href")).then(
                (r) => r.blob()
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
              console.log(error);
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
        for (let index = 0; index < this.chapterDocList.length; index++) {
          if (
            this.chapterDocList[index].text &&
            this.chapterDocList[index].text.id &&
            (this.chapterDocList[index].text.id + "").includes(path)
          ) {
            chapterIndex = index;
            break;
          }
        }
        if (chapterIndex > -1) {
          return { label: "", href: "", index: chapterIndex };
        } else {
          return null;
        }
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
  async goToPercentage(percentage: number) {
    if (this.flattenChapters.length > 0) {
      let chapterIndex =
        percentage === 1
          ? this.flattenChapters.length - 1
          : Math.floor(this.flattenChapters.length * percentage);
      await this.goToChapter(
        this.flattenChapters[chapterIndex].index.toString(),
        this.flattenChapters[chapterIndex].href,
        this.flattenChapters[chapterIndex].label
      );
    }
  }
  async goToChapterIndex(targetChapterIndex: number) {
    if (this.flattenChapters.length > 0) {
      await this.goToChapter(
        this.flattenChapters[targetChapterIndex].index,
        this.flattenChapters[targetChapterIndex].href,
        this.flattenChapters[targetChapterIndex].label
      );
    }
  }
  async goToChapter(chapterDocIndex, chapterHref, chapterTitle) {
    let doc = this.getDocument();
    let win = this.getWindow();
    if (!doc || !win) return;
    await handleRenderChatper(
      parseInt(chapterDocIndex),
      chapterTitle,
      chapterHref,
      this.chapterDocList,
      this.element,
      this.mode,
      this.format,
      this.tempLocation,
      doc,
      win
    );
    if (chapterHref && chapterHref.indexOf("#") > -1) {
      await handleScrollPosition(
        this.element,
        this.mode,
        "",
        "",
        chapterHref,
        "",
        doc
      );
    }
    await this.record();
    this.trigger("rendered");
  }
  async goToPosition(bookLocationStr: string) {
    let doc = this.getDocument();
    let win = this.getWindow();
    if (!doc || !win) return;
    let bookLocation = JSON.parse(bookLocationStr);
    this.tempLocation = {
      text: bookLocation.text,
      chapterTitle: bookLocation.chapterTitle,
      chapterDocIndex: bookLocation.chapterDocIndex,
      chapterHref: bookLocation.chapterHref,
      count: bookLocation.count,
      page: bookLocation.page,
    };
    let { text, chapterTitle, chapterDocIndex, chapterHref, count, page, cfi } =
      bookLocation;
    await handleRenderChatper(
      parseInt(chapterDocIndex),
      chapterTitle,
      chapterHref,
      this.chapterDocList,
      this.element,
      this.mode,
      this.format,
      this.tempLocation,
      doc,
      win
    );
    if (cfi) {
      const cfiInfo = new CFI(cfi, {});
      let doc = this.getDocument();
      if (!doc) {
        return;
      }
      const { node, offset } = cfiInfo.resolve(doc, {});
      console.log(node, offset);

      if (!node) {
        return;
      }
      let element: Element | null = null;
      let currentNode: Node | null = node;

      while (currentNode) {
        const temp: Element = currentNode as Element;
        if (
          temp.tagName &&
          "h1,h2,h3,h4,h5,h6,p,div,ul,dl,ol,pre,blockquote,address".indexOf(
            temp.tagName.toLowerCase()
          ) > -1
        ) {
          element = temp;
          break;
        }
        currentNode = currentNode.parentNode;
      }
      if (!element) {
        return;
      }
      count = "ignore";
      text = element.textContent;
    }

    await handleScrollPosition(
      this.element,
      this.mode,
      text,
      count,
      "",
      page,
      doc
    );
    await this.record();
    this.trigger("rendered");
  }
  getDocument(): Document | null {
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return null;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return null;
    let doc: any = iframe.contentDocument;
    if (!doc) {
      return null;
    }
    return doc;
  }
  getWindow() {
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return null;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return null;
    return iframe;
  }
  async goToNode(node: any) {
    let doc = this.getDocument();
    if (!doc) {
      return;
    }
    let targetNode = getCloestBlock(node, this.element, this.mode);
    let left = targetNode
      ? convertStyleNum(targetNode.offsetLeft) -
        convertStyleNum(
          targetNode.marginLeft ||
            parseFloat(getComputedStyle(targetNode).marginLeft)
        )
      : 0;
    let top = targetNode
      ? convertStyleNum(targetNode.offsetTop) -
        convertStyleNum(
          targetNode.marginTop ||
            parseFloat(getComputedStyle(targetNode).marginTop)
        )
      : 0;
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
    let doc = this.getDocument();
    let win = this.getWindow();
    if (!doc || !win) {
      return;
    }
    if (this.mode === "scroll" || convertStyleNum(doc.body.scrollLeft) === 0) {
      await handlePrevChapter(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode,
        this.format,
        this.tempLocation,
        doc,
        win
      );
      let chapterDocIndex = parseInt(this.tempLocation.chapterDocIndex || "-1");
      if (chapterDocIndex > -1) {
        doc.body.scrollTo(doc.body.scrollWidth, 0);
      }
      this.trigger("rendered");
    } else {
      await handleScrollPage(this.element, this.animation, 1, doc);
    }
    await this.record();
  }
  async next() {
    this.trigger("page-changed");
    let doc = this.getDocument();
    let win = this.getWindow();
    if (!doc || !win) {
      return;
    }
    if (
      (Math.abs(
        doc.body.scrollWidth -
          convertStyleNum(doc.body.scrollLeft) -
          doc.body.clientWidth
      ) < 10 &&
        this.mode !== "scroll") ||
      (Math.abs(
        this.element.scrollHeight -
          convertStyleNum(this.element.scrollTop) -
          this.element.clientHeight
      ) < 10 &&
        this.mode === "scroll")
    ) {
      // if the last page
      await handleNextChapter(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.mode,
        this.format,
        this.tempLocation,
        doc,
        win
      );
      this.trigger("rendered");
    } else if (this.mode === "scroll") {
      // scroll mode under normal condition
      this.element.scrollBy({
        left: 0,
        top: this.element.clientHeight - 50,
        behavior: "smooth",
      });
    } else {
      // single and double mode under normal condition
      await handleScrollPage(this.element, this.animation, -1, doc);
    }
    await this.record();
  }
  async prevChapter() {
    this.trigger("page-changed");
    let doc = this.getDocument();
    let win = this.getWindow();
    if (!doc || !win) return;
    await handlePrevChapter(
      this.element,
      this.flatChapter(this.chapterList),
      this.chapterDocList,
      this.mode,
      this.format,
      this.tempLocation,
      doc,
      win
    );
    await this.record();
    this.trigger("rendered");
  }
  async nextChapter() {
    this.trigger("page-changed");
    let doc = this.getDocument();
    let win = this.getWindow();
    if (!doc || !win) return;
    await handleNextChapter(
      this.element,
      this.flatChapter(this.chapterList),
      this.chapterDocList,
      this.mode,
      this.format,
      this.tempLocation,
      doc,
      win
    );
    await this.record();
    this.trigger("rendered");
  }
  visibleText() {
    let doc = this.getDocument();
    if (!doc) return "";
    return getVisibleText(this.element, this.mode, doc);
  }
  audioText() {
    let doc = this.getDocument();
    if (!doc) return "";
    return getAudioText(this.element, this.mode, doc);
  }
  highlightNode(text: string, style: string) {
    let doc = this.getDocument();
    if (!doc) return;
    handleHighlightNode(this.element, this.mode, text, style, doc);
  }
  async doSearch(keyword: string) {
    return await getSearchResult(keyword, this.chapterDocList);
  }
  async getProgress() {
    let doc = this.getDocument();
    if (!doc) return;
    return await progressInfo(this.mode, doc);
  }
  async record() {
    if (this.animation === "sliding") {
      await new Promise((r) => setTimeout(r, 1000));
    }
    let doc = this.getDocument();
    if (!doc) return;
    await handleRecord(
      this.element,
      this.mode,
      this.flatChapter(this.chapterList),
      this.tempLocation,
      doc
    );
  }
  getPosition() {
    return this.tempLocation;
  }
  setStyle(css: string) {
    let doc = this.getDocument();
    if (!doc) return;
    doc.body.setAttribute("style", css + doc.body.getAttribute("style"));
  }
  async getHightlightCoords(pageIndex: number) {
    let doc = this.getDocument();
    let win = this.getWindow();
    if (!doc || !win) return;
    let charRange = window.rangy
      .getSelection(win)
      .saveCharacterRanges(doc.body)[0];
    return charRange;
  }
  async renderHighlighters(notes: any[], handleNoteClick: any) {
    let doc = this.getDocument();
    let win = this.getWindow();
    if (!doc || !win) return;
    clearHighlight(doc);
    for (let index = 0; index < notes.length; index++) {
      const item = notes[index];
      try {
        showNoteHighlight(
          JSON.parse(item.range),
          item.color,
          item.key,
          handleNoteClick,
          doc,
          win
        );
        // highlighter.highlightSelection(classes[item.color]);
      } catch (e) {
        console.warn(
          e,
          "Exception has been caught when restore character ranges."
        );
        return;
      }
    }
  }
  removeOneNote(key: string, format: string) {
    let doc = this.getDocument();
    if (!doc) return;
    const elements = doc.querySelectorAll(".kookit-note");
    for (let index = 0; index < elements.length; index++) {
      const element: any = elements[index];
      const dataKey = element.getAttribute("data-key");
      if (dataKey === key) {
        element.parentNode.removeChild(element);
      }
    }
  }
  async createOneNote(item: any, handleNoteClick: any) {
    let doc = this.getDocument();
    let win = this.getWindow();
    if (!doc || !win) return;
    showNoteHighlight(
      JSON.parse(item.range),
      item.color,
      item.key,
      handleNoteClick,
      doc,
      win
    );
  }
}
export default GeneralRender;
