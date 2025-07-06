import { createIframe, getSelectedElement } from "../utils/layoutUtil.js";
import GeneralParser from "../utils/generalParser.js";
import { isPDF, makePDF } from "../libs/pdf.js";
import GeneralRender from "./GeneralRender.js";
import { clearHighlight, showPDFHighlight } from "../utils/noteUtil.js";
import {
  createPDFContainer,
  createPDFIframe,
  getPdfScale,
  getPDFVisibleText,
  handleHighlightPDFNode,
  handleIOSScrollPage,
  handlePDFLayout,
  handleScrollPDFPosition,
  isPDFScrolledIntoView,
} from "../utils/pdfUtil.js";
import { handleScrollPage } from "../utils/navigationUtil.js";
class PdfRender extends GeneralRender {
  pdfBuffer: ArrayBuffer;
  isStartFromEven: string = "no";
  constructor(pdfBuffer: ArrayBuffer, config: any) {
    super({ format: "PDF", ...config, convertChinese: "Default" });
    this.pdfBuffer = pdfBuffer;
    this.isStartFromEven = config.isStartFromEven || "no";
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
      createIframe(element);
      const viewport = await this.chapterDocList[0].text.getDimension();
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
          this.readerMode
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
        this.book = await makePDF(file, this.readerMode);
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
    let scale = this.readerMode === "double" ? 2 : 1;
    let section = Math.floor(this.element.clientWidth / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    let doc = this.getDocument();
    if (!doc) return;
    let subIframe = doc.querySelectorAll("iframe")[0];
    let iframeHeight = subIframe?.getBoundingClientRect().height;
    return {
      width: this.element.clientWidth,
      height: this.element.clientHeight,
      left: this.element.offsetLeft,
      top: this.element.offsetTop,
      scrollTop: this.element.scrollTop,
      sectionWidth: (this.element.clientWidth - gap) / scale,
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
    await this.record();
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
    await this.record();
    this.trigger("page-changed");
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
  async handlePDFRecord(doc: Document) {
    let subContainers = doc.querySelectorAll(".pdf-container");
    if (
      subContainers.length > 0 &&
      isPDFScrolledIntoView(
        this.element,
        subContainers[subContainers.length - 1] as HTMLElement,
        this.readerMode
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
          this.readerMode
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
      return {
        ...metadata,
        description:
          (metadata.description ? metadata.description : "") +
          (this.book.metadata.isScannedPdf ? "\nscanned PDF" : ""),
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  highlightNode(text: string, style: string) {
    let doc = this.getDocument();
    if (!doc) return;
    handleHighlightPDFNode(text, style, doc);
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
    let doc = this.getSubDocument(chapterDocIndex);
    if (!doc) return;

    var selectionRects = doc.getSelection()!.getRangeAt(0).getClientRects();

    let page = await this.chapterDocList[pageIndex].text.getPage();
    let scale = await getPdfScale(
      this.element,
      this.readerMode,
      this.chapterDocList,
      pageIndex
    );
    var viewport = page.getViewport({ scale: scale });
    let canvas = doc.querySelector("canvas");
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
    let iframe = this.getSubIframe(chapterIndex);
    let doc = this.getSubDocument(chapterIndex);
    if (!doc || !iframe) return;
    clearHighlight(doc);
    let iWin: any = iframe.contentWindow || iframe.contentDocument?.defaultView;
    for (let index = 0; index < notes.length; index++) {
      const item = notes[index];
      let selected = JSON.parse(item.range);
      var pageIndex = parseInt(selected.page + "");
      if (pageIndex !== chapterIndex) {
        continue;
      }
      let page = await this.chapterDocList[pageIndex].text.getPage();
      let scale = await getPdfScale(
        this.element,
        this.readerMode,
        this.chapterDocList,
        pageIndex
      );
      try {
        showPDFHighlight(
          selected,
          item.color,
          item.key,
          handleNoteClick,
          page,
          scale,
          doc
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
    let doc = this.getSubDocument(item.chapterIndex);
    if (!doc || !iframe) return;
    let selected = JSON.parse(item.range);
    var pageIndex = parseInt(selected.page + "");
    let page = await this.chapterDocList[pageIndex].text.getPage();
    let scale = await getPdfScale(
      this.element,
      this.readerMode,
      this.chapterDocList,
      pageIndex
    );
    showPDFHighlight(
      selected,
      item.color,
      item.key,
      handleNoteClick,
      page,
      scale,
      doc
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
    let scale = await getPdfScale(
      this.element,
      this.readerMode,
      this.chapterDocList,
      chapterDocIndex
    );

    await this.chapterDocList[chapterDocIndex].text.render(
      subDoc,
      scale,
      this.isMobile,
      this.isDarkMode
    );
    if (this.readerMode === "single" || this.readerMode === "double") {
      let subDoc = this.getSubDocument(chapterDocIndex);
      if (!subDoc) return;
      let docLayer: any = subDoc.querySelector("#koodoPDFLayer");
      if (docLayer) {
        docLayer.style.marginTop = `calc(${this.element.clientHeight / 2}px - ${
          docLayer.getBoundingClientRect().height / 2
        }px)`;
      }
    }
    this.trigger("rendered");
  }
  async handleUnloadPDFChapter(chapterDocIndex: number, doc: Document) {
    if (chapterDocIndex >= this.chapterDocList.length || chapterDocIndex < 0) {
      return;
    }
    let subContainer: any = doc.querySelector(
      "#pdf-container-" + chapterDocIndex
    );
    if (!subContainer) return;
    if (subContainer.innerHTML === "") {
      return;
    }
    await this.chapterDocList[chapterDocIndex].text.unload();

    subContainer.innerHTML = "";
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
}
export default PdfRender;
