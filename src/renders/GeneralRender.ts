import Chapter from "../model/chapter";
import ChapterDoc from "../model/chapterDoc";
import {
  collectChapterImageUrls,
  convertStyleNum,
  getActualOffsetLeft,
  getActualOffsetTop,
  getSelectedElement,
  handleOneChapterDoc,
  isVerticalLayout,
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
import {
  cumulativeSumWithPrevious,
  getBlockElement,
  isParentBlock,
} from "../utils/common";
import SpeedReadingManager from "../utils/speedReadingUtil";
import ReadingRulerManager from "../utils/readingRulerUtil";
import ParagraphModeManager from "../utils/paragraphModeUtil";
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
  isSpeedReading: string = "no";
  isShowTotalPage: string = "no";
  chapterSizeCache: { sizes: number[]; pages: number[]; total: number } | null =
    null;
  estimatedSizePerPage: number | null = null;
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
  readingRulerManager: ReadingRulerManager;
  speedReadingManager: SpeedReadingManager;
  paragraphModeManager: ParagraphModeManager;

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
    isShowTotalPage?: string;
    isAllowScript?: string;
    fullTranslationMode?: string;
    bookLayout?: string;
    platform?: string;
    textRules?: TextRule[];
    codeHighlight?: string;
  }) {
    super();
    if (
      config.isParagraphMode === "yes" ||
      config.isSpeedReading === "yes" ||
      config.isReadingRuler === "yes"
    ) {
      if (config.readerMode === "scroll") {
        config.readerMode = "single";
      }
    }
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
    this.isShowTotalPage = config.isShowTotalPage || "no";
    this.chapterList = [];
    this.chapterDocList = [];
    this.flattenChapters = [];
    this.book = "";
    this.element = "";
    this.tempLocation = {};
    this.isBionic = config.isBionic || "no";
    this.isReadingRuler = config.isReadingRuler || "no";
    this.isParagraphMode = config.isParagraphMode || "no";
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
    this.readingRulerManager = new ReadingRulerManager({
      isReadingRuler: this.isReadingRuler,
      readingRulerLineHeight: config.readingRulerLineHeight,
      readingRulerBackgroundOpacity: config.readingRulerBackgroundOpacity,
      readerMode: this.readerMode,
      isMobile: this.isMobile,
    });
    this.readingRulerManager.getDoc = () => this.getDocument();
    this.readingRulerManager.getElement = () => this.element;
    this.readingRulerManager.getIframe = () => this.getIframe();
    this.readingRulerManager.getIsVertical = () => this.isVertical();
    this.readingRulerManager.getOverlayBackground = (doc: Document) =>
      this.getParagraphOverlayBackground(doc);
    this.readingRulerManager.nextPage = () => this.next();
    this.readingRulerManager.prevPage = () => this.prev();
    this.speedReadingManager = new SpeedReadingManager({
      isSpeedReading: this.isSpeedReading,
      speedReadingSpeed: this.speedReadingSpeed,
      isDarkMode: this.isDarkMode,
      readerMode: this.readerMode,
    });
    this.speedReadingManager.getDoc = () => this.getDocument();
    this.speedReadingManager.getElement = () => this.element;
    this.speedReadingManager.getOverlayBackground = (doc: Document) =>
      this.getParagraphOverlayBackground(doc);
    this.speedReadingManager.getProgress = () => this.getProgress();
    this.speedReadingManager.getChapterDocIndex = () =>
      this.tempLocation.chapterDocIndex;
    this.speedReadingManager.nextPage = () => this.next();
    this.speedReadingManager.prevPage = () => this.prev();
    this.paragraphModeManager = new ParagraphModeManager({
      isParagraphMode: this.isParagraphMode,
      readerMode: this.readerMode,
      isMobile: this.isMobile,
    });
    this.paragraphModeManager.getDoc = () => this.getDocument();
    this.paragraphModeManager.getElement = () => this.element;
    this.paragraphModeManager.getIframe = () => this.getIframe();
    this.paragraphModeManager.getOverlayBackground = (doc: Document) =>
      this.getParagraphOverlayBackground(doc);
    this.paragraphModeManager.nextPage = () => this.next();
    this.paragraphModeManager.prevPage = () => this.prev();
    this.on("rendered", () => {
      this.paragraphModeManager.handleRendered();
      this.readingRulerManager.handleRendered();
      if (!this.speedReadingManager.skipFlip) {
        this.speedReadingManager.handleRendered();
      }
    });
    this.on("rendered", () => {
      const value = this.computeEstimatedSizePerPage();
      if (value > 1) {
        this.estimatedSizePerPage = value;
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
        let progressInfo = this.getChapterProgress();
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
  async prev() {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) {
      return;
    }
    if (this.isSpeedReading === "yes" && !this.speedReadingManager.skipFlip) {
      // 速读模式下禁用鼠标、快捷键等外部触发的翻页
      return;
    }
    if (this.isReadingRuler === "yes" && !this.readingRulerManager.skipFlip) {
      const handled = await this.readingRulerManager.handleChange(-1);
      if (handled) return;
    }
    if (this.isParagraphMode === "yes" && !this.paragraphModeManager.skipFlip) {
      const handled = await this.paragraphModeManager.handleChange(-1);
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
    if (this.isSpeedReading === "yes" && !this.speedReadingManager.skipFlip) {
      // 速读模式下禁用鼠标、快捷键等外部触发的翻页
      return;
    }
    if (this.isReadingRuler === "yes" && !this.readingRulerManager.skipFlip) {
      const handled = await this.readingRulerManager.handleChange(1);
      if (handled) return;
    }
    if (this.isParagraphMode === "yes" && !this.paragraphModeManager.skipFlip) {
      const handled = await this.paragraphModeManager.handleChange(1);
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
    if (this.isPageAnimationDisabled()) {
      if (direction === "left") {
        await this.prev();
      } else if (direction === "right") {
        await this.next();
      }
      return;
    }
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
  getChapterSizes() {
    if (this.chapterSizeCache) return this.chapterSizeCache;
    const sizes = this.chapterDocList.map((item) =>
      item?.text ? item.text.size || item.text.length || 1 : 1
    );
    const pageList = sizes.map(
      (size) =>
        Math.max(Math.round(size / this.getEstimatedSizePerPage()), 1) *
        (this.readerMode === "double" ? 2 : 1)
    );
    //get total pages for each chapter
    const pages = cumulativeSumWithPrevious(pageList);
    const total = sizes.reduce((a, b) => a + b, 0);
    this.chapterSizeCache = { sizes, total, pages };
    this.trigger("chapter-pages");
    return this.chapterSizeCache;
  }
  // 每个可见字符对应的"章节文件大小"单位数（size 源自源文件，已包含文字内容与标记开销）
  static SIZE_PER_CHAR: Record<string, number> = {
    TXT: 1.5,
    MD: 2,
    DOCX: 2.5,
    HTML: 3,
    MHTML: 3,
    XHTML: 3,
    HTM: 3,
    XML: 3,
    EPUB: 4.5,
    MOBI: 4.5,
    FB2: 5,
    PDFTEXT: 0.5,
  };
  getEstimatedSizePerPage() {
    if (this.estimatedSizePerPage !== null) {
      return this.estimatedSizePerPage;
    }
    return this.computeEstimatedSizePerPage();
  }
  computeEstimatedSizePerPage() {
    const doc = this.getDocument();
    if (!doc || !doc.body) return 1;
    if (this.format === "CACHE") return 1;
    const bytesPerChar =
      GeneralRender.SIZE_PER_CHAR[(this.format || "").toUpperCase()] || 3;
    const vertical = isVerticalLayout() && this.readerMode !== "scroll";
    const scroll = this.readerMode === "scroll";
    let inlinePx = 0;
    let blockPx = 0;
    if (scroll) {
      inlinePx = this.element.clientWidth;
      blockPx = this.element.clientHeight - 50;
    } else if (vertical) {
      inlinePx = doc.body.clientHeight;
      blockPx = doc.body.clientWidth;
    } else {
      inlinePx = doc.body.clientWidth;
      blockPx = doc.body.clientHeight;
    }
    if (inlinePx <= 0 || blockPx <= 0) return 1;
    const view = doc.defaultView || window;
    const bodyStyle = view.getComputedStyle(doc.body);
    const sampleEl: any = doc.body.querySelector(
      "div,p:not(.hide),li,blockquote,dd,dt,pre,td"
    );
    if (!sampleEl) return 1;

    const style = view.getComputedStyle(sampleEl);
    const fontSize =
      parseFloat(style.fontSize) || parseFloat(bodyStyle.fontSize) || 18;
    let lineHeightPx = parseFloat(style.lineHeight);
    if (!lineHeightPx || style.lineHeight === "normal") {
      lineHeightPx = fontSize * 1.25;
    }
    const letterSpacing = parseFloat(style.letterSpacing) || 0;
    const marginBlock =
      (parseFloat(style.marginTop) || 0) +
      (parseFloat(style.marginBottom) || 0);
    const charAdvancePx = Math.max(fontSize + letterSpacing, 1);
    const charsPerLine = Math.max(Math.floor(inlinePx / charAdvancePx), 1);
    // 假设段落平均占 3 行，把段前段后 margin 摊到每行
    const effectiveLineHeight = lineHeightPx + marginBlock / 3;
    const charsPerPage = Math.max(
      Math.floor(blockPx / effectiveLineHeight) * charsPerLine,
      1
    );
    const value = Math.max(charsPerPage * bytesPerChar, 1);
    if (this.readerMode === "double") {
      return value / 2;
    }
    return value;
  }
  getChapterProgress() {
    let doc = this.getDocument();
    if (!doc) return null;
    return {
      ...progressInfo(this.readerMode, doc, this.element),
      percentage: this.tempLocation.percentage,
    } as any;
  }
  getProgress() {
    const chapterProgress = this.getChapterProgress();
    if (!chapterProgress) return;
    if (this.isShowTotalPage !== "yes") {
      return { ...chapterProgress } as any;
    }
    let sizePerPage = this.getEstimatedSizePerPage();
    if (sizePerPage === 1) {
      return { ...chapterProgress } as any;
    }
    const { total } = this.getChapterSizes();
    const totalPage = Math.max(
      Math.round(total / sizePerPage),
      chapterProgress.totalPage
    );
    const currentPage =
      Math.round(totalPage * parseFloat(chapterProgress.percentage || "0")) + 1;
    return {
      totalPage: totalPage * (this.readerMode === "double" ? 2 : 1),
      currentPage,
      percentage: chapterProgress.percentage,
    } as any;
  }
  getPages() {
    if (this.chapterSizeCache) {
      const { pages } = this.chapterSizeCache;
      return pages;
    }
    return [];
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
      await showNoteHighlightBatch(
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

  isPageAnimationDisabled() {
    return (
      this.isMobile === "yes" &&
      (this.isParagraphMode === "yes" ||
        this.isReadingRuler === "yes" ||
        this.isSpeedReading === "yes")
    );
  }
  addPageAnimation = (backgroundColor?: string) => {
    if (this.animation !== "mimical") return;
    if (this.isPageAnimationDisabled()) return;
    const progress = this.getChapterProgress();
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
    const animation = this.isPageAnimationDisabled() ? "none" : this.animation;
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
          animation,
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
          animation,
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
    redirectChapter?: boolean;
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
        return { handled: true, redirectChapter: true };
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
      return { handled: true, redirectChapter: true };
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
      return { handled: true, redirectChapter: true };
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
