import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import {
  convertStyleNum,
  getSelectedElement,
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
  handleRenderChapter,
  handleScrollPage,
  handleScrollPosition,
  handleHighlightNode,
} from "../utils/navigationUtil";
import EventEmitter from "../utils/EventEmitter";
import { CFI } from "../libs/cfi";
import { clearHighlight, showNoteHighlight } from "../utils/noteUtil";
import { addPageAnimation } from "../utils/animationUtil";
import rangy from "rangy/lib/rangy-core.js";
import "rangy/lib/rangy-textrange";
import Chinese from "chinese-s2t";
class GeneralRender extends EventEmitter {
  readerMode: string;
  format: string;
  animation: string;
  convertChinese: string | undefined;
  isDarkMode: string | undefined;
  book: any;
  tempLocation: any;
  chapterList: Chapter[];
  flattenChapters: Chapter[];
  chapterDocList: ChapterDoc[];
  element: any;
  flipToNextPage: () => void;
  flipToPrevPage: () => void;
  mouseDownHandler: (event: TouchEvent) => void;
  mouseUpHandler: (event: TouchEvent) => void;
  mouseMoveHandler: (event: TouchEvent) => void;
  isMobile: string | undefined;
  constructor(config: {
    readerMode: string;
    format: string;
    animation: string;
    convertChinese?: string;
    isDarkMode?: string;
    isMobile?: string;
  }) {
    super();
    this.readerMode = config.readerMode;
    this.animation = config.animation;
    this.format = config.format;
    this.convertChinese = config.convertChinese;
    this.isDarkMode = config.isDarkMode;
    this.isMobile = config.isMobile;
    this.chapterList = [];
    this.chapterDocList = [];
    this.flattenChapters = [];
    this.book = "";
    this.element = "";
    this.tempLocation = {};
    this.flipToNextPage = () => {};
    this.flipToPrevPage = () => {};
    this.mouseDownHandler = () => {};
    this.mouseUpHandler = () => {};
    this.mouseMoveHandler = (event: TouchEvent) => {};
  }
  getPageSize() {
    let scale = this.readerMode === "double" ? 2 : 1;
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
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    await handleRenderChapter(
      parseInt(chapterDocIndex),
      chapterTitle,
      chapterHref,
      this.chapterDocList,
      this.element,
      this.readerMode,
      this.format,
      this.tempLocation,
      doc,
      iframe
    );
    if (chapterHref && chapterHref.indexOf("#") > -1) {
      await handleScrollPosition(
        this.element,
        this.readerMode,
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
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
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
    await handleRenderChapter(
      parseInt(chapterDocIndex),
      chapterTitle,
      chapterHref,
      this.chapterDocList,
      this.element,
      this.readerMode,
      this.format,
      this.tempLocation,
      doc,
      iframe
    );
    if (cfi) {
      const cfiInfo = new CFI(cfi, {});
      let doc = this.getDocument();
      if (!doc) {
        return;
      }
      const { node, offset } = cfiInfo.resolve(doc, {});

      if (node) {
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
        if (element) {
          count = "ignore";
          text = element.textContent;
        }
      }
    }
    await handleScrollPosition(
      this.element,
      this.readerMode,
      text,
      count,
      "",
      page,
      doc
    );
    await this.record();
    this.trigger("rendered");
    // this.addPageAnimation();
  }
  getDocument(): Document | null {
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return null;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return null;
    let doc = iframe.contentDocument;
    if (!doc) {
      return null;
    }
    return doc;
  }
  getIframe() {
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
    let targetNode = getCloestBlock(node, this.element, this.readerMode);
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
    if (this.readerMode !== "scroll") {
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
    // this.trigger("page-changed");
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) {
      return;
    }
    if (
      (this.readerMode === "scroll" &&
        convertStyleNum(this.element.scrollTop) === 0) ||
      (this.readerMode !== "scroll" &&
        convertStyleNum(doc.body.scrollLeft) === 0)
    ) {
      if (this.tempLocation.chapterDocIndex === "0") {
        return;
      }
      await handlePrevChapter(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.readerMode,
        this.format,
        this.tempLocation,
        doc,
        iframe
      );
      let chapterDocIndex = parseInt(this.tempLocation.chapterDocIndex || "-1");
      if (chapterDocIndex > -1) {
        if (this.readerMode === "scroll") {
          this.element.scrollTo(0, doc.body.scrollHeight);
        } else {
          doc.body.scrollTo(doc.body.scrollWidth, 0);
        }
      }
      this.trigger("rendered");
    } else if (this.readerMode === "scroll") {
      // scroll readerMode under normal condition
      this.element.scrollBy({
        left: 0,
        top: -(this.element.clientHeight - 50),
        behavior: "smooth",
      });
    } else {
      await handleScrollPage(
        this.element,
        this.animation,
        1,
        doc,
        this.flipToNextPage,
        this.flipToPrevPage,
        this.isMobile
      );
    }
    await this.record();
  }
  async next() {
    // this.trigger("page-changed");
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) {
      return;
    }
    if (
      (Math.abs(
        doc.body.scrollWidth -
          convertStyleNum(doc.body.scrollLeft) -
          doc.body.clientWidth
      ) < 10 &&
        this.readerMode !== "scroll") ||
      (Math.abs(
        this.element.scrollHeight -
          convertStyleNum(this.element.scrollTop) -
          this.element.clientHeight
      ) < 10 &&
        this.readerMode === "scroll")
    ) {
      // if the last page
      await handleNextChapter(
        this.element,
        this.flatChapter(this.chapterList),
        this.chapterDocList,
        this.readerMode,
        this.format,
        this.tempLocation,
        doc,
        iframe
      );
      this.trigger("rendered");
    } else if (this.readerMode === "scroll") {
      // scroll readerMode under normal condition
      this.element.scrollBy({
        left: 0,
        top: this.element.clientHeight - 50,
        behavior: "smooth",
      });
    } else {
      // single and double readerMode under normal condition
      await handleScrollPage(
        this.element,
        this.animation,
        -1,
        doc,
        this.flipToNextPage,
        this.flipToPrevPage,
        this.isMobile
      );
    }
    await this.record();
  }
  async prevChapter() {
    // this.trigger("page-changed");
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    await handlePrevChapter(
      this.element,
      this.flatChapter(this.chapterList),
      this.chapterDocList,
      this.readerMode,
      this.format,
      this.tempLocation,
      doc,
      iframe
    );
    await this.record();
    this.trigger("rendered");
  }
  async nextChapter() {
    // this.trigger("page-changed");
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    await handleNextChapter(
      this.element,
      this.flatChapter(this.chapterList),
      this.chapterDocList,
      this.readerMode,
      this.format,
      this.tempLocation,
      doc,
      iframe
    );
    await this.record();
    this.trigger("rendered");
  }
  visibleText() {
    let doc = this.getDocument();
    if (!doc) return "";
    return getVisibleText(this.element, this.readerMode, doc);
  }
  audioText() {
    let doc = this.getDocument();
    if (!doc) return "";
    return getAudioText(this.element, this.readerMode, doc);
  }
  chapterText() {
    let doc = this.getDocument();
    if (!doc) return "";
    return doc.body.innerText;
  }
  highlightNode(text: string, style: string) {
    let doc = this.getDocument();
    if (!doc) return;
    handleHighlightNode(text, style, doc);
  }
  async doSearch(keyword: string) {
    return await getSearchResult(keyword, this.chapterDocList);
  }
  getProgress() {
    let doc = this.getDocument();
    if (!doc) return;
    return progressInfo(this.readerMode, doc);
  }
  async record() {
    if (this.animation !== "") {
      await new Promise((r) => setTimeout(r, 1000));
    }
    let doc = this.getDocument();
    if (!doc) return;
    await handleRecord(
      this.element,
      this.readerMode,
      this.flatChapter(this.chapterList),
      this.tempLocation,
      doc,
      null
    );
    this.trigger("page-changed");
  }
  getPosition() {
    return this.tempLocation;
  }
  async getNotePosition() {
    let doc = this.getDocument();
    if (!doc) return;
    let selectedElement = getSelectedElement(doc);
    if (!selectedElement) return;
    await handleRecord(
      this.element,
      this.readerMode,
      this.flatChapter(this.chapterList),
      this.tempLocation,
      doc,
      selectedElement
    );
    return this.tempLocation;
  }
  setStyle(css: string) {
    let doc = this.getDocument();
    if (!doc) return;
    doc.body.setAttribute("style", css);
  }
  async getHightlightCoords(pageIndex: number) {
    rangy.init();
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    let charRange = rangy.getSelection(iframe).saveCharacterRanges(doc.body)[0];
    return charRange;
  }
  async renderHighlighters(notes: any[], handleNoteClick: any) {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
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
          iframe
        );
        // highlighter.highlightSelection(classes[item.color]);
      } catch (e) {
        console.error(
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
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    showNoteHighlight(
      JSON.parse(item.range),
      item.color,
      item.key,
      handleNoteClick,
      doc,
      iframe
    );
  }
  tsTransform = () => {
    let doc = this.getDocument();
    if (!doc) return;
    if (this.convertChinese === "Simplified To Traditional") {
      doc
        .querySelectorAll(
          "h1,h2,h3,h4,h5,h6,p,div,ul,dl,ol,pre,blockquote,address"
        )
        .forEach((item) => {
          item.innerHTML = item.innerHTML
            .split("")
            .map((item) => Chinese.s2t(item))
            .join("");
        });
    } else if (this.convertChinese === "Traditional To Simplified") {
      doc
        .querySelectorAll(
          "h1,h2,h3,h4,h5,h6,p,div,ul,dl,ol,pre,blockquote,address"
        )
        .forEach((item) => {
          item.innerHTML = item.innerHTML
            .split("")
            .map((item) => Chinese.t2s(item))
            .join("");
        });
    }
  };
  addPageAnimation = (backgroundColor: string) => {
    if (this.animation === "mimical") {
      let progressInfo = this.getProgress();
      if (!progressInfo) return;
      const pageAnimation = addPageAnimation(
        progressInfo.totalPage,
        this.isDarkMode,
        backgroundColor
      );
      if (pageAnimation) {
        this.flipToNextPage = pageAnimation.flipToNextPage;
        this.flipToPrevPage = pageAnimation.flipToPrevPage;
        this.mouseDownHandler = pageAnimation.mouseDownHandler;
        this.mouseUpHandler = pageAnimation.mouseUpHandler;
        this.mouseMoveHandler = pageAnimation.mouseMoveHandler;
      }
    }
  };
}
export default GeneralRender;
