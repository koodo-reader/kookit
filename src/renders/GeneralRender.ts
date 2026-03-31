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
  handleHighlightSearchNode,
  handleHighlightAudioNode,
  getBlockElement,
  isParentBlock,
  isElementFootnote,
  processHtml,
} from "../utils/navigationUtil";
import EventEmitter from "../utils/EventEmitter";
import { CFI } from "../libs/cfi";
import { clearHighlight, showNoteHighlight } from "../utils/noteUtil";
import { addPageAnimation } from "../utils/animationUtil";
import rangy from "rangy/lib/rangy-core.js";
import "rangy/lib/rangy-textrange";

import { getPDFSearchResult } from "../utils/pdfUtil";
import { addAndroidTouchEvent, addAppleTouchEvent } from "../utils/touchUtil";
declare var window: any;
class GeneralRender extends EventEmitter {
  readerMode: string;
  format: string;
  animation: string;
  convertChinese: string | undefined;
  isIndent: string | undefined;
  isHyphenation: string | undefined;
  isDarkMode: string | undefined;
  textOrientation: string | undefined;
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
  isAllowScript: string = "no";
  touchEventSet: any;
  scrollTimer: any;
  recordTimer: any;
  transMap: Record<string, object>;
  fullTranslationMode: string = "source";
  constructor(config: {
    readerMode: string;
    format: string;
    animation: string;
    convertChinese?: string;
    isIndent?: string;
    isHyphenation?: string;
    isDarkMode?: string;
    isMobile?: string;
    isBionic?: string;
    textOrientation?: string;
    isAllowScript?: string;
    fullTranslationMode?: string;
  }) {
    super();
    this.readerMode = config.readerMode;
    this.animation = config.animation;
    this.format = config.format;
    this.convertChinese = config.convertChinese;
    window.convertChinese = config.convertChinese;
    this.isIndent = config.isIndent;
    window.isIndent = config.isIndent;
    this.isHyphenation = config.isHyphenation || "no";
    window.isHyphenation = this.isHyphenation;
    this.isDarkMode = config.isDarkMode;
    this.isMobile = config.isMobile;
    this.textOrientation = config.textOrientation;
    window.textOrientation = config.textOrientation;
    this.chapterList = [];
    this.chapterDocList = [];
    this.flattenChapters = [];
    this.book = "";
    this.element = "";
    this.tempLocation = {};
    this.isBionic = config.isBionic || "no";
    window.isBionic = this.isBionic;
    this.transMap = {};
    window.transMap = this.transMap;
    this.fullTranslationMode = config.fullTranslationMode || "source";
    window.fullTranslationMode = this.fullTranslationMode;

    //手机版环境已经有严格的安全限制，无需额外限制，PDF中无法执行代码，强行开启则无法渲染图书
    this.isAllowScript =
      this.format === "PDF" || this.isMobile === "yes"
        ? "yes"
        : config.isAllowScript || "no";
    this.flipToNextPage = () => {};
    this.flipToPrevPage = () => {};
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
        left: this.element.offsetLeft,
        top: this.element.offsetTop,
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
      left: this.element.offsetLeft,
      top: this.element.offsetTop,
      scrollTop: this.element.scrollTop,
      scrollLeft: this.element.scrollWidth / 2 - this.element.clientWidth / 2,
      sectionWidth: (this.element.clientWidth - gap) / scale,
      sectionHeight: iframeHeight,
      gap: gap,
    };
  }
  scrollToText(text: string) {
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
        if (this.isVertical()) {
          doc.body.scrollTo(0, top);
        } else {
          doc.body.scrollTo(left, 0);
        }
      } else {
        this.element.scrollTo(0, top);
      }
    }
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
    if (!node) {
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
  removeContent() {
    this.element.innerHTML = "";
  }
  async prev() {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) {
      return;
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
      if (
        this.animation === "mimical" &&
        this.readerMode !== "scroll" &&
        this.isMobile === "yes"
      ) {
        //sleep 1s prevent animation stuck
        await new Promise((r) => setTimeout(r, 500));
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
      if (
        this.animation === "mimical" &&
        this.readerMode !== "scroll" &&
        this.isMobile === "yes"
      ) {
        //sleep 1s prevent animation stuck
        await new Promise((r) => setTimeout(r, 500));
      }
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
    if (!doc) return "";
    let audioTexts = await getAudioText(this.element, this.readerMode, doc);
    return audioTexts;
  }
  async chapterText() {
    let doc = this.getDocument();
    if (!doc) return "";
    return doc.body.textContent || "";
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
    if (this.animation !== "") {
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

    var defaultStyle = document.createElement("style");
    defaultStyle.innerHTML = css;
    doc.head.appendChild(defaultStyle);
  }
  async getHightlightCoords() {
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

    // if more than 20 notes, render one by one to avoid blocking the UI thread
    for (let index = 0; index < notes.length; index++) {
      const item = notes[index];
      try {
        await new Promise((r) => setTimeout(r, 5));
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
  removeOneNote(key: string, chapterDocIndex: number) {
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
      iframe,
      item.notes !== "",
      this.isMobile === "yes",
      item.notes || ""
    );
  }

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
    if (this.format !== "PDF") {
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
    if (this.format !== "PDF") {
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
        await this.goToChapterDocIndex(result.index);
        let node = result.anchor(doc);
        await this.goToNode(node);
        if (isElementFootnote(event.target)) {
          return {
            handled: true,
            isShowMenu: true,
            isJump: true,
            href: href,
            node: node,
          };
        }

        return { handled: true };
      }
    }
    if (href && this.resolveChapter(href)) {
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
      if (!node) {
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
    } else if (
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
    }
    return { handled: false };
  }
  async getFootnoteContent(node: any) {
    if (isElementFootnote(node) || !node.textContent.trim()) {
      //获取当前a标签和下一个a标签之间的内容
      let next = node.nextSibling;
      let content = node.textContent;
      while (next && (next.tagName !== node.tagName || !content.trim())) {
        content += next.textContent;
        next = next.nextSibling;
      }
      if (content.trim() && content.trim().length <= 3000) {
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
  async refreshFullTranslation(texts: string[]) {
    let doc = this.getDocument();
    if (!doc) return;
    // await handleFullTranslation(this.element, this.readerMode, doc);
  }
}
export default GeneralRender;
