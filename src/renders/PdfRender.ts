import { createIframe, getSelectedElement } from "../utils/layoutUtil.js";
import GeneralParser from "../utils/generalParser.js";
import { isPDF, makePDF } from "../libs/pdf.js";
import GeneralRender from "./GeneralRender.js";
import { clearHighlight, showPDFHighlight } from "../utils/noteUtil.js";
import {
  createPDFContainer,
  createPDFIframe,
  getPDFVisibleText,
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
  password: string = "";
  pdfScale: number = 0;
  scale: number = 1;
  backgroundColor: string;
  isScannedPDF: string;
  templateChapterDocIndex: number = 0;
  platform: string;
  constructor(pdfBuffer: ArrayBuffer, config: any) {
    super({ ...config, convertChinese: "Default", format: "PDF" });
    this.pdfBuffer = pdfBuffer;
    this.isStartFromEven = config.isStartFromEven || "no";
    this.password = config.password || "";
    this.scale = config.scale || 1;
    this.backgroundColor = config.backgroundColor || "#ffffff";
    this.isScannedPDF = config.isScannedPDF || "no";
    this.platform = config.platform || "web";
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
      if (this.isStartFromEven === "yes") {
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
      if (
        document.body.clientWidth * Math.abs(this.scale) -
          document.body.clientWidth * 0.4 >
          document.body.clientWidth &&
        this.readerMode !== "double"
      ) {
        createIframe(element, this.scale);
      } else {
        createIframe(element);
      }
      const viewportFirst = await this.chapterDocList[0].text.getDimension();
      const viewportLast = await this.chapterDocList[
        this.chapterDocList.length - 1
      ].text.getDimension();

      const viewportMid = await this.chapterDocList[
        Math.floor(this.chapterDocList.length / 2)
      ].text.getDimension();
      //使用长宽比最大的作为viewport，避免横屏时页面过宽
      let viewport =
        viewportFirst.height / viewportFirst.width >
        viewportLast.height / viewportLast.width
          ? viewportFirst
          : viewportLast;
      this.templateChapterDocIndex =
        viewport === viewportFirst ? 0 : this.chapterDocList.length - 1;
      viewport =
        viewport.height / viewport.width >
        viewportMid.height / viewportMid.width
          ? viewport
          : viewportMid;
      this.templateChapterDocIndex =
        viewport === viewportMid
          ? Math.floor(this.chapterDocList.length / 2)
          : this.templateChapterDocIndex;
      console.log(this.templateChapterDocIndex, "templateChapterDocIndex");
      //根据viewport的判断结果设置模板chapterDocIndex
      let doc: any = this.getDocument();
      if (!doc) return;
      createPDFContainer(
        doc.body || (doc.documentElement as HTMLElement),
        this.chapterDocList,
        viewport,
        this.readerMode
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
  async handlePDFScrollEvent(doc: Document) {
    let subContainers = doc.querySelectorAll(".pdf-container");
    for (let index = 0; index < subContainers.length; index++) {
      let subContainer = subContainers[index];
      let id = subContainer.getAttribute("id");
      if (!id) continue;
      let chapterDocIndex = parseInt(id.split("-").reverse()[0]);
      if (
        isPDFScrolledIntoView(
          this.element,
          subContainer as HTMLElement,
          this.readerMode,
          doc
        )
      ) {
        await this.renderPdfPage(chapterDocIndex, doc);
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
      if (await isPDF(file)) {
        this.book = await makePDF(file, this.password);
      }
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
  getPageSize() {
    let doc = this.getDocument();
    if (!doc) return;
    let scale = this.readerMode === "double" ? 2 : 1;
    let section = Math.floor(doc.body.clientWidth / 12);
    let gap = section % 2 === 0 ? section : section - 1;

    let subIframe = doc.querySelectorAll("iframe")[0];
    let iframeHeight = subIframe?.getBoundingClientRect().height;
    return {
      width: doc.body.clientWidth,
      height: this.element.clientHeight,
      left: this.element.offsetLeft,
      top: this.element.offsetTop,
      scrollTop: this.element.scrollTop,
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
    await this.renderPdfPage(chapterDocIndex, doc);
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
    await this.renderPdfPage(parseInt(chapterDocIndex), doc);
    if (this.readerMode === "scroll") {
      let subIframe = this.getSubIframe(
        chapterDocIndex !== undefined
          ? chapterDocIndex
          : parseInt(this.tempLocation.chapterDocIndex)
      );
      if (!subIframe) return;
      let iframeHeight =
        subIframe.parentElement?.getBoundingClientRect().height || 0;
      iframe.style.height = iframeHeight * this.chapterDocList.length + "px";
    }

    await handleScrollPDFPosition(
      parseInt(chapterDocIndex),
      this.readerMode,
      doc
    );
    rangy.init();
    await this.recordByChapter(parseInt(chapterDocIndex));
    // this.addPageAnimation();
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
          (this.readerMode === "double" ? 2 : 1),
        doc
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
          (this.readerMode === "double" ? 2 : 1),
        doc
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
    let doc = this.getDocument();
    if (!doc) return "";
    return await getPDFVisibleText(
      parseInt(this.tempLocation.chapterDocIndex || "0"),
      this.chapterDocList,
      this.readerMode
    );
  }
  async audioText() {
    return await this.visibleText();
  }
  async chapterText() {
    return (await this.visibleText()).join(" ");
  }
  async record(): Promise<void> {
    if (this.animation !== "") {
      await new Promise((r) => setTimeout(r, 1000));
    }
    let doc = this.getDocument();
    if (!doc) return;
    await this.handlePDFRecord(doc);
  }
  async recordByChapter(chapterDocIndex: number): Promise<void> {
    if (this.animation !== "") {
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }
    this.tempLocation.chapterDocIndex = chapterDocIndex + "";
    this.tempLocation.percentage =
      chapterDocIndex / (this.chapterDocList.length - 1) + "";
    this.tempLocation.chapterHref = this.chapterDocList[chapterDocIndex].href;
    this.tempLocation.chapterTitle = this.chapterDocList[chapterDocIndex].label;
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
        chapterDocIndex / (this.chapterDocList.length - 1) + "";
      this.tempLocation.chapterHref = this.chapterDocList[chapterDocIndex].href;
      this.tempLocation.chapterTitle =
        this.chapterDocList[chapterDocIndex].label;
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
      var pageIndex = parseInt(selected.page + "");
      if (pageIndex !== chapterIndex) {
        continue;
      }
      let page = await this.chapterDocList[pageIndex].text.getPage();
      let scale = await this.getPdfScale();
      console.log(scale, "sca324lesf234sdf");
      try {
        showPDFHighlight(
          selected,
          item.color,
          item.key,
          handleNoteClick,
          page,
          scale,
          subDoc
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
    console.log(scale, "scalesf234sdf");
    showPDFHighlight(
      selected,
      item.color,
      item.key,
      handleNoteClick,
      page,
      scale,
      subDoc
    );
    this.clearSelection();
  }
  async handleRenderPDFChapter(chapterDocIndex: number, doc: Document) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }

    let subIframe: any = doc.getElementById("pdf-iframe-" + chapterDocIndex);
    if (!subIframe) {
      subIframe = createPDFIframe(chapterDocIndex, doc);
    }
    let subDoc = subIframe?.contentDocument;
    if (!subDoc) return;
    if (subDoc.body.innerHTML) {
      return;
    }
    subDoc.body.innerHTML = "";
    let blob = await fetch(
      await this.chapterDocList[chapterDocIndex].text.load()
    ).then((r) => r.blob());
    let chapterText = await blob.text();
    subDoc.body.innerHTML = chapterText;
    let scale = await this.getPdfScale();
    console.log(scale, "scalesfsdf");
    await this.chapterDocList[chapterDocIndex].text.render(
      subDoc,
      scale,
      this.isMobile,
      this
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
    window.chapterDocIndex = chapterDocIndex;
    this.trigger("rendered");
  }
  async handleUnloadPDFChapter(chapterDocIndex: number, doc: Document) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }
    let subDoc = this.getSubDocument(chapterDocIndex);
    if (!subDoc) return;
    if (subDoc.body.innerHTML === "") {
      return;
    }
    await this.chapterDocList[chapterDocIndex].text.unload();
    subDoc.body.innerHTML = "";
  }
  async renderPdfPage(chapterDocIndex: number, doc: Document) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    } else if (chapterDocIndex > 2) {
      await this.handleUnloadPDFChapter(chapterDocIndex - 3, doc);
    }
    await this.handleRenderPDFChapter(chapterDocIndex, doc);

    await this.handleRenderPDFChapter(chapterDocIndex + 1, doc);
  }
  getPdfScale = async () => {
    console.log(this.pdfScale, "this.pdfScale");
    if (this.pdfScale && this.pdfScale > 0) {
      return this.pdfScale;
    }
    let doc = this.getDocument();
    if (!doc) return 1;
    let { width, height } = await this.chapterDocList[
      this.templateChapterDocIndex
    ].text.getDimension();

    let viewWidth = doc.body.clientWidth;
    let viewHeight = this.element.clientHeight;
    let scale = Math.min(viewWidth / width, viewHeight / height);
    if (this.readerMode === "scroll") {
      scale = viewWidth / width;
    }
    this.pdfScale = scale;
    console.log(scale, "scale11111111");
    return scale;
  };
}
export default PdfRender;
