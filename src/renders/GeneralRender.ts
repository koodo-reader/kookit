import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import {
  collectChapterImageUrls,
  convertStyleNum,
  getActualOffsetLeft,
  getActualOffsetTop,
  getSelectedElement,
  handleOneChapterDoc,
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
  handleHighlightSearchNode,
  handleHighlightAudioNode,
  isElementFootnote,
  processHtml,
  resolveXPath,
  isContentFootnote,
} from "../utils/navigationUtil";
import EventEmitter from "../utils/EventEmitter";
import { CFI } from "../libs/cfi";
import {
  clearHighlight,
  showNoteHighlight,
  showNoteHighlightBatch,
  applyWordDefinitions,
  clearWordDefinitions,
} from "../utils/noteUtil";
import { addPageAnimation } from "../utils/animationUtil";
import rangy from "rangy/lib/rangy-core.js";
import "rangy/lib/rangy-textrange";

import { getPDFSearchResult } from "../utils/pdfUtil";
import {
  addAndroidTouchEvent,
  addAppleTouchEvent,
  blobUrlToBase64,
  slideAnimateTo,
} from "../utils/touchUtil";
import { getBlockElement, isParentBlock } from "../utils/common";
import {
  segmentSpeedReadingWords,
  getSpeedReadingORPIndex,
  getSpeedReadingWordDelay,
} from "../utils/speedReadingUtil";
declare var window: any;
export interface TextRule {
  id: string;
  type: "replace" | "delete";
  pattern: string;
  replacement?: string;
  matchType: "regex" | "plain";
  scope: "all" | "book";
  bookKey?: string;
  bookName?: string;
}
class GeneralRender extends EventEmitter {
  readerMode: string;
  format: string;
  animation: string = "none";
  convertChinese: string | undefined;
  isIndent: string | undefined;
  bookLayout: string | undefined;
  textRules: TextRule[];
  codeHighlight: string | undefined;
  isHyphenation: string | undefined;
  isDarkMode: string | undefined;
  textOrientation: string | undefined;
  backgroundColor: string;
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
  isBionic: string = "no";
  isParagraphMode: string = "no";
  isReadingRuler: string = "no";
  readingRulerLineHeight: number = 3;
  readingRulerBackgroundOpacity: number = 0.5;
  isSpeedReading: string = "no";
  speedReadingSpeed: number = 300;
  platform: string = "web";
  isAllowScript: string = "no";
  touchEventSet: any;
  scrollTimer: any;
  recordTimer: any;
  transMap: Record<
    string,
    {
      id: string;
      text?: string;
    }
  >;
  fullTranslationMode: string = "no";
  paragraphIndex: number = 0;
  paragraphSkipFlip: boolean = false;
  readingRulerIndex: number = 0;
  readingRulerColumn: number = 0;
  readingRulerSkipFlip: boolean = false;
  speedReadingWords: string[] = [];
  speedReadingIndex: number = 0;
  speedReadingTimer: any = null;
  speedReadingPlaying: boolean = false;
  speedReadingSkipFlip: boolean = false;
  speedReadingAutoStarted: boolean = false;
  speedReadingOverlayEl: any = null;

  constructor(config: {
    readerMode: string;
    format: string;
    animation: string;
    convertChinese?: string;
    isIndent?: string;
    isHyphenation?: string;
    isDarkMode?: string;
    isMobile?: string;
    backgroundColor?: string;
    isBionic?: string;
    isParagraphMode?: string;
    isReadingRuler?: string;
    readingRulerLineHeight?: number;
    readingRulerBackgroundOpacity?: number;
    isSpeedReading?: string;
    speedReadingSpeed?: number;
    textOrientation?: string;
    isAllowScript?: string;
    fullTranslationMode?: string;
    bookLayout?: string;
    platform?: string;
    textRules?: TextRule[];
    codeHighlight?: string;
  }) {
    super();
    this.readerMode = config.readerMode;
    window.readerMode = config.readerMode;
    this.animation = config.animation || "none";
    this.format = config.format;
    this.convertChinese = config.convertChinese;
    window.convertChinese = config.convertChinese;
    this.isIndent = config.isIndent;
    window.isIndent = config.isIndent;
    this.isHyphenation = config.isHyphenation || "no";
    window.isHyphenation = this.isHyphenation;
    this.isDarkMode = config.isDarkMode;
    this.isMobile = config.isMobile;
    this.backgroundColor = config.backgroundColor || "";
    this.textOrientation = config.textOrientation;
    window.textOrientation = config.textOrientation;
    this.chapterList = [];
    this.chapterDocList = [];
    this.flattenChapters = [];
    this.book = "";
    this.element = "";
    this.tempLocation = {};
    this.isBionic = config.isBionic || "no";
    this.isReadingRuler = config.isReadingRuler || "no";
    this.isParagraphMode =
      this.isReadingRuler === "yes" ? "no" : config.isParagraphMode || "no";
    this.readingRulerLineHeight = config.readingRulerLineHeight || 3;
    this.readingRulerBackgroundOpacity =
      config.readingRulerBackgroundOpacity ?? 0.5;
    this.isSpeedReading = config.isSpeedReading || "no";
    this.speedReadingSpeed = config.speedReadingSpeed || 300;
    this.platform = config.platform || "web";
    window.platform = this.platform;
    window.isBionic = this.isBionic;
    this.transMap = {};
    window.transMap = this.transMap;
    this.fullTranslationMode = config.fullTranslationMode || "no";
    window.fullTranslationMode = this.fullTranslationMode;
    this.bookLayout = config.bookLayout || "";
    window.bookLayout = this.bookLayout;
    this.codeHighlight = config.codeHighlight || "";
    window.codeHighlight = this.codeHighlight;
    this.textRules = config.textRules || [];
    window.textRules = this.textRules;

    //手机版环境已经有严格的安全限制，无需额外限制，PDF中无法执行代码，强行开启则无法渲染图书
    this.isAllowScript =
      this.format === "PDF" || this.isMobile === "yes"
        ? "yes"
        : config.isAllowScript || "no";
    this.flipToNextPage = () => {};
    this.flipToPrevPage = () => {};
    this.paragraphIndex = 0;
    this.paragraphSkipFlip = false;
    this.on("rendered", () => {
      if (this.isParagraphMode === "yes" && !this.paragraphSkipFlip) {
        this.paragraphIndex = 0;
        this.updateParagraphOverlay();
      }
      if (this.isReadingRuler === "yes" && !this.readingRulerSkipFlip) {
        this.readingRulerIndex = 0;
        this.readingRulerColumn = 0;
        this.updateReadingRulerOverlay();
      }
      if (!this.speedReadingSkipFlip) {
        this.handleSpeedReadingRendered();
      }
    });
    this.mouseDownHandler = () => {};
    this.mouseUpHandler = () => {};
    this.mouseMoveHandler = (event: TouchEvent) => {};
    this.touchEventSet = {};
    if (this.isMobile === "yes") {
      console.log = function (...args) {
        window.ReactNativeWebView.postMessage(
          args.map((arg) => String(arg)).join(", ")
        );
      };
      console.info = function (...args) {
        window.ReactNativeWebView.postMessage(
          args.map((arg) => String(arg)).join(", ")
        );
      };
      console.error = function (...args) {
        window.ReactNativeWebView.postMessage(
          args.map((arg) => String(arg)).join(", ")
        );
      };
    }
  }
  isVertical() {
    return this.textOrientation === "vertical" && this.readerMode !== "scroll";
  }
  getPageSize() {
    let scale = this.readerMode === "double" ? 2 : 1;
    let iframe = this.getIframe();
    if (!iframe) return;
    let iframeHeight = iframe?.getBoundingClientRect().height;
    if (this.isVertical()) {
      let section = Math.floor(this.element.clientHeight / 12);
      let gap = section % 2 === 0 ? section : section - 1;
      return {
        width: this.element.clientWidth,
        height: this.element.clientHeight,
        left: getActualOffsetLeft(this.element),
        top: getActualOffsetTop(this.element),
        scrollTop: this.element.scrollTop,
        scrollLeft: this.element.scrollWidth / 2 - this.element.clientWidth / 2,
        sectionWidth: this.element.clientWidth,
        sectionHeight: (this.element.clientHeight - gap) / scale,
        gap: gap,
      };
    }
    let section = Math.floor(this.element.clientWidth / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    return {
      width: this.element.clientWidth,
      height: this.element.clientHeight,
      left: getActualOffsetLeft(this.element),
      top: getActualOffsetTop(this.element),
      scrollTop: this.element.scrollTop,
      scrollLeft: this.element.scrollWidth / 2 - this.element.clientWidth / 2,
      sectionWidth: (this.element.clientWidth - gap) / scale,
      sectionHeight: iframeHeight,
      gap: gap,
    };
  }
  async scrollToText(text: string) {
    let doc = this.getDocument();
    if (!doc) return;
    let nodeList = getBlockElement(doc.body).filter(
      (item) => !isParentBlock(item)
    );
    let audioNodes = nodeList.filter(
      (s) => ((s as HTMLElement).textContent || "").indexOf(text) > -1
    );
    if (audioNodes.length > 0) {
      let targetNode: any = audioNodes[0];
      let left = targetNode
        ? getActualOffsetLeft(targetNode) -
          convertStyleNum(
            targetNode.marginLeft ||
              parseFloat(getComputedStyle(targetNode).marginLeft)
          )
        : 0;
      let top = targetNode
        ? getActualOffsetTop(targetNode) -
          convertStyleNum(
            targetNode.marginTop ||
              parseFloat(getComputedStyle(targetNode).marginTop)
          )
        : 0;
      if (this.readerMode !== "scroll") {
        if (this.isVertical()) {
          doc.body.scrollTo(0, top);
        } else {
          doc.body.scrollTo(left, 0);
        }
      } else {
        this.element.scrollTo(0, top);
      }
    }
    if (this.animation !== "none" && this.isMobile !== "yes") {
      await new Promise((r) => setTimeout(r, 1000));
    }
    await handleRecord(
      this.element,
      this.readerMode,
      this.flatChapter(this.chapterList),
      this.chapterDocList,
      this.tempLocation,
      doc,
      null
    );
    this.trigger("scroll-text");
  }
  async goToPage(targetPage: number) {
    if (this.readerMode === "scroll") {
      if (targetPage < 0) {
        targetPage = 1;
      }

      let top = (targetPage - 1) * (this.element.clientHeight - 50);
      this.element.scrollTo(0, top);
    } else {
      let doc = this.getDocument();
      if (!doc) return;
      if (this.isVertical()) {
        let section = Math.floor(this.element.clientHeight / 12);
        let gap = section % 2 === 0 ? section : section - 1;
        const height = this.element.clientHeight;
        const scrollDistance = height + gap;
        if (this.readerMode === "double") {
          targetPage =
            (targetPage % 2 === 0 ? targetPage - 2 : targetPage - 1) / 2;
        } else {
          targetPage = targetPage - 1;
        }
        if (targetPage < 0) {
          targetPage = 0;
        }
        const targetScrollTop = targetPage * scrollDistance;
        doc.body.scrollTo({
          left: 0,
          top: targetScrollTop,
          behavior:
            this.animation === "sliding" && this.isMobile !== "yes"
              ? "smooth"
              : "auto",
        });
      } else {
        let section = Math.floor(this.element.clientWidth / 12);
        let gap = section % 2 === 0 ? section : section - 1;
        const width = this.element.clientWidth;
        const scrollDistance = width + gap;
        if (this.readerMode === "double") {
          targetPage =
            (targetPage % 2 === 0 ? targetPage - 2 : targetPage - 1) / 2;
        } else {
          targetPage = targetPage - 1;
        }
        if (targetPage < 0) {
          targetPage = 0;
        }
        const targetScrollLeft = targetPage * scrollDistance;
        doc.body.scrollTo({
          top: 0,
          left: targetScrollLeft,
          behavior:
            this.animation === "sliding" && this.isMobile !== "yes"
              ? "smooth"
              : "auto",
        });
      }
    }
    await this.record();
  }
  resolveChapter(href: string) {
    let path = href;
    //移除path前# . /
    path = path.replace(/^#/, "").replace(/^\.\//, "").replace(/^\//, "");

    // 处理相对路径 ../
    if (path.startsWith("../")) {
      // 移除 ../ 前缀，保留后面的路径部分
      path = path.replace(/^\.\.\//, "");
    }

    let chapterIndex = -1;
    if (this.flattenChapters.length === 0) {
      this.flatChapter(this.chapterList);
    }
    // 先从chapterList中查找
    for (let index = 0; index < this.flattenChapters.length; index++) {
      if (this.flattenChapters[index].href.includes(path)) {
        chapterIndex = index;
        break;
      }
    }

    if (chapterIndex > -1) {
      let chapter = this.flattenChapters[chapterIndex];
      if (href.startsWith("kindle")) {
        if (this.chapterDocList[chapter.index].href === href) {
          return chapter;
        } else {
          return null;
        }
      } else {
        return chapter;
      }
    }
    // 再从chapterDocList中查找
    for (let index = 0; index < this.chapterDocList.length; index++) {
      if (this.chapterDocList[index].href.includes(path)) {
        chapterIndex = index;
        break;
      }
    }

    if (chapterIndex > -1) {
      let chapterDoc = this.chapterDocList[chapterIndex];
      return {
        label: chapterDoc.label || "",
        href: chapterDoc.href,
        index: chapterIndex,
      };
    }

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
      return {
        label: this.chapterDocList[chapterIndex].label || "",
        href: this.chapterDocList[chapterIndex].href,
        index: chapterIndex,
      };
    } else {
      return null;
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
    if (this.flattenChapters.length === 0) {
      this.flatChapter(this.chapterList);
    }
    if (this.flattenChapters.length > 0) {
      if (this.flattenChapters.length === 1) {
        let progressInfo = this.getProgress();
        if (!progressInfo) return;
        let pageNumber = Math.floor(progressInfo.totalPage * percentage);
        await this.goToPage(pageNumber);
        return;
      }
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
    if (this.flattenChapters.length === 0) {
      this.flatChapter(this.chapterList);
    }
    if (this.flattenChapters.length > 0) {
      await this.goToChapter(
        this.flattenChapters[targetChapterIndex].index,
        this.flattenChapters[targetChapterIndex].href,
        this.flattenChapters[targetChapterIndex].label
      );
    }
  }
  async goToChapterDocIndex(chapterDocIndex: number) {
    if (this.chapterDocList.length > 0) {
      await this.goToChapter(
        chapterDocIndex,
        this.chapterDocList[chapterDocIndex].href,
        this.chapterDocList[chapterDocIndex].label
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
    if (chapterHref && chapterHref.startsWith("kindle")) {
      let result = await this.book.resolveHref(chapterHref);
      if (result.anchor) {
        let node = result.anchor(doc);
        if (node) {
          await this.goToNode(node);
        }
      }
    }
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
    this.addPageAnimation();
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
      percentage: bookLocation.percentage,
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
            "h1,h2,h3,h4,h5,h6,p,div,ul,dl,ol,pre,li,dt,dd,blockquote,address,kookitmarker".indexOf(
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
    rangy.init();
    await this.record();
    this.trigger("rendered");
    this.addPageAnimation();
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
    if (!node) {
      return;
    }
    let targetNode = getCloestBlock(node, this.element, this.readerMode);
    let left = targetNode
      ? getActualOffsetLeft(targetNode) -
        convertStyleNum(
          targetNode.marginLeft ||
            parseFloat(getComputedStyle(targetNode).marginLeft)
        )
      : 0;
    let top = targetNode
      ? getActualOffsetTop(targetNode) -
        convertStyleNum(
          targetNode.marginTop ||
            parseFloat(getComputedStyle(targetNode).marginTop)
        )
      : 0;
    if (this.readerMode !== "scroll") {
      if (this.isVertical()) {
        doc.body.scrollTo(0, top);
      } else {
        doc.body.scrollTo(left, 0);
      }
    } else {
      this.element.scrollTo(0, top);
    }
    await this.record();
    this.trigger("rendered");
  }
  async goToXpath(xpath: string) {
    let doc = this.getDocument();
    if (!doc) return;
    ///body/DocFragment[3]/body/div/div/p[12]/text().87
    let chapterDocIndexMatch = xpath.match(/\/body\/DocFragment\[(\d+)\]/);
    let chapterDocIndex = chapterDocIndexMatch
      ? parseInt(chapterDocIndexMatch[1] || "1") - 1
      : 0;
    let chapterDoc = this.chapterDocList[chapterDocIndex];
    await handleRenderChapter(
      chapterDocIndex,
      chapterDoc.label || "",
      chapterDoc.href,
      this.chapterDocList,
      this.element,
      this.readerMode,
      this.format,
      this.tempLocation,
      doc,
      this.getIframe()
    );
    doc = this.getDocument();
    if (!doc) return;
    let newXpath = xpath.replace(/\/body\/DocFragment\[\d+\]/, "");
    newXpath = newXpath.split("/text()")[0];
    const node = resolveXPath(newXpath, doc);
    await this.goToNode(node);
    rangy.init();
    await this.record();
    this.trigger("rendered");
  }
  removeContent() {
    this.element.innerHTML = "";
  }
  getParagraphNodes(): HTMLElement[] {
    let doc = this.getDocument();
    if (!doc || !doc.body || !this.element) return [];
    const currentDoc = doc;
    let nodeList = getBlockElement(doc.body).filter(
      (item) => !isParentBlock(item)
    );
    return nodeList.filter(
      (el) =>
        (el.textContent || "").trim() &&
        this.isParagraphInViewport(currentDoc, el as HTMLElement)
    );
  }
  isParagraphInViewport(doc: Document, el: HTMLElement): boolean {
    const view: any = doc.defaultView || window;
    const style = view.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return false;
    if (this.readerMode === "scroll") {
      return (
        rect.bottom > this.element.scrollTop &&
        rect.top < this.element.scrollTop + this.element.clientHeight
      );
    }
    let iframe = this.getIframe();
    if (!iframe) return false;
    return (
      rect.bottom > 0 &&
      rect.top < iframe.clientHeight &&
      rect.right > 0 &&
      rect.left < iframe.clientWidth
    );
  }
  getParagraphOverlayBackground(doc: Document): string {
    const view: any = doc.defaultView || window;
    let color = view.getComputedStyle(doc.body).backgroundColor;
    if (
      !color ||
      color === "transparent" ||
      color.replace(/\s/g, "") === "rgba(0,0,0,0)"
    ) {
      color = this.backgroundColor;
    }
    return color || "#ffffff";
  }
  updateParagraphOverlay(paragraphs?: HTMLElement[]) {
    let doc = this.getDocument();
    if (!doc || !doc.body) return;
    let overlay = doc.getElementById("kookit-paragraph-overlay");
    if (this.isParagraphMode !== "yes") {
      if (overlay) {
        overlay.parentNode?.removeChild(overlay);
      }
      return;
    }
    let list = paragraphs || this.getParagraphNodes();
    if (list.length === 0) {
      if (overlay) {
        overlay.parentNode?.removeChild(overlay);
      }
      return;
    }
    if (this.paragraphIndex >= list.length) {
      this.paragraphIndex = 0;
    }
    if (!overlay) {
      overlay = doc.createElement("div");
      overlay.id = "kookit-paragraph-overlay";
      overlay.style.cssText =
        "position:fixed;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;z-index:2147483000;pointer-events:none;text-align:center;transition:background-color 0.3s ease;";
      let content = doc.createElement("div");
      content.id = "kookit-paragraph-overlay-content";
      content.style.cssText =
        "max-width:50%;max-height:90%;overflow:hidden;text-align:center;transition:background-color 0.3s ease;" +
        (this.isMobile === "yes"
          ? "max-width:calc(100% - 40px);max-height:calc(100% - 40px);"
          : "");
      overlay.appendChild(content);
      doc.body.appendChild(overlay);
    }
    overlay.style.backgroundColor = this.getParagraphOverlayBackground(doc);
    let content = doc.getElementById("kookit-paragraph-overlay-content");
    if (!content) return;
    content.innerHTML = "";
    content.appendChild(list[this.paragraphIndex].cloneNode(true));
  }
  async handleParagraphChange(direction: number): Promise<boolean> {
    let list = this.getParagraphNodes();
    if (list.length === 0) return false;
    if (direction > 0) {
      if (this.paragraphIndex < list.length - 1) {
        this.paragraphIndex++;
      } else {
        await this.flipParagraphPage(1);
        return true;
      }
    } else {
      if (this.paragraphIndex > 0) {
        this.paragraphIndex--;
      } else {
        await this.flipParagraphPage(-1);
        return true;
      }
    }
    this.updateParagraphOverlay(list);
    return true;
  }
  async flipParagraphPage(direction: number) {
    this.paragraphSkipFlip = true;
    try {
      if (direction > 0) {
        await this.next();
      } else {
        await this.prev();
      }
      await new Promise((r) =>
        setTimeout(r, this.readerMode === "scroll" ? 400 : 150)
      );
    } finally {
      this.paragraphSkipFlip = false;
    }
    let list = this.getParagraphNodes();
    this.paragraphIndex = direction > 0 ? 0 : Math.max(0, list.length - 1);
    this.updateParagraphOverlay(list);
  }
  getReadingRulerStep() {
    return Math.max(1, Math.round(this.readingRulerLineHeight || 3));
  }
  getReadingRulerVisibleBounds(): { top: number; bottom: number } {
    let iframe = this.getIframe();
    let top = 0;
    let bottom = iframe ? iframe.clientHeight : 0;
    if (this.readerMode === "scroll" && this.element) {
      top = this.element.scrollTop;
      bottom = top + this.element.clientHeight;
    }
    return { top, bottom };
  }
  getReadingRulerColumnBounds(): { left: number; right: number } | null {
    if (this.readerMode !== "double") return null;
    let iframe = this.getIframe();
    if (!iframe) return null;
    const width = iframe.clientWidth;
    if (!width) return null;
    let section = Math.floor(width / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    const sectionWidth = Math.max(0, (width - gap) / 2);
    if (this.readingRulerColumn === 0) {
      return { left: 0, right: sectionWidth };
    }
    return { left: Math.min(width, sectionWidth + gap), right: width };
  }
  getReadingRulerLines(
    columnBounds?: { left: number; right: number } | null
  ): { top: number; bottom: number; left: number; right: number }[] {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !doc.body || !iframe) return [];
    if (this.isVertical()) return [];
    const view: any = doc.defaultView || window;
    const visible = this.getReadingRulerVisibleBounds();
    const visibleLeft = columnBounds ? columnBounds.left : 0;
    const visibleRight = columnBounds ? columnBounds.right : iframe.clientWidth;
    const allRects: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    }[] = [];
    const parentCache = new Map<Element, boolean>();
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let currentNode = walker.nextNode();
    while (currentNode) {
      const text = currentNode.textContent || "";
      if (text.trim()) {
        const parent = currentNode.parentElement;
        if (parent) {
          let parentVisible = parentCache.get(parent);
          if (parentVisible === undefined) {
            const style = view.getComputedStyle(parent);
            parentVisible =
              style.display !== "none" && style.visibility !== "hidden";
            parentCache.set(parent, parentVisible);
          }
          if (parentVisible) {
            const range = doc.createRange();
            range.selectNodeContents(currentNode);
            const rects = range.getClientRects();
            for (let index = 0; index < rects.length; index++) {
              const rect = rects[index];
              if (rect.height <= 0 || rect.width <= 0) continue;
              if (rect.bottom <= visible.top || rect.top >= visible.bottom)
                continue;
              if (rect.right <= visibleLeft || rect.left >= visibleRight)
                continue;
              allRects.push({
                top: rect.top,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
              });
            }
          }
        }
      }
      currentNode = walker.nextNode();
    }
    allRects.sort((a, b) => a.top - b.top || a.bottom - b.bottom);
    const lines: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    }[] = [];
    for (let index = 0; index < allRects.length; index++) {
      const rect = allRects[index];
      const last = lines[lines.length - 1];
      if (last && rect.top < last.bottom - 2) {
        last.bottom = Math.max(last.bottom, rect.bottom);
        last.left = Math.min(last.left, rect.left);
        last.right = Math.max(last.right, rect.right);
      } else {
        lines.push({
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
        });
      }
    }
    return lines;
  }
  getReadingRulerMaskColor(doc: Document): string {
    const alpha = Math.min(1, Math.max(0, this.readingRulerBackgroundOpacity));
    const base = this.getParagraphOverlayBackground(doc);
    const match = base.match(/rgba?\(([^)]+)\)/);
    if (match) {
      const parts = match[1]
        .split(/[\s,/]+/)
        .filter((item) => item !== "")
        .map(parseFloat);
      if (
        parts.length >= 3 &&
        parts.slice(0, 3).every((item) => !isNaN(item))
      ) {
        return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
      }
    }
    const hex = base.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(hex) || /^[0-9a-fA-F]{3}$/.test(hex)) {
      const full =
        hex.length === 3
          ? hex
              .split("")
              .map((item) => item + item)
              .join("")
          : hex;
      return `rgba(${parseInt(full.slice(0, 2), 16)},${parseInt(
        full.slice(2, 4),
        16
      )},${parseInt(full.slice(4, 6), 16)},${alpha})`;
    }
    return `rgba(0,0,0,${alpha})`;
  }
  updateReadingRulerOverlay(
    animate?: boolean,
    lines?: { top: number; bottom: number; left: number; right: number }[]
  ) {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !doc.body || !iframe) return;
    if (this.isReadingRuler !== "yes") {
      this.removeReadingRulerOverlay();
      return;
    }
    let windowEl = doc.getElementById("kookit-reading-ruler-window");
    let columnBounds = this.getReadingRulerColumnBounds();
    let lineList = lines || this.getReadingRulerLines(columnBounds);
    if (lineList.length === 0) {
      this.removeReadingRulerOverlay();
      return;
    }
    const step = this.getReadingRulerStep();
    const totalChunks = Math.ceil(lineList.length / step);
    if (this.readingRulerIndex >= totalChunks) {
      this.readingRulerIndex = totalChunks - 1;
    }
    if (this.readingRulerIndex < 0) {
      this.readingRulerIndex = 0;
    }
    const startIndex = this.readingRulerIndex * step;
    const endIndex = Math.min(startIndex + step, lineList.length);
    const visible = this.getReadingRulerVisibleBounds();
    const top = Math.max(visible.top, lineList[startIndex].top - 4);
    const bottom = Math.min(visible.bottom, lineList[endIndex - 1].bottom + 4);
    const offset = 16;
    const bounds = columnBounds || {
      left: 0,
      right: iframe.clientWidth,
    };
    let minLeft = lineList[startIndex].left;
    let maxRight = lineList[startIndex].right;
    for (let index = startIndex + 1; index < endIndex; index++) {
      minLeft = Math.min(minLeft, lineList[index].left);
      maxRight = Math.max(maxRight, lineList[index].right);
    }
    const left = Math.max(bounds.left, minLeft - offset);
    const width = Math.max(0, Math.min(bounds.right, maxRight + offset) - left);
    const position = this.readerMode === "scroll" ? "absolute" : "fixed";
    if (!windowEl) {
      windowEl = doc.createElement("div");
      windowEl.id = "kookit-reading-ruler-window";
      doc.body.appendChild(windowEl);
    }
    windowEl.style.cssText =
      `position:${position};left:${left}px;width:${width}px;top:${top}px;height:${Math.max(
        0,
        bottom - top
      )}px;border-radius:10px;border:1px solid rgba(128,128,128,0.5);` +
      `box-shadow:0 0 0 100000px ${this.getReadingRulerMaskColor(
        doc
      )};box-sizing:border-box;z-index:2147483000;pointer-events:none;` +
      `transition:${
        animate
          ? "top 0.3s ease, height 0.3s ease, left 0.3s ease, width 0.3s ease"
          : "none"
      };`;
  }
  removeReadingRulerOverlay() {
    let doc = this.getDocument();
    if (doc) {
      let windowEl = doc.getElementById("kookit-reading-ruler-window");
      if (windowEl && windowEl.parentNode) {
        windowEl.parentNode.removeChild(windowEl);
      }
    }
  }
  async handleReadingRulerChange(direction: number): Promise<boolean> {
    const columnBounds = this.getReadingRulerColumnBounds();
    const lines = this.getReadingRulerLines(columnBounds);
    if (lines.length === 0) return false;
    const step = this.getReadingRulerStep();
    const totalChunks = Math.ceil(lines.length / step);
    if (this.readingRulerIndex >= totalChunks) {
      this.readingRulerIndex = 0;
    }
    if (direction > 0) {
      if (this.readingRulerIndex < totalChunks - 1) {
        this.readingRulerIndex++;
      } else if (columnBounds && this.readingRulerColumn === 0) {
        this.readingRulerColumn = 1;
        this.readingRulerIndex = 0;
      } else {
        await this.flipReadingRulerPage(1);
        return true;
      }
    } else {
      if (this.readingRulerIndex > 0) {
        this.readingRulerIndex--;
      } else if (columnBounds && this.readingRulerColumn === 1) {
        this.readingRulerColumn = 0;
        this.readingRulerIndex = Number.MAX_SAFE_INTEGER;
      } else {
        await this.flipReadingRulerPage(-1);
        return true;
      }
    }
    this.updateReadingRulerOverlay(true, undefined);
    return true;
  }
  async flipReadingRulerPage(direction: number) {
    this.readingRulerSkipFlip = true;
    try {
      if (direction > 0) {
        await this.next();
      } else {
        await this.prev();
      }
      await new Promise((r) =>
        setTimeout(r, this.readerMode === "scroll" ? 400 : 150)
      );
    } finally {
      this.readingRulerSkipFlip = false;
    }
    this.readingRulerIndex = direction > 0 ? 0 : Number.MAX_SAFE_INTEGER;
    this.readingRulerColumn =
      direction > 0 ? 0 : this.readerMode === "double" ? 1 : 0;
    this.updateReadingRulerOverlay();
  }
  extractSpeedReadingWords(): string[] {
    let doc = this.getDocument();
    if (!doc || !doc.body || !this.element) return [];
    let texts = getVisibleText(this.element, this.readerMode, doc);
    let words: string[] = [];
    for (let index = 0; index < texts.length; index++) {
      words = words.concat(segmentSpeedReadingWords(texts[index]));
    }
    return words;
  }
  getSpeedReadingPageHeight(): number {
    return (this.element && this.element.clientHeight) || 600;
  }
  getSpeedReadingTextColor(doc: Document): string {
    const base = this.getParagraphOverlayBackground(doc);
    const match = base.match(/rgba?\(([^)]+)\)/);
    if (match) {
      const parts = match[1]
        .split(/[\s,/]+/)
        .filter((item) => item !== "")
        .map(parseFloat);
      if (parts.length >= 3 && parts.slice(0, 3).every((item) => !isNaN(item))) {
        const luminance =
          0.299 * parts[0] + 0.587 * parts[1] + 0.114 * parts[2];
        return luminance > 128 ? "#333333" : "#f5f5f5";
      }
    }
    const hex = base.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(hex) || /^[0-9a-fA-F]{3}$/.test(hex)) {
      const full =
        hex.length === 3
          ? hex
              .split("")
              .map((item) => item + item)
              .join("")
          : hex;
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      return luminance > 128 ? "#333333" : "#f5f5f5";
    }
    return this.isDarkMode === "yes" ? "#f5f5f5" : "#333333";
  }
  updateSpeedReadingOverlay() {
    let doc = this.getDocument();
    if (!doc || !doc.body) return;
    let overlay = doc.getElementById("kookit-speed-reading-overlay");
    if (this.isSpeedReading !== "yes") {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (overlay === this.speedReadingOverlayEl) {
        this.speedReadingOverlayEl = null;
      }
      return;
    }
    if (!overlay) {
      overlay = doc.createElement("div");
      overlay.id = "kookit-speed-reading-overlay";
      this.speedReadingOverlayEl = overlay;
      const pageHeight = this.getSpeedReadingPageHeight();
      const isScrollMode = this.readerMode === "scroll";
      const position = isScrollMode ? "absolute" : "fixed";
      const visibilityTop = isScrollMode
        ? convertStyleNum(this.element.scrollTop)
        : 0;
      const height = isScrollMode
        ? this.element.clientHeight
        : doc.defaultView
          ? doc.defaultView.innerHeight
          : pageHeight;
      overlay.style.cssText =
        `position:${position};left:0;width:100%;top:${isScrollMode ? visibilityTop : 0}px;` +
        `height:${Math.max(0, height)}px;z-index:2147483000;display:flex;flex-direction:column;` +
        `align-items:center;justify-content:center;padding-bottom:${Math.round(
          pageHeight * 0.2
        )}px;user-select:none;transition:background-color 0.3s ease;`;
      overlay.style.backgroundColor = this.getParagraphOverlayBackground(doc);

      let wordArea = doc.createElement("div");
      wordArea.id = "kookit-speed-reading-word-area";
      wordArea.style.cssText =
        "position:relative;display:flex;align-items:baseline;width:80%;max-width:900px;font-weight:600;line-height:1.6;";
      let left = doc.createElement("span");
      left.id = "kookit-speed-reading-word-left";
      left.style.cssText = "flex:1;text-align:right;white-space:pre;overflow:visible;";
      let pivot = doc.createElement("span");
      pivot.id = "kookit-speed-reading-word-pivot";
      pivot.style.cssText =
        "color:#ff3b30;white-space:pre;position:relative;";
      let right = doc.createElement("span");
      right.id = "kookit-speed-reading-word-right";
      right.style.cssText = "flex:1;text-align:left;white-space:pre;overflow:visible;";
      let tickTop = doc.createElement("span");
      tickTop.id = "kookit-speed-reading-tick-top";
      let tickBottom = doc.createElement("span");
      tickBottom.id = "kookit-speed-reading-tick-bottom";
      const textColor = this.getSpeedReadingTextColor(doc);
      const fontPx = Math.max(
        28,
        Math.min(72, Math.round(pageHeight * 0.08))
      );
      const tickCss =
        `position:absolute;left:50%;transform:translateX(-50%);width:2px;height:${Math.round(
          fontPx * 0.3
        )}px;background:rgba(128,128,128,0.6);`;
      tickTop.style.cssText = tickCss + `top:-${Math.round(fontPx * 0.45)}px;`;
      tickBottom.style.cssText =
        tickCss + `bottom:-${Math.round(fontPx * 0.45)}px;`;
      wordArea.appendChild(left);
      wordArea.appendChild(pivot);
      wordArea.appendChild(right);
      wordArea.appendChild(tickTop);
      wordArea.appendChild(tickBottom);
      wordArea.style.fontSize = fontPx + "px";
      wordArea.style.color = textColor;

      let status = doc.createElement("div");
      status.id = "kookit-speed-reading-status";
      status.style.cssText =
        "display:none;font-size:" +
        Math.round(fontPx * 0.6) +
        "px;opacity:0.7;";
      status.textContent = "The End";
      status.style.color = textColor;

      let toggle = doc.createElement("div");
      toggle.id = "kookit-speed-reading-toggle";
      toggle.style.cssText =
        `margin-top:${Math.round(fontPx * 0.8)}px;width:56px;height:56px;border-radius:50%;` +
        `display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:22px;` +
        `border:1px solid rgba(128,128,128,0.5);color:${textColor};`;
      toggle.textContent = "⏸";

      overlay.appendChild(wordArea);
      overlay.appendChild(status);
      overlay.appendChild(toggle);
      doc.body.appendChild(overlay);

      toggle.addEventListener("click", (event: any) => {
        event.stopPropagation();
        this.toggleSpeedReading();
      });
      overlay.addEventListener("click", (event: any) => {
        event.stopPropagation();
        this.toggleSpeedReading();
      });
      // 阻止遮罩上的触摸/滚动事件冒泡到翻页处理器
      const blockEvent = (event: any) => {
        event.stopPropagation();
      };
      overlay.addEventListener("touchstart", blockEvent, { passive: false });
      overlay.addEventListener("touchmove", blockEvent, { passive: false });
      overlay.addEventListener("touchend", blockEvent, { passive: false });
      overlay.addEventListener("wheel", blockEvent, { passive: false });
      overlay.addEventListener("mousedown", blockEvent, false);
      overlay.addEventListener("dblclick", blockEvent, false);
    } else if (overlay !== this.speedReadingOverlayEl) {
      this.speedReadingOverlayEl = overlay;
    }
    if (this.readerMode === "scroll" && this.element) {
      // scroll 模式下遮罩需要跟随外层滚动位置
      overlay.style.top = convertStyleNum(this.element.scrollTop) + "px";
      overlay.style.height = this.element.clientHeight + "px";
    }
  }
  removeSpeedReadingOverlay() {
    let doc = this.getDocument();
    if (!doc) return;
    let overlay = doc.getElementById("kookit-speed-reading-overlay");
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    this.speedReadingOverlayEl = null;
    if (this.speedReadingTimer) {
      clearTimeout(this.speedReadingTimer);
      this.speedReadingTimer = null;
    }
  }
  isSpeedReadingOverlayValid(doc: Document): boolean {
    if (
      !this.speedReadingOverlayEl ||
      doc.getElementById("kookit-speed-reading-overlay") !==
        this.speedReadingOverlayEl
    ) {
      return false;
    }
    return true;
  }
  updateSpeedReadingToggleIcon() {
    let doc = this.getDocument();
    if (!doc) return;
    let toggle = doc.getElementById("kookit-speed-reading-toggle");
    if (!toggle) return;
    toggle.textContent = this.speedReadingPlaying ? "⏸" : "▶";
  }
  showSpeedReadingEndState() {
    let doc = this.getDocument();
    if (!doc) return;
    let wordArea = doc.getElementById("kookit-speed-reading-word-area");
    let status = doc.getElementById("kookit-speed-reading-status");
    if (wordArea) wordArea.style.display = "none";
    if (status) status.style.display = "block";
  }
  showSpeedReadingWordArea() {
    let doc = this.getDocument();
    if (!doc) return;
    let wordArea = doc.getElementById("kookit-speed-reading-word-area");
    let status = doc.getElementById("kookit-speed-reading-status");
    if (wordArea) wordArea.style.display = "flex";
    if (status) status.style.display = "none";
  }
  renderSpeedReadingWord() {
    let doc = this.getDocument();
    if (!doc) return;
    this.updateSpeedReadingOverlay();
    this.showSpeedReadingWordArea();
    let left = doc.getElementById("kookit-speed-reading-word-left");
    let pivot = doc.getElementById("kookit-speed-reading-word-pivot");
    let right = doc.getElementById("kookit-speed-reading-word-right");
    if (!left || !pivot || !right) return;
    let word = this.speedReadingWords[this.speedReadingIndex] || "";
    let chars = Array.from(word);
    if (chars.length === 0) {
      left.textContent = "";
      pivot.textContent = "";
      right.textContent = "";
      this.showSpeedReadingEndState();
      return;
    }
    let orp = Math.min(getSpeedReadingORPIndex(word), chars.length - 1);
    left.textContent = chars.slice(0, orp).join("");
    pivot.textContent = chars[orp];
    right.textContent = chars.slice(orp + 1).join("");
  }
  startSpeedReading() {
    if (this.isSpeedReading !== "yes" || this.speedReadingPlaying) return;
    let doc = this.getDocument();
    if (!doc) return;
    this.speedReadingPlaying = true;
    this.updateSpeedReadingOverlay();
    this.updateSpeedReadingToggleIcon();
    if (this.speedReadingWords.length === 0) {
      this.speedReadingWords = this.extractSpeedReadingWords();
      this.speedReadingIndex = 0;
    }
    if (this.speedReadingWords.length === 0) {
      this.pauseSpeedReading();
      this.showSpeedReadingEndState();
      return;
    }
    this.renderSpeedReadingWord();
    this.scheduleNextSpeedReadingWord();
  }
  pauseSpeedReading() {
    this.speedReadingPlaying = false;
    if (this.speedReadingTimer) {
      clearTimeout(this.speedReadingTimer);
      this.speedReadingTimer = null;
    }
    this.updateSpeedReadingToggleIcon();
  }
  toggleSpeedReading() {
    let doc = this.getDocument();
    if (!doc) return;
    if (this.speedReadingPlaying) {
      this.pauseSpeedReading();
    } else {
      this.startSpeedReading();
    }
  }
  scheduleNextSpeedReadingWord() {
    if (this.speedReadingTimer) {
      clearTimeout(this.speedReadingTimer);
      this.speedReadingTimer = null;
    }
    if (!this.speedReadingPlaying) return;
    let doc = this.getDocument();
    if (!doc || !this.isSpeedReadingOverlayValid(doc)) return;
    const word = this.speedReadingWords[this.speedReadingIndex] || "";
    const wpm = this.speedReadingSpeed || 300;
    const delay = getSpeedReadingWordDelay(word, wpm);
    this.speedReadingTimer = setTimeout(async () => {
      this.speedReadingTimer = null;
      let currentDoc = this.getDocument();
      if (
        !this.speedReadingPlaying ||
        !currentDoc ||
        !this.isSpeedReadingOverlayValid(currentDoc)
      ) {
        return;
      }
      await this.showNextSpeedReadingWord();
    }, delay);
  }
  async showNextSpeedReadingWord() {
    if (!this.speedReadingPlaying) return;
    if (this.speedReadingIndex < this.speedReadingWords.length - 1) {
      this.speedReadingIndex++;
      this.renderSpeedReadingWord();
      this.scheduleNextSpeedReadingWord();
      return;
    }
    // 当前页单词展示完毕，自动翻页
    await this.flipSpeedReadingPage(1);
  }
  getSpeedReadingPageKey(): string {
    let progress = this.getProgress();
    return JSON.stringify([
      this.tempLocation.chapterDocIndex,
      progress?.currentPage,
      progress?.totalPage,
    ]);
  }
  async flipSpeedReadingPage(direction: number) {
    let doc = this.getDocument();
    if (!doc) {
      this.pauseSpeedReading();
      return;
    }
    this.speedReadingSkipFlip = true;
    try {
      let attempts = 0;
      while (attempts < 5 && this.speedReadingPlaying) {
        const beforeKey = this.getSpeedReadingPageKey();
        if (direction > 0) {
          await this.next();
        } else {
          await this.prev();
        }
        await new Promise((r) =>
          setTimeout(r, this.readerMode === "scroll" ? 400 : 150)
        );
        const afterKey = this.getSpeedReadingPageKey();
        this.speedReadingWords = this.extractSpeedReadingWords();
        if (this.speedReadingWords.length > 0) {
          this.speedReadingIndex = direction > 0 ? 0 : this.speedReadingWords.length - 1;
          this.updateSpeedReadingOverlay();
          this.renderSpeedReadingWord();
          break;
        }
        if (beforeKey === afterKey) {
          // 页面没有变化，说明已经到达书籍末尾，暂停速读
          this.pauseSpeedReading();
          this.speedReadingWords = [];
          this.speedReadingIndex = 0;
          this.showSpeedReadingEndState();
          return;
        }
        attempts++;
      }
    } finally {
      this.speedReadingSkipFlip = false;
    }
    this.scheduleNextSpeedReadingWord();
  }
  handleSpeedReadingRendered() {
    if (this.isSpeedReading !== "yes") {
      this.pauseSpeedReading();
      this.removeSpeedReadingOverlay();
      return;
    }
    let doc = this.getDocument();
    if (!doc || !doc.body) return;
    this.speedReadingWords = this.extractSpeedReadingWords();
    this.speedReadingIndex = 0;
    this.updateSpeedReadingOverlay();
    this.updateSpeedReadingToggleIcon();
    if (this.speedReadingWords.length === 0) {
      this.showSpeedReadingEndState();
      if (this.speedReadingTimer) {
        clearTimeout(this.speedReadingTimer);
        this.speedReadingTimer = null;
      }
      return;
    }
    this.showSpeedReadingWordArea();
    this.renderSpeedReadingWord();
    if (!this.speedReadingAutoStarted) {
      // 首次渲染自动开始播放
      this.speedReadingAutoStarted = true;
      this.startSpeedReading();
    } else if (this.speedReadingPlaying) {
      this.scheduleNextSpeedReadingWord();
    }
  }
  async prev() {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) {
      return;
    }
    if (this.isSpeedReading === "yes" && !this.speedReadingSkipFlip) {
      // 速读模式下禁用鼠标、快捷键等外部触发的翻页
      return;
    }
    if (
      this.isReadingRuler === "yes" &&
      this.isSpeedReading !== "yes" &&
      !this.readingRulerSkipFlip
    ) {
      const handled = await this.handleReadingRulerChange(-1);
      if (handled) return;
    }
    if (
      this.isParagraphMode === "yes" &&
      this.isSpeedReading !== "yes" &&
      !this.paragraphSkipFlip
    ) {
      const handled = await this.handleParagraphChange(-1);
      if (handled) return;
    }
    if (
      (this.readerMode === "scroll" &&
        convertStyleNum(this.element.scrollTop) === 0) ||
      (this.isVertical() && convertStyleNum(doc.body.scrollTop) === 0) ||
      (this.readerMode !== "scroll" &&
        !this.isVertical() &&
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
        } else if (this.isVertical()) {
          doc.body.scrollTo(0, doc.body.scrollHeight);
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
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) {
      return;
    }
    if (this.isSpeedReading === "yes" && !this.speedReadingSkipFlip) {
      // 速读模式下禁用鼠标、快捷键等外部触发的翻页
      return;
    }
    if (
      this.isReadingRuler === "yes" &&
      this.isSpeedReading !== "yes" &&
      !this.readingRulerSkipFlip
    ) {
      const handled = await this.handleReadingRulerChange(1);
      if (handled) return;
    }
    if (
      this.isParagraphMode === "yes" &&
      this.isSpeedReading !== "yes" &&
      !this.paragraphSkipFlip
    ) {
      const handled = await this.handleParagraphChange(1);
      if (handled) return;
    }
    if (
      (this.isVertical() &&
        Math.abs(
          doc.body.scrollHeight -
            convertStyleNum(doc.body.scrollTop) -
            doc.body.clientHeight
        ) < 50) ||
      (Math.abs(
        doc.body.scrollWidth -
          convertStyleNum(doc.body.scrollLeft) -
          doc.body.clientWidth
      ) < 50 &&
        this.readerMode !== "scroll" &&
        !this.isVertical()) ||
      (Math.abs(
        this.element.scrollHeight -
          convertStyleNum(this.element.scrollTop) -
          this.element.clientHeight
      ) < 20 &&
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
      return;
    } else if (this.readerMode === "scroll") {
      // scroll readerMode under normal condition
      if (
        Math.abs(
          this.element.scrollHeight -
            convertStyleNum(this.element.scrollTop) -
            this.element.clientHeight
        ) -
          (this.element.clientHeight - 50) <
          20 &&
        Math.abs(
          this.element.scrollHeight -
            convertStyleNum(this.element.scrollTop) -
            this.element.clientHeight
        ) > 20
      ) {
        this.element.scrollTo({
          left: 0,
          top: this.element.scrollHeight - 20,
          behavior: "smooth",
        });
      } else {
        this.element.scrollBy({
          left: 0,
          top: this.element.clientHeight - 50,
          behavior: "smooth",
        });
      }
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
  async slideTo(direction: string) {
    let doc = this.getDocument();
    if (!doc) return;
    let section = Math.floor(this.element.clientWidth / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    slideAnimateTo(direction, this.format, doc, doc, this.element, this, gap);
  }
  async prevChapter() {
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
  async visibleText() {
    let doc = this.getDocument();
    if (!doc) return "";
    return getVisibleText(this.element, this.readerMode, doc);
  }
  async audioText() {
    let doc = this.getDocument();
    if (!doc) return [];
    let audioTexts = await getAudioText(
      this.element,
      this.readerMode,
      doc,
      false
    );
    return audioTexts;
  }
  async getRestAudioText(count: number) {
    const currentIndex = parseInt(this.tempLocation.chapterDocIndex || "0");
    const result: { chapterDocIndex: number; audioText: string[] }[] = [];
    const startIndex = currentIndex + 1;
    const endIndex = Math.min(startIndex + count, this.chapterDocList.length);

    for (let i = startIndex; i < endIndex; i++) {
      const chapterText = await handleOneChapterDoc(
        this.chapterDocList[i].text,
        true
      );
      if (!chapterText) continue;
      const chapterDoc = new DOMParser().parseFromString(
        chapterText,
        "text/html"
      );
      const audioText = getAudioText(
        this.element,
        this.readerMode,
        chapterDoc,
        true
      );
      result.push({
        chapterDocIndex: i,
        audioText: audioText.filter((s): s is string => !!s),
      });
    }
    return result;
  }
  async chapterText() {
    let doc = this.getDocument();
    if (!doc) return "";
    return doc.body.textContent || "";
  }
  async getImageList(chapterDocIndex?: number): Promise<string[]> {
    if (this.format === "PDF") return [];
    let urls: string[];
    if (chapterDocIndex === undefined || chapterDocIndex === null) {
      const doc = this.getDocument();
      if (!doc) return [];
      urls = collectChapterImageUrls(doc.body);
    } else {
      if (
        chapterDocIndex < 0 ||
        chapterDocIndex > this.chapterDocList.length - 1
      ) {
        return [];
      }
      const chapterText = await handleOneChapterDoc(
        this.chapterDocList[chapterDocIndex].text,
        false
      );
      if (!chapterText) return [];
      const chapterDoc = new DOMParser().parseFromString(
        chapterText,
        "text/html"
      );
      urls = collectChapterImageUrls(chapterDoc.body);
    }
    if (this.isMobile !== "yes") {
      return urls;
    }
    return Promise.all(
      urls.map(async (url) => {
        if (!url.startsWith("blob:")) return url;
        try {
          return await blobUrlToBase64(url);
        } catch {
          return url;
        }
      })
    );
  }
  autoScroll(rate: number, isStart: string) {
    let doc = this.getDocument();
    if (!doc) return;
    if (this.scrollTimer) {
      cancelAnimationFrame(this.scrollTimer);
      this.scrollTimer = null;
    }
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
    if (isStart === "no" || this.readerMode !== "scroll") {
      return;
    }

    let accumulatedScroll = 0; // 累积滚动量
    let frameCount = 0; // 帧计数器

    const scrollStep = () => {
      accumulatedScroll += rate;
      frameCount++;

      // 对于慢速滚动，使用更精细的控制
      if (Math.abs(rate) < 1) {
        // 每隔一定帧数或累积到足够像素时滚动
        const shouldScroll =
          Math.abs(accumulatedScroll) >= 0.5 ||
          frameCount % Math.max(1, Math.floor(30 / Math.abs(rate))) === 0;

        if (shouldScroll && Math.abs(accumulatedScroll) >= 0.1) {
          const scrollAmount = Math.round(accumulatedScroll * 10) / 10; // 保留一位小数
          this.element.scrollBy({
            left: 0,
            top: scrollAmount,
            behavior: "auto",
          });
          accumulatedScroll = 0; // 重置累积量
          frameCount = 0; // 重置帧计数
        }
      } else {
        // 快速滚动时保持原有逻辑
        if (Math.abs(accumulatedScroll) >= 1) {
          const scrollAmount = Math.floor(accumulatedScroll);
          this.element.scrollBy({
            left: 0,
            top: scrollAmount,
            behavior: "auto",
          });
          accumulatedScroll -= scrollAmount; // 减去已滚动的量
        }
      }

      this.scrollTimer = requestAnimationFrame(scrollStep);
    };
    this.scrollTimer = requestAnimationFrame(scrollStep);

    this.recordTimer = setInterval(() => {
      if (
        this.readerMode === "scroll" &&
        Math.abs(
          this.element.scrollHeight -
            this.element.scrollTop -
            this.element.clientHeight
        ) < 10
      ) {
        this.nextChapter();
      }
      this.record();
    }, 3000);
  }
  autoScrollIOS(rate: number, isStart: string) {
    let doc = this.getDocument();
    if (!doc) return;
    if (this.scrollTimer) {
      clearInterval(this.scrollTimer);
      this.scrollTimer = null;
    }
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
    if (isStart === "no" || this.readerMode !== "scroll") {
      return;
    }

    let accumulatedScroll = 0; // 累积滚动量
    let realScrollTop = this.element.scrollTop; // 记录真实滚动位置
    // this.scrollTimer = requestAnimationFrame(scrollStep);
    this.scrollTimer = setInterval(() => {
      accumulatedScroll += rate;
      if (doc) {
        doc.body.style.transform = `translateY(-${accumulatedScroll}px)`;
        // 每隔一定距离同步真实滚动位置，避免transform累积过大
        if (Math.abs(accumulatedScroll) >= 50) {
          // 重置transform
          doc.body.style.transform = "translateY(0px)";

          // 更新真实滚动位置
          realScrollTop += accumulatedScroll;
          this.element.scrollTo({
            left: 0,
            top: realScrollTop,
            behavior: "auto",
          });

          // 重置累积量
          accumulatedScroll = 0;
        }
      }
    }, 30);

    this.recordTimer = setInterval(() => {
      if (
        this.readerMode === "scroll" &&
        Math.abs(
          this.element.scrollHeight -
            this.element.scrollTop -
            this.element.clientHeight
        ) < 10
      ) {
        this.nextChapter();
      }
      this.record();
    }, 3000);
  }
  highlightSearchNode(text: string, style: string) {
    let doc = this.getDocument();
    if (!doc) return;
    handleHighlightSearchNode(text, style, doc);
  }
  highlightAudioNode(text: string, style: string) {
    let doc = this.getDocument();
    if (!doc) return;
    handleHighlightAudioNode(text, style, doc, this.element, this.readerMode);
  }
  async doSearch(keyword: string) {
    if (this.format === "PDF") {
      return await getPDFSearchResult(keyword, this.chapterDocList);
    } else {
      return await getSearchResult(keyword, this.chapterDocList);
    }
  }
  getProgress() {
    let doc = this.getDocument();
    if (!doc) return;
    return {
      ...progressInfo(this.readerMode, doc, this.element),
      percentage: this.tempLocation.percentage,
    } as any;
  }
  async record() {
    if (this.animation !== "none" && this.isMobile !== "yes") {
      await new Promise((r) => setTimeout(r, 1000));
    }
    let doc = this.getDocument();
    if (!doc) return;
    await handleRecord(
      this.element,
      this.readerMode,
      this.flatChapter(this.chapterList),
      this.chapterDocList,
      this.tempLocation,
      doc,
      null
    );
    this.trigger("page-changed");
  }
  getPosition() {
    return this.tempLocation;
  }
  async getBatchTransTexts() {
    let restTexts: string[] = (await this.audioText()) as string[];

    restTexts = restTexts.slice(0, 200);
    //同时确保总字数不超过10000字
    let totalLength = 0;
    restTexts = restTexts.filter((item) => {
      totalLength += item.length;
      return totalLength <= 10000;
    });
    restTexts = restTexts.filter(
      (item) => !this.transMap[item] || !this.transMap[item].text
    );
    return restTexts.filter((item) => item.trim().length > 0);
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
      this.chapterDocList,
      this.tempLocation,
      doc,
      selectedElement
    );
    return this.tempLocation;
  }
  setStyle(css: string) {
    let doc = this.getDocument();
    if (!doc) return;

    const styleId = "kookit-default-style";
    let existingStyle = doc.head.querySelector(`style#${styleId}`);

    if (existingStyle) {
      // 如果已存在相同 id 的 style，则替换其内容
      existingStyle.innerHTML = css;
    } else {
      // 如果不存在，则创建新的 style 元素
      var defaultStyle = document.createElement("style");
      defaultStyle.id = styleId;
      defaultStyle.innerHTML = css;
      doc.head.appendChild(defaultStyle);
    }
  }
  async getHighlightCoords() {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    let charRange = rangy.getSelection(iframe).saveCharacterRanges(doc.body)[0];
    return charRange;
  }
  async renderHighlighters(notes: any[], handleNoteClick: any) {
    notes = notes.reverse();
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    clearHighlight(doc);

    // Use batch API: resolve all character ranges on clean DOM first,
    // then apply all inline highlights. This prevents earlier highlights
    // from shifting character offsets for later ones.
    const batchItems = notes.map((item) => ({
      range: JSON.parse(item.range),
      colorCode: item.color,
      noteKey: item.key,
      isNote: item.notes !== "",
      noteContent: item.notes || "",
    }));

    try {
      showNoteHighlightBatch(
        batchItems,
        handleNoteClick,
        doc,
        iframe,
        this.isMobile === "yes"
      );
    } catch (e) {
      console.error(
        e,
        "Exception has been caught when restore character ranges."
      );
    }
  }
  removeOneNote(key: string, chapterDocIndex: number) {
    let doc = this.getDocument();
    if (!doc) return;
    // Remove note icon elements for this key
    const icons = doc.querySelectorAll(
      ".kookit-note-icon[data-key='" + key + "']"
    );
    for (let index = 0; index < icons.length; index++) {
      icons[index].parentNode?.removeChild(icons[index]);
    }
    // Unwrap inline highlight spans for this key (restore original text)
    const elements = doc.querySelectorAll(
      "span.kookit-note[data-key='" + key + "']"
    );
    for (let index = 0; index < elements.length; index++) {
      const element = elements[index];
      const parent = element.parentNode;
      if (!parent) continue;
      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
      parent.normalize();
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
      iframe,
      item.notes !== "",
      this.isMobile === "yes",
      item.notes || ""
    );
  }

  addPageAnimation = (backgroundColor?: string) => {
    if (this.animation !== "mimical") return;
    const progress = this.getProgress();
    if (!progress?.totalPage) return;
    const pageAnimation = addPageAnimation(
      progress.totalPage,
      this.isDarkMode,
      backgroundColor || this.backgroundColor,
      Math.max(0, Math.floor(progress.currentPage || 1) - 1)
    );
    if (!pageAnimation) return;
    this.flipToNextPage = pageAnimation.flipToNextPage;
    this.flipToPrevPage = pageAnimation.flipToPrevPage;
    this.mouseDownHandler = pageAnimation.mouseDownHandler;
    this.mouseUpHandler = pageAnimation.mouseUpHandler;
    this.mouseMoveHandler = pageAnimation.mouseMoveHandler;
  };
  async displayFontBase64(
    fontName: string,
    fontBase64: string,
    fontFormat: string,
    fontType: string
  ) {
    let doc = this.getDocument();
    if (!doc || fontBase64.length === 0) return;
    const font = new FontFace(
      fontName,
      `url(data:font/${fontType};charset=utf-8;base64,${fontBase64})`
    );
    let loadedFont = await font.load();
    // 将加载的字体添加到文档的字体集合中
    document.fonts.add(loadedFont);
    const fontFaceCSS =
      "@font-face {" +
      "  font-family: '" +
      fontName +
      "';" +
      "  src: url('data:font/" +
      fontType +
      ";charset=utf-8;base64," +
      fontBase64 +
      "') format('" +
      fontFormat +
      "');" +
      "}";
    const styleElement = document.createElement("style");
    styleElement.type = "text/css";
    styleElement.appendChild(document.createTextNode(fontFaceCSS));
    doc.head.appendChild(styleElement);
  }
  async displayFontUrl(fontName: string, fontUrl: string) {
    let doc = this.getDocument();
    if (!doc || fontUrl.length === 0) return;
    // 使用 FontFace API 创建字体
    const font = new FontFace(fontName, `url(${fontUrl})`);

    // 加载字体并监听加载完成事件
    let loadedFont = await font.load();
    // 将加载的字体添加到文档的字体集合中
    document.fonts.add(loadedFont);
    const fontFaceCSS =
      "@font-face {" +
      "  font-family: '" +
      fontName +
      "';" +
      "  src: url('" +
      fontUrl +
      "') format('truetype');" +
      "}";
    const styleElement = document.createElement("style");
    styleElement.type = "text/css";
    styleElement.appendChild(document.createTextNode(fontFaceCSS));
    doc.head.appendChild(styleElement);
  }
  getAllDocuments() {
    let doc = this.getDocument();
    if (!doc) return [];
    if (this.format !== "PDF" && !this.format?.startsWith("CB")) {
      return [doc];
    }
    let iframes = doc.querySelectorAll("iframe");
    let documents: Document[] = [];
    iframes.forEach((iframe) => {
      let iframeDoc = (iframe as HTMLIFrameElement).contentDocument;
      if (iframeDoc) {
        documents.push(iframeDoc);
      }
    });
    return [doc, ...documents];
  }
  getAllIframes() {
    let iframe = this.getIframe();
    if (!iframe) return [];
    if (this.format !== "PDF" && !this.format?.startsWith("CB")) {
      return [iframe];
    }
    let doc = this.getDocument();
    if (!doc) return [];
    let iframes = doc.querySelectorAll("iframe");
    let iframeElements: HTMLIFrameElement[] = [];
    iframes.forEach((iframe) => {
      let iframeElement = iframe as HTMLIFrameElement;
      iframeElements.push(iframeElement);
    });
    return [iframe, ...iframeElements];
  }
  addTouchEvent(isAndroid: string, touchControlRule: any) {
    let docs = this.getAllDocuments();
    let iframes = this.getAllIframes();
    for (let index = 0; index < docs.length; index++) {
      const doc = docs[index];
      const iframe = iframes[index];
      if (!doc || !iframe) continue;
      let iframeId = iframe.id;
      if (this.touchEventSet[iframeId]) {
        continue;
      }
      this.touchEventSet[iframeId] = true;
      if (isAndroid === "yes") {
        addAndroidTouchEvent(
          doc,
          iframe,
          this.element,
          this.readerMode,
          this.animation,
          this.format,
          touchControlRule,
          this
        );
      } else {
        addAppleTouchEvent(
          doc,
          iframe,
          this.element,
          this.readerMode,
          this.animation,
          this.format,
          touchControlRule,
          this
        );
      }
    }
  }
  clearSelection() {
    let iframes = this.getAllIframes();
    for (let index = 0; index < iframes.length; index++) {
      const iframe = iframes[index];
      if (!iframe) continue;
      let iWin: any =
        iframe.contentWindow || iframe.contentDocument?.defaultView;
      if (!iWin || !iWin.getSelection()) return;
      iWin.getSelection()?.empty();
    }
  }
  getTargetHref(event: any) {
    let href = "";
    if (!event || !event.target) return href;
    if (event.target.innerText && event.target.innerText.startsWith("http")) {
      href = event.target.innerText;
    }
    // if (event.target.tagName === "IMG") {
    //   return href;
    // }
    let currentElement = event.target;
    while (currentElement && currentElement.tagName !== "BODY") {
      if (currentElement.getAttribute) {
        const elementHref = currentElement.getAttribute("href");

        if (elementHref) {
          href = elementHref || "";
          break;
        }
      }
      currentElement = currentElement.parentNode;
    }

    return href;
  }
  async handleLinkJump(
    href: string,
    event: any
  ): Promise<{
    handled: boolean;
    href?: string;
    external?: boolean;
    isShowMenu?: boolean;
    isJump?: boolean;
    node?: any;
  }> {
    let doc = this.getDocument();
    if (!doc) return { handled: false };
    if (
      href &&
      this.format === "MOBI" &&
      (href.startsWith("kindle:") || href.indexOf("filepos") > -1)
    ) {
      let chapterInfo = this.resolveChapter(href);
      if (chapterInfo) {
        await this.goToChapter(
          chapterInfo.index,
          chapterInfo.href,
          chapterInfo.label
        );
        return { handled: true };
      }
      let result = await this.book.resolveHref(href);
      let chapterDocIndex = this.tempLocation.chapterDocIndex;
      if (result.index === parseInt(chapterDocIndex)) {
        let element = result.anchor(doc);
        if (!element) return { handled: false };
        let id = element.getAttribute("id") || "";
        result = { ...result, id };
      }
      if (!result.anchor) {
        return { handled: false };
      }
      let currentPosition = this.getPosition();
      if (result.index === parseInt(currentPosition.chapterDocIndex)) {
        let node = result.anchor(doc);
        if (node) {
          href = "#" + node.getAttribute("id");
        }
      } else {
        if (isElementFootnote(event.target)) {
          let blob = await fetch(
            await this.chapterDocList[result.index].text.load()
          ).then((r) => r.blob());
          let chapterText = await blob.text();
          let node = result.anchor(
            new DOMParser().parseFromString(chapterText, "text/html")
          );
          if (!node) {
            return { handled: false };
          }
          return {
            handled: true,
            isShowMenu: true,
            isJump: false,
            href: "",
            node: node,
          };
        }

        return { handled: true };
      }
    }
    if (
      href &&
      href.indexOf("../") === -1 &&
      (href.indexOf("http") === 0 || href.indexOf("mailto") === 0) &&
      href.indexOf("OEBPF") === -1 &&
      href.indexOf("OEBPS") === -1 &&
      href.indexOf("footnote") === -1 &&
      href.indexOf("blob") === -1 &&
      href.indexOf("data:application") === -1
    ) {
      // openExternalUrl(href);
      return { handled: true, href: href, external: true };
    } else if (href && this.resolveChapter(href)) {
      let chapterInfo = this.resolveChapter(href);
      if (!chapterInfo) return { handled: false };
      await this.goToChapter(
        chapterInfo.index,
        chapterInfo.href,
        chapterInfo.label
      );
      return { handled: true };
    } else if (href && href.indexOf("#") > -1) {
      let id = href.split("#").reverse()[0];
      let node = doc.body.querySelector("#" + CSS.escape(id));
      let rect = event.target.getBoundingClientRect();
      let isJump = false;
      if (!node || event.target === node || node.contains(event.target)) {
        if (href.indexOf("#") !== 0) {
          while (href.startsWith(".")) {
            href = href.substring(1);
          }
          let chapterInfo = this.resolveChapter(href.split("#")[0]);
          if (!chapterInfo) return { handled: false };

          if (isElementFootnote(event.target)) {
            let blob = await fetch(
              await this.chapterDocList[chapterInfo.index].text.load()
            ).then((r) => r.blob());
            let chapterText = await blob.text();
            node = new DOMParser()
              .parseFromString(chapterText, "text/html")
              .body.querySelector("#" + CSS.escape(id));
            if (!node) {
              return { handled: false };
            }
            return {
              handled: true,
              isShowMenu: true,
              isJump: false,
              href: "",
              node: node,
            };
          } else {
            await this.goToChapter(
              chapterInfo.index,
              chapterInfo.href,
              chapterInfo.label
            );
          }
        }
        node = doc.body.querySelector("#" + CSS.escape(id));
        if (!node) {
          return { handled: false };
        }
        isJump = true;
        await this.goToNode(node);
      }
      if (isElementFootnote(event.target)) {
        return {
          handled: true,
          isShowMenu: true,
          isJump: isJump,
          href: href,
          node: node,
        };
      }
      return { handled: true };
    } else if (href && this.book.resolveHref && this.book.resolveHref(href)) {
      let chapterInfo = await this.book.resolveHref(href);
      if (!chapterInfo) return { handled: false };
      await this.goToChapter(
        chapterInfo.index,
        chapterInfo.href,
        chapterInfo.label
      );
      return { handled: true };
    }
    return { handled: false };
  }
  async getFootnoteContent(node: any) {
    if (
      isElementFootnote(node) ||
      !node.textContent.trim() ||
      node.tagName === "A"
    ) {
      //获取当前a标签和下一个a标签之间的内容
      let next = node.nextSibling;
      let content = node.textContent;
      while (next && (next.tagName !== node.tagName || !content.trim())) {
        content += next.textContent;
        next = next.nextSibling;
      }
      //如果内容为空或者是脚注内容，则向上查找父节点，直到找到非空且非脚注的内容
      if (!content.trim() || isContentFootnote(content)) {
        let candidate = node.parentNode;
        while (candidate && candidate.tagName !== "BODY") {
          const candidateText = candidate.textContent || "";
          if (candidateText.trim() && !isContentFootnote(candidateText)) {
            break;
          }
          candidate = candidate.parentNode;
        }
        if (!candidate) {
          return { handled: false };
        }
        node = candidate;
      } else if (content.trim() && content.trim().length <= 3000) {
        node = document.createElement("div");
        node.innerHTML = content;
      }
    }
    let htmlContent = node.innerHTML;
    if (!node.textContent.trim()) {
      return { handled: false };
    }
    if (node.textContent.trim() && node.textContent.trim().length > 3000) {
      return { handled: false };
    }
    htmlContent = await processHtml(htmlContent);
    return { handled: true, content: htmlContent };
  }
  handleBatchTransResult(sourcetexts: string[], targetTexts: string[]) {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    for (let index = 0; index < sourcetexts.length; index++) {
      const sourceText = sourcetexts[index];
      if (this.transMap[sourceText]) {
        this.transMap[sourceText].text = targetTexts[index];
        let elements = doc.querySelectorAll(
          "#" + CSS.escape(this.transMap[sourceText].id)
        );
        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];
          if (element) {
            element.setAttribute(
              "data-kookit-translation",
              targetTexts[index] || ""
            );
            element.classList.remove("kookit-translation-loading");
            if (this.fullTranslationMode === "target") {
              element.setAttribute(
                "style",
                (element.getAttribute("style") || "") +
                  ";font-size:0px !important;"
              );
              let childElements = element.querySelectorAll("*");
              childElements.forEach((child) => {
                child.setAttribute(
                  "style",
                  (child.getAttribute("style") || "") +
                    ";font-size:0px !important;"
                );
              });
            }
          }
        }
      }
    }
    if (this.readerMode === "scroll") {
      iframe.height = doc.body.scrollHeight + "px";
      iframe.height = doc.body.scrollHeight + 300 + "px";
    }
  }
  handleWordDefinitionResult(
    results: { text: string; words: any[] }[],
    lang: string,
    locale: string
  ) {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    // Clear previous definitions before re-applying
    clearWordDefinitions(doc);
    // Build a flat list of audio nodes to match against result.text
    const nodeList = getBlockElement(doc.body).filter(
      (item) => !isParentBlock(item)
    );
    for (const result of results) {
      const { text, words } = result;
      if (!words || words.length === 0) continue;
      // Find the matching DOM node by textContent
      const targetNode = nodeList.find(
        (n) => (n as HTMLElement).textContent === text
      );
      if (!targetNode) continue;
      // Build a per-node definitionMap from the words for this node
      const nodeDefMap: Record<string, any> = {};
      for (const def of words) {
        if (lang === "zh") {
          const simplified = def.simplified || "";
          const traditional = def.traditional || "";
          if (simplified) nodeDefMap[simplified] = def;
          if (traditional && traditional !== simplified)
            nodeDefMap[traditional] = def;
        } else {
          const key = (def.word || "").toLowerCase();
          if (key) nodeDefMap[key] = def;
        }
      }
      applyWordDefinitions(
        nodeDefMap,
        doc,
        lang,
        locale,
        targetNode as Element
      );
    }
    if (this.readerMode === "scroll") {
      iframe.height = doc.body.scrollHeight + "px";
      iframe.height = doc.body.scrollHeight + 300 + "px";
    }
  }
  clearWordDefinitionResult() {
    let doc = this.getDocument();
    if (!doc) return;
    clearWordDefinitions(doc);
  }
}
export default GeneralRender;
