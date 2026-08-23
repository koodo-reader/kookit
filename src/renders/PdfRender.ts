import {
  createIframe,
  getActualOffsetLeft,
  getActualOffsetTop,
  getSelectedElement,
} from "../utils/layoutUtil.js";
import GeneralParser from "../utils/generalParser.js";
import { isPDF, makePDF } from "../libs/pdf.js";
import GeneralRender from "./GeneralRender.js";
import { clearHighlight, showPDFHighlight } from "../utils/noteUtil.js";
import {
  createPDFContainer,
  createPDFIframe,
  getPDFVisibleText,
  getTextFromPDFPage,
  handleHighlightPDFNode,
  handleIOSScrollPage,
  handlePDFLayout,
  handleScrollPDFPosition,
  isPDFScrolledIntoView,
} from "../utils/pdfUtil.js";
import {
  handleHighlightSearchNode,
  handleScrollPage,
} from "../utils/navigationUtil.js";
import rangy from "rangy/lib/rangy-core.js";
import "rangy/lib/rangy-textrange";
declare var window: any;
class PdfRender extends GeneralRender {
  pdfBuffer: ArrayBuffer;
  isStartFromEven: string = "no";
  isKeepPDFBackground: string = "no";
  pdfCrop: { top: number; bottom: number; left: number; right: number } = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };
  password: string = "";
  pdfScale: number = 0;
  scale: number = 1;
  backgroundColor: string;
  isScannedPDF: string;
  enablePDFSelectionOptimization: string = "no";
  scrollPDFInterval: any = null;
  templateChapterDocIndex: number = 0;
  platform: string;
  pdfTextLineHeightRecord: Record<string, number> = {};
  pdfTextLineHeightFixed: number | null = null;
  fabricCanvasMap: any = new Map();
  fabricHistoryMap: Map<number, any[]> = new Map();
  fabricHistoryLock: Set<number> = new Set();
  fabricSyncListenerMap: Map<number, { doc: Document; fn: () => void }> =
    new Map();
  annotationStyle: string = "brush";
  brushColor: string = "#ff0000";
  brushWidth: number = 2;
  highlighterColor: string = "#ffff00";
  highlighterWidth: number = 24;
  highlighterOpacity: number = 0.4;
  shapeType: string = "rect";
  shapeColor: string = "#ff0000";
  shapeWidth: number = 2;
  textSize: number = 24;
  textFont: string = "sans-serif";
  textColor: string = "#ff0000";
  isDrawing: string = "no";
  constructor(pdfBuffer: ArrayBuffer, config: any) {
    super({ ...config, convertChinese: "Default", format: "PDF" });
    this.pdfBuffer = pdfBuffer;
    this.isStartFromEven = config.isStartFromEven || "no";
    this.pdfCrop = config.pdfCrop || { top: 0, bottom: 0, left: 0, right: 0 };
    this.isKeepPDFBackground = config.isKeepPDFBackground || "no";
    this.password = config.password || "";
    this.scale = config.scale || 1;
    this.backgroundColor = config.backgroundColor || "#ffffff";
    this.isScannedPDF = config.isScannedPDF || "no";
    this.platform = config.platform || "web";
    this.enablePDFSelectionOptimization =
      config.enablePDFSelectionOptimization || "no";
    this.brushColor = config.brushColor || "#ff0000";
    this.brushWidth = config.brushWidth || 2;
    this.highlighterColor = config.highlighterColor || "#ffff00";
    this.highlighterWidth = config.highlighterWidth || 24;
    this.highlighterOpacity =
      config.highlighterOpacity != null ? config.highlighterOpacity : 0.4;
    this.shapeType = config.shapeType || "rect";
    this.shapeColor = config.shapeColor || "#ff0000";
    this.shapeWidth = config.shapeWidth || 2;
    this.textSize = config.textSize != null ? config.textSize : 24;
    this.textFont = config.textFont || "sans-serif";
    this.textColor = config.textColor || "#ff0000";
    this.isDrawing = config.isDrawing || "no";
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      if (!this.book) {
        await this.parse();
      }
      let parser = new GeneralParser(this.book);
      this.chapterList = await parser.getChapter(this.book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      if (this.isStartFromEven === "yes" && this.readerMode === "double") {
        this.chapterDocList = [
          {
            label: "",
            text: {
              load: async () => "",
              render: async () => {},
              unload: async () => {},
              getPage: async () => null,
              getDimension: async () => ({ width: 0, height: 0 }),
              getScale: async () => 1,
              getPageCount: async () => 0,
            },
            href: "",
          },
          ...this.chapterDocList,
        ];
      }
      if (this.readerMode === "single" && Math.abs(this.scale) > 1.4) {
        this.scale = 1.4;
      }
      if (
        document.body.clientWidth * Math.abs(this.scale) -
          document.body.clientWidth * 0.4 >
          document.body.clientWidth &&
        this.readerMode !== "double"
      ) {
        createIframe(element, this.isAllowScript, this.scale);
      } else {
        createIframe(element, this.isAllowScript);
      }
      let viewport: any;
      let templateIndex: number = 0;
      // 分层采样策略：最小化getDimension调用

      let maxFrequencyItem = await this.getTemplateChapterDoc();
      viewport = maxFrequencyItem.dimension;
      templateIndex = maxFrequencyItem.index;

      this.templateChapterDocIndex = templateIndex;
      // Set templateChapterDocIndex based on the viewport evaluation result
      let doc: any = this.getDocument();
      if (!doc) return;
      await createPDFContainer(
        doc.body || (doc.documentElement as HTMLElement),
        this.chapterDocList,
        viewport,
        this.readerMode,
        this.pdfCrop
      );
      let scrollTimeout: any = null;
      if (this.readerMode === "scroll") {
        this.element.addEventListener("scroll", (e) => {
          if (scrollTimeout) {
            clearTimeout(scrollTimeout);
          }
          scrollTimeout = setTimeout(async () => {
            await this.handlePDFScrollEvent(doc);
            await this.record();
          }, 100); // Debounce selection events
        });
      } else {
        doc.addEventListener("scroll", (e) => {
          if (scrollTimeout) {
            clearTimeout(scrollTimeout);
          }
          scrollTimeout = setTimeout(async () => {
            await this.handlePDFScrollEvent(doc);
            await this.record();
          }, 200); // Debounce selection events
        });
      }

      handlePDFLayout(element, this.readerMode, doc);
      resolve();
    });
  }
  async getTemplateChapterDoc() {
    const totalPages = this.chapterDocList.length;

    // 第一层：采样5个关键位置（首页、1/4、1/2、3/4、末页）
    let keyIndices = [
      1,
      Math.floor(totalPages / 4),
      Math.floor(totalPages / 2),
      Math.floor((totalPages * 3) / 4),
      totalPages - 1,
    ].filter((idx) => idx >= 0 && idx < totalPages);
    //去重
    keyIndices = Array.from(new Set(keyIndices));

    const keyViewports = await Promise.all(
      keyIndices.map(async (index) => ({
        index,
        dimension: await this.chapterDocList[index].text.getDimension(),
      }))
    );

    // 计算长宽比
    const aspectRatios = keyViewports.map((v) => ({
      index: v.index,
      ratio: v.dimension.height / v.dimension.width,
      dimension: v.dimension,
    }));

    // 统计长宽比出现频率
    const ratioFrequency = new Map<number, number>();
    // 统计页面宽度出现频率
    const widthFrequency = new Map<number, number>();

    aspectRatios.forEach((item) => {
      const roundedRatio = Math.round(item.ratio * 1000) / 1000;
      ratioFrequency.set(
        roundedRatio,
        (ratioFrequency.get(roundedRatio) || 0) + 1
      );
      const roundedWidth = Math.round(item.dimension.width);
      widthFrequency.set(
        roundedWidth,
        (widthFrequency.get(roundedWidth) || 0) + 1
      );
    });

    // 找出长宽比和页面宽度各自的最大频率
    let maxRatioCount = 0;
    ratioFrequency.forEach((count) => {
      if (count > maxRatioCount) maxRatioCount = count;
    });
    let maxWidthCount = 0;
    widthFrequency.forEach((count) => {
      if (count > maxWidthCount) maxWidthCount = count;
    });

    // 候选项：长宽比和页面宽度的出现频率都等于各自最大频率
    const candidates = aspectRatios.filter((item) => {
      const roundedRatio = Math.round(item.ratio * 1000) / 1000;
      const roundedWidth = Math.round(item.dimension.width);
      return (
        ratioFrequency.get(roundedRatio) === maxRatioCount &&
        widthFrequency.get(roundedWidth) === maxWidthCount
      );
    });

    // 从候选项中选择长宽比最大的
    let maxFrequencyItem = {
      count: maxRatioCount,
      dimension: null as any,
      index: 0,
      ratio: 0,
    };
    candidates.forEach((item) => {
      if (item.ratio > maxFrequencyItem.ratio) {
        maxFrequencyItem = {
          count: maxRatioCount,
          dimension: item.dimension,
          index: item.index,
          ratio: item.ratio,
        };
      }
    });

    // 若无候选项（极端情况），回退到长宽比最大频率的项
    if (!maxFrequencyItem.dimension) {
      aspectRatios.forEach((item) => {
        const roundedRatio = Math.round(item.ratio * 1000) / 1000;
        if (
          ratioFrequency.get(roundedRatio) === maxRatioCount &&
          item.ratio > maxFrequencyItem.ratio
        ) {
          maxFrequencyItem = {
            count: maxRatioCount,
            dimension: item.dimension,
            index: item.index,
            ratio: item.ratio,
          };
        }
      });
    }

    return maxFrequencyItem;
  }
  async autoScrollPDF(isStart: string) {
    let doc = this.getDocument();

    if (this.scrollPDFInterval) {
      clearInterval(this.scrollPDFInterval);
      this.scrollPDFInterval = null;
    }
    if (isStart === "no" || this.readerMode !== "scroll") {
      return;
    }
    this.scrollPDFInterval = setInterval(async () => {
      if (!doc) return;
      await this.handlePDFScrollEvent(doc);
    }, 1000); // Debounce selection events
  }
  async handlePDFScrollEvent(doc: Document) {
    let subContainers = doc.querySelectorAll(".pdf-container");
    for (let index = 0; index < subContainers.length; index++) {
      let subContainer = subContainers[index];
      let id = subContainer.getAttribute("id");
      if (!id) continue;
      let chapterDocIndex = parseInt(id.split("-").reverse()[0]);
      let isScrollIntoView = isPDFScrolledIntoView(
        this.element,
        subContainer as HTMLElement,
        this.readerMode,
        doc
      );
      if (isScrollIntoView) {
        await this.renderPdfPage(chapterDocIndex);
      }
    }
  }
  async parse() {
    try {
      let blob = new Blob([this.pdfBuffer]);
      let file = new File([blob], "book", {
        lastModified: new Date().getTime(),
        type: blob.type,
      });
      this.book = await makePDF(file, this.password);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  async preCache() {
    return "";
    // if (!this.book) {
    //   await this.parse();
    // }
    // return await getCache(this.book);
  }
  async goToChapterIndex(targetChapterIndex: number) {
    if (this.chapterDocList.length > 0) {
      await this.goToChapter(
        targetChapterIndex,
        this.chapterDocList[targetChapterIndex].href,
        this.chapterDocList[targetChapterIndex].label
      );
    }
  }
  getPageSize(pageIndex?: number) {
    let doc = this.getDocument();
    if (!doc) return;
    let scale = this.readerMode === "double" ? 2 : 1;
    let section = Math.floor(doc.body.clientWidth / 12);
    let gap = section % 2 === 0 ? section : section - 1;

    let subIframe = doc.querySelectorAll("iframe")[0];
    let iframeHeight = subIframe?.getBoundingClientRect().height;

    let offsetTop = 0;
    if (pageIndex !== undefined) {
      let subContainer = doc.querySelector("#pdf-container-" + pageIndex);
      if (subContainer) {
        offsetTop = subContainer.getBoundingClientRect().top;
      }
    }
    return {
      width: doc.body.clientWidth,
      height: this.element.clientHeight,
      left: getActualOffsetLeft(this.element),
      top: getActualOffsetTop(this.element),
      offsetTop: offsetTop,
      scrollTop: this.element.scrollTop,
      scrollLeft: this.element.scrollWidth / 2 - this.element.clientWidth / 2,
      sectionWidth: (doc.body.clientWidth - gap) / scale,
      sectionHeight: iframeHeight,
      gap: gap,
    };
  }
  async goToChapter(chapterDocIndex, chapterHref, chapterTitle) {
    if (this.readerMode === "double" && chapterDocIndex % 2 == 1) {
      chapterDocIndex--;
    }
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    await this.renderPdfPage(chapterDocIndex);
    await handleScrollPDFPosition(
      parseInt(chapterDocIndex),
      this.readerMode,
      doc
    );
    await this.recordByChapter(chapterDocIndex);
  }
  getPositionByChapter(chapterDocIndex: number) {
    return {
      percentage: chapterDocIndex / this.chapterDocList.length,
      chapterDocIndex: chapterDocIndex + "",
      chapterHref: this.chapterDocList[chapterDocIndex].href,
      chapterTitle: this.chapterDocList[chapterDocIndex].label,
      text: "",
    };
  }
  async goToPercentage(percentage: number) {
    if (this.chapterDocList.length > 0) {
      let chapterIndex =
        percentage === 1
          ? this.chapterDocList.length - 1
          : Math.floor(this.chapterDocList.length * percentage);
      await this.goToChapter(
        chapterIndex,
        this.chapterDocList[chapterIndex].href,
        this.chapterDocList[chapterIndex].label
      );
    }
  }
  async goToPosition(bookLocationStr: string) {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    let bookLocation = JSON.parse(bookLocationStr);
    if (bookLocation.chapterDocIndex === undefined) {
      bookLocation.chapterDocIndex = 0;
    }
    this.tempLocation = {
      text: bookLocation.text,
      chapterTitle: bookLocation.chapterTitle,
      chapterDocIndex: bookLocation.chapterDocIndex,
      chapterHref: bookLocation.chapterHref,
      count: bookLocation.count,
      page: bookLocation.page,
      percentage: bookLocation.percentage,
    };
    let { chapterTitle, chapterDocIndex, chapterHref } = bookLocation;
    if (this.readerMode === "double" && chapterDocIndex % 2 == 1) {
      chapterDocIndex--;
    }
    await this.renderPdfPage(parseInt(chapterDocIndex));
    if (this.readerMode === "scroll") {
      iframe.height = doc.body.scrollHeight + "px";
      iframe.height = doc.body.scrollHeight + 300 + "px";
    }

    await handleScrollPDFPosition(
      parseInt(chapterDocIndex),
      this.readerMode,
      doc
    );
    rangy.init();
    await this.recordByChapter(parseInt(chapterDocIndex));
    this.addPageAnimation(this.backgroundColor);
  }
  async prev(platform?: string) {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) {
      return;
    }
    if (this.readerMode === "scroll") {
      // scroll readerMode under normal condition
      this.element.scrollBy({
        left: 0,
        top: -(this.element.clientHeight - 50),
        behavior: "smooth",
      });
    } else {
      if (platform === "ios") {
        await handleIOSScrollPage(
          this.element,
          this.animation,
          1,
          doc,
          this.flipToNextPage,
          this.flipToPrevPage,
          this.isMobile,
          parseInt(this.tempLocation.chapterDocIndex || "0"),
          this.readerMode
        );
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

      await this.renderPdfPage(
        parseInt(this.tempLocation.chapterDocIndex) -
          (this.readerMode === "double" ? 2 : 1)
      );
    }

    await this.record();
  }
  async next(platform?: string) {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) {
      return;
    }
    if (this.readerMode === "scroll") {
      // scroll readerMode under normal condition
      this.element.scrollBy({
        left: 0,
        top: this.element.clientHeight - 50,
        behavior: "smooth",
      });
    } else {
      // single and double readerMode under normal condition
      if (platform === "ios") {
        await handleIOSScrollPage(
          this.element,
          this.animation,
          -1,
          doc,
          this.flipToNextPage,
          this.flipToPrevPage,
          this.isMobile,
          parseInt(this.tempLocation.chapterDocIndex || "0"),
          this.readerMode
        );
      } else {
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

      await this.renderPdfPage(
        parseInt(this.tempLocation.chapterDocIndex) +
          (this.readerMode === "double" ? 2 : 1)
      );
    }

    await this.record();
  }
  async prevChapter() {
    await this.prev();
  }
  async nextChapter() {
    await this.next();
  }
  async goToPage(targetPage: number): Promise<void> {
    let chapterDocIndex = Math.floor(targetPage - 1);
    if (chapterDocIndex >= this.chapterDocList.length) {
      chapterDocIndex = this.chapterDocList.length - 1;
    }
    if (chapterDocIndex < 0) {
      chapterDocIndex = 0;
    }
    await this.goToChapter(
      chapterDocIndex,
      this.chapterDocList[chapterDocIndex].href,
      this.chapterDocList[chapterDocIndex].label
    );
  }
  async visibleText() {
    let chapterDocIndex = parseInt(this.tempLocation.chapterDocIndex || "0");
    let chapterDoc = this.chapterDocList[chapterDocIndex];
    let textList = (await getTextFromPDFPage(chapterDoc)).map((item) =>
      item.text.trim()
    );
    if (this.readerMode === "double") {
      let nextChapterDocIndex = chapterDocIndex + 1;
      if (nextChapterDocIndex < this.chapterDocList.length) {
        let nextChapterDoc = this.chapterDocList[nextChapterDocIndex];
        let nextTextList = (await getTextFromPDFPage(nextChapterDoc)).map(
          (item) => item.text.trim()
        );
        textList = textList.concat(nextTextList);
      }
    }
    return textList;
  }
  async audioText() {
    return await this.visibleText();
  }
  async getRestAudioText(count: number) {
    const currentIndex = parseInt(this.tempLocation.chapterDocIndex || "0");
    const result: { chapterDocIndex: number; audioText: string[] }[] = [];
    const startIndex = currentIndex + 1;
    const endIndex = Math.min(startIndex + count, this.chapterDocList.length);

    for (let i = startIndex; i < endIndex; i++) {
      const chapterDoc = this.chapterDocList[i];
      const textList = (await getTextFromPDFPage(chapterDoc)).map((item) =>
        item.text.trim()
      );
      const filteredText = textList.filter((s): s is string => !!s);
      if (filteredText.length > 0) {
        result.push({
          chapterDocIndex: i,
          audioText: filteredText,
        });
      }
    }
    return result;
  }
  async chapterText() {
    return (await this.visibleText()).join(" ");
  }
  async record(): Promise<void> {
    if (this.animation !== "none" && this.isMobile !== "yes") {
      await new Promise((r) => setTimeout(r, 1000));
    }
    let doc = this.getDocument();
    if (!doc) return;
    await this.handlePDFRecord(doc);
  }
  async recordByChapter(chapterDocIndex: number): Promise<void> {
    if (this.animation !== "none" && this.isMobile !== "yes") {
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }
    this.tempLocation.chapterDocIndex = chapterDocIndex + "";
    this.tempLocation.percentage =
      this.chapterDocList.length === 1
        ? "1"
        : chapterDocIndex / (this.chapterDocList.length - 1) + "";
    this.tempLocation.chapterHref = this.chapterDocList[chapterDocIndex].href;
    let chapterTitle = this.chapterDocList[chapterDocIndex].label;
    if (!chapterTitle) {
      //取前面最近的章节，且存在的标题
      let tempChapterDocIndex = chapterDocIndex;
      while (tempChapterDocIndex >= 0) {
        if (this.chapterDocList[tempChapterDocIndex].label) {
          chapterTitle = this.chapterDocList[tempChapterDocIndex].label;
          break;
        }
        tempChapterDocIndex--;
      }
    }
    this.tempLocation.chapterTitle = chapterTitle;
    this.tempLocation.text = "";
    this.trigger("page-changed");
  }
  async handlePDFRecord(doc: Document) {
    let subContainers = doc.querySelectorAll(".pdf-container");
    if (
      subContainers.length > 0 &&
      isPDFScrolledIntoView(
        this.element,
        subContainers[subContainers.length - 1] as HTMLElement,
        this.readerMode,
        doc
      )
    ) {
      this.handleRecord(subContainers[subContainers.length - 1] as HTMLElement);
      return;
    }
    for (let index = 0; index < subContainers.length; index++) {
      let subContainer = subContainers[index];
      if (
        isPDFScrolledIntoView(
          this.element,
          subContainer as HTMLElement,
          this.readerMode,
          doc
        )
      ) {
        this.handleRecord(subContainer as HTMLElement);
        break;
      }
    }
  }
  handleRecord(subContainer: HTMLElement) {
    let id = subContainer.getAttribute("id");
    if (!id) return;
    let chapterDocIndex = parseInt(id.split("-").reverse()[0]);
    if (chapterDocIndex !== parseInt(this.tempLocation.chapterDocIndex)) {
      this.tempLocation.chapterDocIndex = chapterDocIndex + "";
      this.tempLocation.percentage =
        this.chapterDocList.length === 1
          ? "1"
          : chapterDocIndex / (this.chapterDocList.length - 1) + "";
      this.tempLocation.chapterHref = this.chapterDocList[chapterDocIndex].href;
      let chapterTitle = this.chapterDocList[chapterDocIndex].label;
      if (!chapterTitle) {
        //取前面最近的章节，且存在的标题
        let tempChapterDocIndex = chapterDocIndex;
        while (tempChapterDocIndex >= 0) {
          if (this.chapterDocList[tempChapterDocIndex].label) {
            chapterTitle = this.chapterDocList[tempChapterDocIndex].label;
            break;
          }
          tempChapterDocIndex--;
        }
      }
      this.tempLocation.chapterTitle = chapterTitle;
      this.tempLocation.text = "";
      this.trigger("page-changed");
    }
  }
  async getMetadata() {
    try {
      if (!this.book) {
        await this.parse();
      }
      let parser = new GeneralParser(this.book);
      let metadata = await parser.getMetadata();
      return metadata;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  highlightAudioNode(text: string, style: string) {
    let pageIndex = parseInt(this.tempLocation.chapterDocIndex);
    let doc = this.getSubDocument(pageIndex);
    if (!doc) return;
    handleHighlightPDFNode(text, style, doc);
    if (this.readerMode === "double") {
      let doc = this.getSubDocument(pageIndex + 1);
      if (!doc) return;
      handleHighlightPDFNode(text, style, doc);
    }
  }
  highlightSearchNode(text: string, style: string) {
    let pageIndex = parseInt(this.tempLocation.chapterDocIndex);
    let doc = this.getSubDocument(pageIndex);
    if (!doc) return;
    handleHighlightSearchNode(text, style, doc);
  }
  getProgress() {
    return {
      totalPage: this.chapterDocList.length,
      currentPage: parseInt(this.tempLocation.chapterDocIndex || "0") + 1,
    };
  }
  async getNotePosition() {
    let doc = this.getDocument();
    if (!doc) return;
    let selectedElement = getSelectedElement(doc);
    if (!selectedElement) return;
    let ownerDoc = selectedElement.ownerDocument;
    let targetIframe = ownerDoc?.defaultView?.frameElement;
    let id = targetIframe?.getAttribute("id") || "";
    let chapterDocIndex = id ? parseInt(id.split("-").reverse()[0]) : 0;
    return { ...this.tempLocation, chapterDocIndex };
  }
  getSubDocument(chapterDocIndex?: number): Document | null {
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return null;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return null;
    let doc = iframe.contentDocument;
    if (!doc) {
      return null;
    }

    let subIframe: any = doc.getElementById("pdf-iframe-" + chapterDocIndex);
    if (!subIframe) {
      createPDFIframe(chapterDocIndex || 0, doc);
      subIframe = doc.getElementById("pdf-iframe-" + chapterDocIndex);
    }
    return subIframe.contentDocument;
  }
  getSubIframe(chapterDocIndex?: number): HTMLIFrameElement | null {
    let pageArea = document.getElementById("page-area");
    if (!pageArea) return null;
    let iframe = pageArea.getElementsByTagName("iframe")[0];
    if (!iframe) return null;

    let doc = iframe.contentDocument;
    if (!doc) {
      return null;
    }
    iframe = doc.getElementById("pdf-iframe-" + chapterDocIndex) as any;
    if (!iframe) {
      createPDFIframe(chapterDocIndex || 0, doc);
      iframe = doc.getElementById("pdf-iframe-" + chapterDocIndex) as any;
    }

    return iframe;
  }
  async getHightlightCoords(chapterDocIndex?: number) {
    let pageIndex =
      chapterDocIndex !== undefined
        ? chapterDocIndex
        : parseInt(this.tempLocation.chapterDocIndex);
    let subDoc = this.getSubDocument(chapterDocIndex);
    if (!subDoc) return;
    var selectionRects = subDoc.getSelection()!.getRangeAt(0).getClientRects();

    let page = await this.chapterDocList[pageIndex].text.getPage();
    let scale = await this.getPdfScale();
    var viewport = page.getViewport({ scale: scale });
    let canvas = subDoc.querySelector("canvas");
    var pageRect: any = canvas?.getClientRects()[0];

    let tempRect: {
      bottom: number;
      top: number;
      left: number;
      right: number;
    }[] = [];
    for (let i = 0; i < selectionRects.length; i++) {
      if (i === 0) {
        tempRect.push({
          bottom: selectionRects[i].bottom,
          top: selectionRects[i].top,
          left: selectionRects[i].left,
          right: selectionRects[i].right,
        });
      } else if (
        Math.abs(
          tempRect[tempRect.length - 1].bottom - selectionRects[i].bottom
        ) < 5
      ) {
        if (tempRect[tempRect.length - 1].left > selectionRects[i].left) {
          tempRect[tempRect.length - 1].left = selectionRects[i].left;
        }
        if (tempRect[tempRect.length - 1].right < selectionRects[i].right) {
          tempRect[tempRect.length - 1].right = selectionRects[i].right;
        }
      } else {
        tempRect.push({
          bottom: selectionRects[i].bottom,
          top: selectionRects[i].top,
          left: selectionRects[i].left,
          right: selectionRects[i].right,
        });
      }
    }
    var selected = tempRect.map(function (r: any) {
      return viewport
        .convertToPdfPoint(r.left - pageRect.x, r.top - pageRect.y)
        .concat(
          viewport.convertToPdfPoint(
            r.right - pageRect.x,
            r.bottom - pageRect.y
          )
        );
    });
    return { page: pageIndex, coords: selected, readerMode: this.readerMode };
  }
  async renderHighlighters(notes: any[], handleNoteClick: any) {
    if (notes.length === 0) return;
    notes = notes.reverse();
    let chapterIndex = notes[0].chapterIndex;
    let subIframe = this.getSubIframe(chapterIndex);
    let subDoc = this.getSubDocument(chapterIndex);
    if (!subDoc || !subIframe) return;
    clearHighlight(subDoc);
    let iWin: any =
      subIframe.contentWindow || subIframe.contentDocument?.defaultView;
    for (let index = 0; index < notes.length; index++) {
      const item = notes[index];
      let selected = JSON.parse(item.range);
      if (item.color === "annotation") {
        // fabric canvas 批注：selected 即 getAnnotationData 返回的 toJSON 数据
        await this.restoreAnnotation(item.chapterIndex, selected);
        continue;
      }
      var pageIndex = parseInt(selected.page + "");
      if (pageIndex !== chapterIndex) {
        continue;
      }
      let page = await this.chapterDocList[pageIndex].text.getPage();
      let scale = await this.getPdfScale();
      try {
        showPDFHighlight(
          selected,
          item.color,
          item.key,
          handleNoteClick,
          page,
          scale,
          subDoc,
          item.notes !== "",
          this.isMobile === "yes",
          item.notes || ""
        );
      } catch (e) {
        console.warn(
          e,
          "Exception has been caught when restore character ranges."
        );
        return;
      }
      if (!iWin || !iWin.getSelection()) return;
      iWin.getSelection()?.empty();
    }
  }
  async restoreAnnotation(chapterDocIndex: number, data: any) {
    if (this.platform !== "web") return;
    const canvas = this.fabricCanvasMap.get(chapterDocIndex);
    if (!canvas || !canvas.loadFromJSON) return;
    // 恢复时 fabric 会触发 object:added/removed，用 lock 阻止入历史栈和 trigger
    this.fabricHistoryLock.add(chapterDocIndex);
    // loadFromJSON 内部会用 fabric.document，先切换到该页 iframe
    this.activateFabricDocument(chapterDocIndex);
    // 画布尺寸变化时按比例缩放批注，保持与 PDF 内容的相对位置/大小不变。
    const oldW = data._canvasWidth;
    const oldH = data._canvasHeight;
    const newW = canvas.getWidth();
    const newH = canvas.getHeight();
    const ratioX = newW / oldW;
    const ratioY = newH / oldH;
    const needScale = ratioX !== 1 || ratioY !== 1;
    const reviver = needScale
      ? (jsonObj: any, fabricObj: any) => {
          if (!fabricObj) return;
          if (typeof jsonObj.left === "number") {
            fabricObj.set("left", jsonObj.left * ratioX);
          }
          if (typeof jsonObj.top === "number") {
            fabricObj.set("top", jsonObj.top * ratioY);
          }
          if (typeof jsonObj.scaleX === "number") {
            fabricObj.set("scaleX", jsonObj.scaleX * ratioX);
          }
          if (typeof jsonObj.scaleY === "number") {
            fabricObj.set("scaleY", jsonObj.scaleY * ratioY);
          }
          fabricObj.setCoords && fabricObj.setCoords();
          // 恢复出的 IText 也要挂监听，保证双击编辑后点空白是结束而非新建
          if (fabricObj.isType && fabricObj.isType("i-text")) {
            this.attachITextListeners(canvas, fabricObj);
          }
        }
      : (jsonObj: any, fabricObj: any) => {
          if (!fabricObj) return;
          if (fabricObj.isType && fabricObj.isType("i-text")) {
            this.attachITextListeners(canvas, fabricObj);
          }
        };
    try {
      await new Promise<void>((resolve) => {
        canvas.loadFromJSON(
          data,
          () => {
            canvas.requestRenderAll();
            resolve();
          },
          reviver
        );
      });
      // 恢复后的对象作为初始状态，清空历史栈避免撤销删掉恢复的批注
      this.fabricHistoryMap.set(
        chapterDocIndex,
        canvas.getObjects ? canvas.getObjects().slice() : []
      );
    } catch (e) {
      console.warn(e);
    } finally {
      this.fabricHistoryLock.delete(chapterDocIndex);
    }
  }
  removeOneNote(key: string, chapterDocIndex?: number) {
    let doc = this.getSubDocument(
      chapterDocIndex !== undefined
        ? chapterDocIndex
        : parseInt(this.tempLocation.chapterDocIndex)
    );
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
    let iframe = this.getSubIframe(item.chapterIndex);
    let subDoc = this.getSubDocument(item.chapterIndex);
    if (!subDoc || !iframe) return;
    let selected = JSON.parse(item.range);
    var pageIndex = parseInt(selected.page + "");
    let page = await this.chapterDocList[pageIndex].text.getPage();
    let scale = await this.getPdfScale();
    showPDFHighlight(
      selected,
      item.color,
      item.key,
      handleNoteClick,
      page,
      scale,
      subDoc,
      item.notes !== "",
      this.isMobile === "yes",
      item.notes || ""
    );
    this.clearSelection();
  }
  applyPDFTextLayerLineHeight(subDoc: Document) {
    let textLayer = subDoc.querySelector("#textLayer") as HTMLElement | null;
    if (!textLayer) {
      return;
    }

    // If a stable line height has been determined, apply it directly
    if (this.pdfTextLineHeightFixed !== null) {
      let styleTag = subDoc.getElementById(
        "kookit-pdf-text-layer-style"
      ) as HTMLStyleElement | null;
      if (!styleTag) {
        styleTag = subDoc.createElement("style");
        styleTag.id = "kookit-pdf-text-layer-style";
        styleTag.textContent = `
        .textLayer span {
          line-height: var(--kookit-pdf-text-line-height, 1) !important;
        }
      `;
        (subDoc.head || subDoc.documentElement).appendChild(styleTag);
      }
      textLayer.style.setProperty(
        "--kookit-pdf-text-line-height",
        this.pdfTextLineHeightFixed.toFixed(1)
      );
      return;
    }

    const getAverage = (values: number[]) => {
      if (!values.length) {
        return 0;
      }
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    };
    const filterByAverage = <T>(
      items: T[],
      getValue: (item: T) => number,
      deviationRatio: number
    ) => {
      if (items.length < 3) {
        return items;
      }
      let averageValue = getAverage(items.map(getValue));
      if (!averageValue) {
        return items;
      }
      let threshold = Math.max(averageValue * deviationRatio, 1);
      let filteredItems = items.filter(
        (item) => Math.abs(getValue(item) - averageValue) <= threshold
      );
      return filteredItems.length ? filteredItems : items;
    };

    let spans = Array.from(textLayer.querySelectorAll("span"))
      .map((span) => {
        let rect = span.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          text: span.textContent?.trim() || "",
        };
      })
      .filter((item) => item.text && item.height > 0);

    if (spans.length < 2) {
      return;
    }

    spans.sort((a, b) => {
      if (Math.abs(a.top - b.top) < 0.5) {
        return a.left - b.left;
      }
      return a.top - b.top;
    });

    let lines: {
      top: number;
      bottom: number;
      avgTop: number;
      avgHeight: number;
      count: number;
    }[] = [];

    for (let index = 0; index < spans.length; index++) {
      let span = spans[index];
      let currentLine = lines[lines.length - 1];
      if (!currentLine) {
        lines.push({
          top: span.top,
          bottom: span.bottom,
          avgTop: span.top,
          avgHeight: span.height,
          count: 1,
        });
        continue;
      }

      let sameLineTolerance = Math.max(
        2,
        Math.min(currentLine.avgHeight, span.height) * 0.5
      );
      if (Math.abs(span.top - currentLine.avgTop) <= sameLineTolerance) {
        currentLine.top = Math.min(currentLine.top, span.top);
        currentLine.bottom = Math.max(currentLine.bottom, span.bottom);
        currentLine.avgTop =
          (currentLine.avgTop * currentLine.count + span.top) /
          (currentLine.count + 1);
        currentLine.avgHeight =
          (currentLine.avgHeight * currentLine.count + span.height) /
          (currentLine.count + 1);
        currentLine.count += 1;
      } else {
        lines.push({
          top: span.top,
          bottom: span.bottom,
          avgTop: span.top,
          avgHeight: span.height,
          count: 1,
        });
      }
    }

    if (lines.length < 2) {
      return;
    }

    let filteredLines = filterByAverage(lines, (line) => line.avgHeight, 0.3);
    let averageHeight = getAverage(
      filteredLines.map((line) => line.avgHeight).filter((height) => height > 0)
    );
    if (!averageHeight) {
      textLayer.style.removeProperty("--kookit-pdf-text-line-height");
      return;
    }

    let gaps: number[] = [];
    for (let index = 0; index < filteredLines.length - 1; index++) {
      let currentLine = filteredLines[index];
      let nextLine = filteredLines[index + 1];
      let lineGap = nextLine.top - currentLine.bottom;
      if (lineGap > 0) {
        gaps.push(lineGap);
      }
    }

    let filteredGaps = filterByAverage(gaps, (gap) => gap, 0.5);
    let averageGap = getAverage(filteredGaps.filter((gap) => gap >= 0));
    let requiredLineHeight = (averageGap + averageHeight) / averageHeight;

    if (requiredLineHeight <= 1 || requiredLineHeight > 2) {
      textLayer.style.removeProperty("--kookit-pdf-text-line-height");
      return;
    }

    let styleTag = subDoc.getElementById(
      "kookit-pdf-text-layer-style"
    ) as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = subDoc.createElement("style");
      styleTag.id = "kookit-pdf-text-layer-style";
      styleTag.textContent = `
        .textLayer span {
          line-height: var(--kookit-pdf-text-line-height, 1) !important;
        }
      `;
      (subDoc.head || subDoc.documentElement).appendChild(styleTag);
    }

    let lineHeightKey = requiredLineHeight.toFixed(1);
    let count = (this.pdfTextLineHeightRecord[lineHeightKey] || 0) + 1;
    this.pdfTextLineHeightRecord[lineHeightKey] = count;
    if (count >= 3) {
      this.pdfTextLineHeightFixed = requiredLineHeight;
    }

    textLayer.style.setProperty("--kookit-pdf-text-line-height", lineHeightKey);
  }
  applyPdfCrop(subIframe: any, subDoc: Document) {
    if (this.readerMode === "scroll") {
      subDoc.body.style.overflow = "hidden";
      const visibleWidth = 100 - this.pdfCrop.left - this.pdfCrop.right;
      const scale = 100 / visibleWidth;

      // 经验补偿系数，根据你的 PDF 微调（通常 0.6~0.9）
      const compensation = 1;
      const tx =
        (this.pdfCrop.right - this.pdfCrop.left) * (scale / 2) * compensation;

      subIframe.style.transformOrigin = "50% 50%";
      subIframe.style.transform = `translateX(${tx}%) scale(${scale}) translateZ(0)`;

      if (this.pdfCrop.top > 0) {
        subDoc.body.style.position = "relative";
        subDoc.body.style.bottom = this.pdfCrop.top + 2 + "%";
      }
    }
  }
  applyAnnotationConfig(config: any) {
    if (config.annotationStyle) {
      this.setAnnotationStyle(config.annotationStyle);
    }
    if (config.brushColor) {
      this.setBrushColor(config.brushColor);
    }
    if (config.brushWidth) {
      this.setBrushWidth(config.brushWidth);
    }
    if (config.highlighterColor) {
      this.setHighlighterColor(config.highlighterColor);
    }
    if (config.highlighterWidth) {
      this.setHighlighterWidth(config.highlighterWidth);
    }
    if (config.highlighterOpacity != null) {
      this.setHighlighterOpacity(config.highlighterOpacity);
    }
    if (config.shapeType) {
      this.setShapeType(config.shapeType);
    }
    if (config.shapeColor) {
      this.setShapeColor(config.shapeColor);
    }
    if (config.shapeWidth) {
      this.setShapeWidth(config.shapeWidth);
    }
    if (config.textSize != null) {
      this.setTextSize(config.textSize);
    }
    if (config.textFont) {
      this.setTextFont(config.textFont);
    }
    if (config.textColor) {
      this.setTextColor(config.textColor);
    }
    if (config.isDrawing) {
      this.setIsDrawing(config.isDrawing);
    }
  }
  async handleRenderPDFChapter(
    chapterDocIndex: number,
    isReload: boolean = false
  ) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }

    let doc = this.getDocument();
    if (!doc) return;
    let subIframe: any = doc.getElementById("pdf-iframe-" + chapterDocIndex);
    if (!subIframe) {
      subIframe = createPDFIframe(chapterDocIndex, doc);
    }
    if (isReload) {
      await this.handleUnloadPDFChapter(chapterDocIndex);
    }
    let subDoc = subIframe?.contentDocument;
    if (!subDoc) return;
    if (subDoc.body.innerHTML && !isReload) {
      return;
    }
    subDoc.body.innerHTML = "";
    let blob = await fetch(
      await this.chapterDocList[chapterDocIndex].text.load()
    ).then((r) => r.blob());
    let chapterText = await blob.text();
    subDoc.body.innerHTML = chapterText;
    let scale = await this.getPdfScale();
    await this.chapterDocList[chapterDocIndex].text.render(
      subDoc,
      scale,
      this.isMobile,
      this,
      this.isKeepPDFBackground
    );

    let docLayer: any = subDoc.querySelector("#koodoPDFLayer");
    if (!docLayer) {
      return;
    }
    if (this.isDarkMode === "yes") {
      docLayer.style.filter = "invert(1) hue-rotate(180deg) contrast(0.95)";
    }
    if (
      this.backgroundColor === "rgba(233, 216, 188,1)" &&
      this.isScannedPDF === "yes"
    ) {
      docLayer.style.filter = "sepia(100%) contrast(0.95) brightness(0.95)";
    }
    if (
      this.backgroundColor === "rgba(197, 231, 207,1)" &&
      this.isScannedPDF === "yes"
    ) {
      docLayer.style.filter =
        "sepia(30%) hue-rotate(60deg) saturate(120%) brightness(95%)";
    }
    if (
      this.pdfCrop.top > 0 ||
      this.pdfCrop.left > 0 ||
      this.pdfCrop.right > 0
    ) {
      this.applyPdfCrop(subIframe, subDoc);
    }

    if (this.readerMode === "single" || this.readerMode === "double") {
      let additionalHeight =
        this.element.clientHeight / 2 -
        docLayer.getBoundingClientRect().height / 2;
      docLayer.style.marginTop = additionalHeight + "px";
      subIframe.style.height =
        docLayer.getBoundingClientRect().height + additionalHeight + "px";

      let noteLayer: any = subDoc.querySelector(".noteLayer");
      if (noteLayer) {
        noteLayer.style.position = "relative";
      }
    }
    if (this.readerMode !== "scroll") {
      docLayer.style.marginLeft = `calc(50% - ${
        docLayer.getBoundingClientRect().width / 2
      }px)`;
    }
    docLayer.style.visibility = "visible";
    if (
      this.platform === "android" &&
      this.enablePDFSelectionOptimization === "yes"
    ) {
      this.applyPDFTextLayerLineHeight(subDoc);
    }
    if (this.platform === "web" && this.isScannedPDF === "yes") {
      let canvasEle = subDoc.querySelector("#fabric");
      if (canvasEle) {
        canvasEle.style.display = "block";
        // fabric 在主 document 加载，fabric.document/fabric.window 默认指向主窗口。
        // canvas 嵌在 iframe 中，必须让 fabric 的节点与事件监听绑定到该 iframe，
        // 否则 mousedown 后 fabric 会把 mousemove/mouseup 绑到主 document，
        // 导致鼠标移出 canvas 后绘图状态不被重置、拖动无法延伸。
        const subWin = subDoc.defaultView;
        const fabricLib = window.fabric;
        if (subWin) {
          fabricLib.document = subDoc;
          fabricLib.window = subWin;
        }
        const canvas = new fabricLib.Canvas(canvasEle, {
          isDrawingMode: this.isDrawing === "yes",
          selection: true,
          backgroundColor: "transparent",
        });
        // canvas 元素无显式 width/height 属性，fabric 默认取 300x150 作为绘图缓冲区，
        // 与 PDF 页面显示尺寸不匹配，导致绘制位置错乱。按 docLayer 实际尺寸重设。
        const layerRect = docLayer.getBoundingClientRect();
        if (layerRect.width > 0 && layerRect.height > 0) {
          canvas.setDimensions({
            width: Math.round(layerRect.width),
            height: Math.round(layerRect.height),
          });
        }
        this.applyFabricBrush(canvas);
        this.fabricCanvasMap.set(chapterDocIndex, canvas);
        this.fabricHistoryMap.set(chapterDocIndex, []);
        canvas.on("object:added", (opt: any) => {
          // 锁用于 restoreAnnotation 的 loadFromJSON：恢复是加载数据而非用户修改，
          // 不入历史栈、也不触发 annotation-changed。用户主动的增删改不加锁，正常触发。
          if (this.fabricHistoryLock.has(chapterDocIndex)) return;
          this.pushFabricHistory(chapterDocIndex, opt.target);
          this.trigger("annotation-changed", [chapterDocIndex] as any);
        });
        canvas.on("object:removed", () => {
          if (this.fabricHistoryLock.has(chapterDocIndex)) return;
          this.trigger("annotation-changed", [chapterDocIndex] as any);
        });
        canvas.on("object:modified", () => {
          if (this.fabricHistoryLock.has(chapterDocIndex)) return;
          this.trigger("annotation-changed", [chapterDocIndex] as any);
        });
        // 捕获阶段纠正 fabric 运行环境：用户点击 canvas 前，确保 fabric 把
        // mousemove/mouseup 监听器绑到当前 iframe 的 document，而非被其他页面切走。
        const syncFabricEnv = () => {
          if (subWin && fabricLib) {
            fabricLib.document = subDoc;
            fabricLib.window = subWin;
          }
        };
        subDoc.addEventListener("mousedown", syncFabricEnv, true);
        subDoc.addEventListener("touchstart", syncFabricEnv, true);
        this.fabricSyncListenerMap.set(chapterDocIndex, {
          doc: subDoc,
          fn: syncFabricEnv,
        });
        this.attachFabricKeyListeners(chapterDocIndex, subDoc);
        this.attachShapeDrawListeners(chapterDocIndex, canvas);
        this.attachTextCreateListeners(chapterDocIndex, canvas);
      }
    }
    this.trigger("rendered", [chapterDocIndex] as any);
  }
  applyFabricBrush(canvas: any) {
    if (!canvas) return;
    const drawing = this.isDrawing === "yes";
    // shape 用自定义拖拽绘制几何图形，text 用 mouse:down 创建 IText，都不走 freeDrawingBrush
    const isShape = this.annotationStyle === "shape";
    const isText = this.annotationStyle === "text";
    if (canvas.freeDrawingBrush && !isShape && !isText) {
      if (this.annotationStyle === "highlighter") {
        canvas.freeDrawingBrush.color = this.toRgba(
          this.highlighterColor,
          this.highlighterOpacity
        );
        canvas.freeDrawingBrush.width = this.highlighterWidth;
        canvas.freeDrawingBrush.strokeLineCap = "round";
        canvas.freeDrawingBrush.strokeLineJoin = "round";
      } else {
        canvas.freeDrawingBrush.color = this.brushColor;
        canvas.freeDrawingBrush.width = this.brushWidth;
      }
    }
    canvas.isDrawingMode = drawing && !isShape && !isText;
    if (drawing) {
      if (isText) {
        // text 模式保留 selection，以便双击已有文字进入编辑
        canvas.selection = true;
        canvas.defaultCursor = "text";
        canvas.hoverCursor = "text";
      } else {
        canvas.selection = false;
        canvas.defaultCursor = "crosshair";
        canvas.hoverCursor = "crosshair";
      }
    } else {
      canvas.selection = true;
      canvas.defaultCursor = "default";
      canvas.hoverCursor = "move";
    }
  }
  createShapeObject(x1: number, y1: number, x2: number, y2: number): any {
    const fabricLib = window.fabric;
    if (!fabricLib) return null;
    const color = this.shapeColor;
    const width = this.shapeWidth;
    const common: any = {
      stroke: color,
      strokeWidth: width,
      strokeLineCap: "round",
      strokeLineJoin: "round",
      fill: "transparent",
      selectable: true,
    };
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    switch (this.shapeType) {
      case "rect":
        return new fabricLib.Rect({
          ...common,
          left: minX,
          top: minY,
          width: absDx,
          height: absDy,
        });
      case "circle": {
        const radius = Math.hypot(dx, dy) / 2;
        return new fabricLib.Circle({
          ...common,
          left: x1,
          top: y1,
          radius,
          originX: "center",
          originY: "center",
        });
      }
      case "ellipse":
        return new fabricLib.Ellipse({
          ...common,
          left: (x1 + x2) / 2,
          top: (y1 + y2) / 2,
          rx: absDx / 2,
          ry: absDy / 2,
          originX: "center",
          originY: "center",
        });
      case "line":
        return new fabricLib.Line([x1, y1, x2, y2], {
          stroke: color,
          strokeWidth: width,
          strokeLineCap: "round",
          selectable: true,
        });
      case "arrow":
        return new fabricLib.Path(this.buildArrowPath(x1, y1, x2, y2, width), {
          stroke: color,
          strokeWidth: width,
          strokeLineCap: "round",
          strokeLineJoin: "round",
          fill: color,
          selectable: true,
        });
      default:
        return null;
    }
  }
  buildArrowPath(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number
  ): any[] {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) {
      return [
        ["M", x1, y1],
        ["L", x2, y2],
      ];
    }
    const ux = dx / len;
    const uy = dy / len;
    const head = Math.max(width * 3, 8);
    const wing = head * 0.5;
    const px = -uy;
    const py = ux;
    const baseX = x2 - ux * head;
    const baseY = y2 - uy * head;
    const w1X = baseX + px * wing;
    const w1Y = baseY + py * wing;
    const w2X = baseX - px * wing;
    const w2Y = baseY - py * wing;
    return [
      ["M", x1, y1],
      ["L", baseX, baseY],
      ["M", w1X, w1Y],
      ["L", x2, y2],
      ["L", w2X, w2Y],
      ["Z"],
    ];
  }
  attachShapeDrawListeners(chapterDocIndex: number, canvas: any) {
    if (!canvas) return;
    let isDown = false;
    let origX = 0;
    let origY = 0;
    let lastX = 0;
    let lastY = 0;
    let activeShape: any = null;
    canvas.on("mouse:down", (o: any) => {
      if (this.annotationStyle !== "shape" || this.isDrawing !== "yes") return;
      isDown = true;
      const pointer = canvas.getPointer(o.e);
      origX = pointer.x;
      origY = pointer.y;
      lastX = origX;
      lastY = origY;
      // 拖拽预览阶段产生的 add/remove 不入历史、不触发 annotation-changed
      this.fabricHistoryLock.add(chapterDocIndex);
      activeShape = this.createShapeObject(origX, origY, origX, origY);
      if (activeShape) canvas.add(activeShape);
    });
    canvas.on("mouse:move", (o: any) => {
      if (!isDown || !activeShape) return;
      const pointer = canvas.getPointer(o.e);
      lastX = pointer.x;
      lastY = pointer.y;
      const next = this.createShapeObject(origX, origY, lastX, lastY);
      if (next) {
        canvas.remove(activeShape);
        activeShape = next;
        canvas.add(activeShape);
        canvas.requestRenderAll();
      }
    });
    canvas.on("mouse:up", () => {
      if (!isDown) return;
      isDown = false;
      this.fabricHistoryLock.delete(chapterDocIndex);
      const moved = Math.hypot(lastX - origX, lastY - origY) >= 2;
      if (activeShape && moved) {
        this.pushFabricHistory(chapterDocIndex, activeShape);
        this.trigger("annotation-changed", [chapterDocIndex] as any);
      } else if (activeShape) {
        canvas.remove(activeShape);
        canvas.requestRenderAll();
      }
      activeShape = null;
    });
  }
  attachTextCreateListeners(chapterDocIndex: number, canvas: any) {
    if (!canvas) return;
    canvas.on("mouse:down", (o: any) => {
      if (this.annotationStyle !== "text" || this.isDrawing !== "yes") return;
      // 消费上一次 editing:exited 留下的标志：fabric 在 fire mouse:down 之前会先
      // 对空白点击调用当前 IText 的 exitEditing，该回调设置此标志表示"本次点击已结束上一个输入"
      const justExited = canvas._kookitJustExitedText === true;
      canvas._kookitJustExitedText = false;
      // 点中已有对象时交给 fabric 默认的选中/双击编辑流程
      const target = canvas.findTarget(o.e);
      if (target) return;
      // 本次 mousedown 已触发上一个 IText 退出编辑：视为"结束输入"，不新建
      if (justExited) return;
      // 兜底：另一种 fabric 时序下 exitEditing 尚未发生，手动退出并清标志
      const active = canvas.getActiveObject();
      if (active && (active as any).isEditing) {
        (active as any).exitEditing();
        canvas._kookitJustExitedText = false;
        return;
      }
      const pointer = canvas.getPointer(o.e);
      const fabricLib = window.fabric;
      if (!fabricLib || !fabricLib.IText) return;
      const text = new fabricLib.IText("", {
        left: pointer.x,
        top: pointer.y,
        fontSize: this.textSize,
        fontFamily: this.textFont,
        fill: this.textColor,
        editable: true,
        selectable: true,
      });
      // canvas.add 触发 object:added，已自动入历史栈并 trigger annotation-changed
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      text.hiddenTextarea?.focus();
      // hiddenTextarea 在 iframe 内，主 document 抢焦点会导致键盘输入不进；
      // focus 后若焦点没落到 textarea，再切到子 window 重 focus 一次
      const subWin =
        canvas.getElement && canvas.getElement().ownerDocument
          ? canvas.getElement().ownerDocument.defaultView
          : null;
      if (subWin && document.activeElement !== text.hiddenTextarea) {
        try {
          subWin.focus();
        } catch (e) {}
        text.hiddenTextarea?.focus();
      }
      this.attachITextListeners(canvas, text);
    });
  }
  attachITextListeners(canvas: any, text: any) {
    if (!canvas || !text || text._kookitListenersAttached) return;
    text._kookitListenersAttached = true;
    // 输入过程与退出编辑时重算尺寸并刷新，确保文字框随内容自适应而非固定尺寸
    const finalizeText = () => {
      try {
        text.setCoords();
      } catch (e) {}
      canvas.requestRenderAll();
    };
    text.on("text:changed", finalizeText);
    // 退出编辑时置标志，使紧随其后的 mouse:down 跳过新建，仅完成输入
    text.on("editing:exited", () => {
      canvas._kookitJustExitedText = true;
      finalizeText();
    });
  }
  toRgba(color: string, alpha: number) {
    if (typeof color !== "string" || !color) {
      return `rgba(255,255,0,${alpha})`;
    }
    const trim = color.trim();
    const rgbaMatch = trim.match(
      /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i
    );
    if (rgbaMatch) {
      const r = Math.round(parseFloat(rgbaMatch[1]));
      const g = Math.round(parseFloat(rgbaMatch[2]));
      const b = Math.round(parseFloat(rgbaMatch[3]));
      return `rgba(${r},${g},${b},${alpha})`;
    }
    const hexMatch = trim.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      let hex = hexMatch[1];
      if (hex.length === 3) {
        hex = hex
          .split("")
          .map((c) => c + c)
          .join("");
      }
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return `rgba(255,255,0,${alpha})`;
  }
  pushFabricHistory(chapterDocIndex: number, obj: any) {
    if (!obj) return;
    let history = this.fabricHistoryMap.get(chapterDocIndex);
    if (!history) {
      history = [];
      this.fabricHistoryMap.set(chapterDocIndex, history);
    }
    history.push(obj);
  }
  attachFabricKeyListeners(chapterDocIndex: number, subDoc: Document) {
    subDoc.addEventListener("keydown", (e: KeyboardEvent) => {
      const canvas = this.fabricCanvasMap.get(chapterDocIndex);
      if (!canvas) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        this.undoFabric(chapterDocIndex);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        // IText 处于编辑态时，删除键应删字符而非整框，交还给 IText 自身处理
        const activeObj = canvas.getActiveObject();
        if (activeObj && (activeObj as any).isEditing) return;
        const active = canvas.getActiveObjects();
        if (active && active.length > 0) {
          e.preventDefault();
          active.forEach((obj: any) => {
            canvas.remove(obj);
            const history = this.fabricHistoryMap.get(chapterDocIndex);
            if (history) {
              const idx = history.lastIndexOf(obj);
              if (idx >= 0) history.splice(idx, 1);
            }
          });
          canvas.discardActiveObject();
          canvas.requestRenderAll();
        }
      }
    });
  }
  undoFabric(chapterDocIndex: number) {
    const canvas = this.fabricCanvasMap.get(chapterDocIndex);
    if (!canvas) return;
    const history = this.fabricHistoryMap.get(chapterDocIndex);
    if (!history || history.length === 0) {
      return;
    }
    const last = history.pop();
    if (last) {
      canvas.remove(last);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  }
  setBrushColor(color: string) {
    this.brushColor = color;
    this.fabricCanvasMap.forEach((canvas: any) => {
      this.applyFabricBrush(canvas);
      canvas.requestRenderAll();
    });
  }
  setHighlighterColor(color: string) {
    this.highlighterColor = color;
    this.fabricCanvasMap.forEach((canvas: any) => {
      this.applyFabricBrush(canvas);
      canvas.requestRenderAll();
    });
  }
  setHighlighterOpacity(opacity: number) {
    this.highlighterOpacity = opacity;
    this.fabricCanvasMap.forEach((canvas: any) => {
      this.applyFabricBrush(canvas);
      canvas.requestRenderAll();
    });
  }
  setAnnotationStyle(style: string) {
    this.annotationStyle = style;
    this.fabricCanvasMap.forEach((canvas: any) => {
      this.applyFabricBrush(canvas);
      canvas.requestRenderAll();
    });
  }
  setBrushWidth(width: number) {
    this.brushWidth = width;
    this.fabricCanvasMap.forEach((canvas: any) => {
      this.applyFabricBrush(canvas);
      canvas.requestRenderAll();
    });
  }
  setHighlighterWidth(width: number) {
    this.highlighterWidth = width;
    this.fabricCanvasMap.forEach((canvas: any) => {
      this.applyFabricBrush(canvas);
      canvas.requestRenderAll();
    });
  }
  setShapeType(shapeType: string) {
    this.shapeType = shapeType;
    this.fabricCanvasMap.forEach((canvas: any) => {
      this.applyFabricBrush(canvas);
      canvas.requestRenderAll();
    });
  }
  setShapeColor(color: string) {
    this.shapeColor = color;
    this.fabricCanvasMap.forEach((canvas: any) => {
      this.applyFabricBrush(canvas);
      canvas.requestRenderAll();
    });
  }
  setShapeWidth(width: number) {
    this.shapeWidth = width;
    this.fabricCanvasMap.forEach((canvas: any) => {
      this.applyFabricBrush(canvas);
      canvas.requestRenderAll();
    });
  }
  setTextSize(size: number) {
    this.textSize = size;
    this.fabricCanvasMap.forEach((canvas: any) => {
      this.applyFabricBrush(canvas);
      canvas.requestRenderAll();
    });
  }
  setTextFont(font: string) {
    this.textFont = font;
    this.fabricCanvasMap.forEach((canvas: any) => {
      this.applyFabricBrush(canvas);
      canvas.requestRenderAll();
    });
  }
  setTextColor(color: string) {
    this.textColor = color;
    this.fabricCanvasMap.forEach((canvas: any) => {
      this.applyFabricBrush(canvas);
      canvas.requestRenderAll();
    });
  }
  setIsDrawing(isDrawing: string) {
    this.isDrawing = isDrawing;
    this.fabricCanvasMap.forEach((canvas: any) => {
      this.applyFabricBrush(canvas);
      canvas.requestRenderAll();
    });
  }
  getAnnotationData(chapterDocIndex: number): any {
    const canvas = this.fabricCanvasMap.get(chapterDocIndex);
    if (!canvas || !canvas.toJSON) return null;
    const data = canvas.toJSON(["selectable", "_kookitLogged"]);
    // 记录画布尺寸，恢复时按新旧尺寸比例缩放，保证批注与 PDF 内容相对位置不变
    data._canvasWidth = canvas.getWidth();
    data._canvasHeight = canvas.getHeight();
    return data;
  }
  async handleUnloadPDFChapter(chapterDocIndex: number) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }
    let subDoc = this.getSubDocument(chapterDocIndex);
    if (!subDoc) return;
    if (subDoc.body.innerHTML === "") {
      return;
    }
    const canvas = this.fabricCanvasMap.get(chapterDocIndex);
    if (canvas && canvas.dispose) {
      try {
        canvas.dispose();
      } catch (e) {
        console.warn(e);
      }
    }
    const syncListener = this.fabricSyncListenerMap.get(chapterDocIndex);
    if (syncListener) {
      try {
        syncListener.doc.removeEventListener(
          "mousedown",
          syncListener.fn,
          true
        );
        syncListener.doc.removeEventListener(
          "touchstart",
          syncListener.fn,
          true
        );
      } catch (e) {
        console.warn(e);
      }
      this.fabricSyncListenerMap.delete(chapterDocIndex);
    }
    await this.chapterDocList[chapterDocIndex].text.unload();
    this.fabricCanvasMap.delete(chapterDocIndex);
    this.fabricHistoryMap.delete(chapterDocIndex);
    this.fabricHistoryLock.delete(chapterDocIndex);
    subDoc.body.innerHTML = "";
  }
  async renderPdfPage(chapterDocIndex: number) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    } else if (chapterDocIndex > 3) {
      await this.handleUnloadPDFChapter(chapterDocIndex - 4);
    }
    await this.handleRenderPDFChapter(chapterDocIndex);
    this.handleRenderPDFChapter(chapterDocIndex + 1);
    if (this.platform === "ios") {
      //ios 性能太差，先不预渲染后续章节了
      return;
    }
    this.handleRenderPDFChapter(chapterDocIndex + 2);
    this.handleRenderPDFChapter(chapterDocIndex + 3);
    // 预渲染会把 fabric.document 切到后续页，恢复为当前页 iframe，
    // 保证用户在当前页绘制时 fabric 的 mousemove/mouseup 监听器挂在正确 document 上
    this.activateFabricDocument(chapterDocIndex);
  }
  activateFabricDocument(chapterDocIndex: number) {
    if (this.platform !== "web") return;
    const subDoc = this.getSubDocument(chapterDocIndex);
    if (!subDoc) return;
    const subWin = subDoc.defaultView;
    const fabricLib = window.fabric;
    if (subWin && fabricLib) {
      fabricLib.document = subDoc;
      fabricLib.window = subWin;
    }
  }
  getPdfScale = async () => {
    if (this.pdfScale && this.pdfScale > 0) {
      return this.pdfScale;
    }
    let doc = this.getDocument();
    if (this.readerMode === "scroll") {
      doc = this.getSubDocument(this.templateChapterDocIndex);
    }
    if (!doc) return 1;
    let { width, height } =
      await this.chapterDocList[
        this.templateChapterDocIndex
      ].text.getDimension();

    let viewWidth = doc.body.clientWidth;
    let viewHeight = this.element.clientHeight;
    if (this.readerMode === "double") {
      let scale = this.readerMode === "double" ? 2 : 1;
      let section = Math.floor(this.element.clientWidth / 12);
      let gap = section % 2 === 0 ? section : section - 1;
      viewWidth = (viewWidth - gap) / scale;
    }
    let scale = Math.min(viewWidth / width, viewHeight / height);
    if (this.readerMode === "scroll") {
      viewWidth = viewWidth - 10;
      scale = viewWidth / width;
    }
    this.pdfScale = scale;
    return scale;
  };
}
export default PdfRender;
