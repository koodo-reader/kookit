import { createIframe } from "../utils/layoutUtil.js";
import GeneralParser from "../utils/generalParser.js";
import { isPDF, makePDF } from "../libs/pdf.js";
import GeneralRender from "./GeneralRender.js";
import { clearHighlight, showPDFHighlight } from "../utils/noteUtil.js";
import {
  createPDFIframe,
  getPdfScale,
  handlePDFLayout,
  handlePDFRecord,
  handlePDFScrollEvent,
  handleRenderPDFChapter,
  handleScrollPDFPosition,
  renderPdfPage,
} from "../utils/pdfUtil.js";
import { handleScrollPage } from "../utils/navigationUtil.js";
class PdfRender extends GeneralRender {
  pdfBuffer: ArrayBuffer;
  constructor(pdfBuffer: ArrayBuffer, config: any) {
    super({ format: "PDF", ...config, convertChinese: "Default" });
    this.pdfBuffer = pdfBuffer;
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
      createIframe(element);
      const viewport = await this.chapterDocList[0].text.getDimension();
      console.log("viewport", viewport);
      let doc: any = this.getDocument();
      if (!doc) return;
      console.log("doc", doc);
      createPDFIframe(
        doc.body || (doc.documentElement as HTMLElement),
        this.chapterDocList,
        viewport
      );
      if (this.readerMode === "scroll") {
        let subIframe = doc.querySelectorAll("iframe")[0];
        let iframeHeight = subIframe?.getBoundingClientRect().height;
        let iframe = this.getIframe();
        if (!iframe) return;
        iframe.style.height = iframeHeight * this.chapterDocList.length + "px";
        this.element.addEventListener("scroll", (e) => {
          console.log("scroll");
          handlePDFScrollEvent(
            this.chapterDocList,
            element,
            this.readerMode,
            this.tempLocation,
            doc
          );
        });
      }

      handlePDFLayout(element, this.readerMode, doc);
      resolve();
    });
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
    let { chapterTitle, chapterDocIndex, chapterHref } = bookLocation;
    console.log(chapterDocIndex, "chapterdocindex");

    await renderPdfPage(
      parseInt(chapterDocIndex),
      chapterTitle,
      chapterHref,
      this.chapterDocList,
      this.element,
      this.readerMode,
      this.tempLocation,
      doc
    );

    await handleScrollPDFPosition(
      parseInt(chapterDocIndex),
      this.readerMode,
      doc
    );
    await this.record();
    this.trigger("rendered");
    // this.addPageAnimation();
  }
  async prev() {
    // this.trigger("page-changed");
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
      await handleScrollPage(
        this.element,
        this.animation,
        1,
        doc,
        this.flipToNextPage,
        this.flipToPrevPage,
        this.isMobile
      );
      await renderPdfPage(
        parseInt(this.tempLocation.chapterDocIndex) -
          (this.readerMode === "double" ? 2 : 1),
        this.tempLocation.chapterTitle,
        this.tempLocation.chapterHref,
        this.chapterDocList,
        this.element,
        this.readerMode,
        this.tempLocation,
        doc
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
    if (this.readerMode === "scroll") {
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
      console.log(
        this.tempLocation.chapterDocIndex,
        "this.tempLocation.chapterDocIndex"
      );
      await renderPdfPage(
        parseInt(this.tempLocation.chapterDocIndex) +
          (this.readerMode === "double" ? 2 : 1),
        this.tempLocation.chapterTitle,
        this.tempLocation.chapterHref,
        this.chapterDocList,
        this.element,
        this.readerMode,
        this.tempLocation,
        doc
      );
    }

    await this.record();
  }
  async record(): Promise<void> {
    if (this.animation !== "") {
      await new Promise((r) => setTimeout(r, 1000));
    }
    let doc = this.getDocument();
    if (!doc) return;
    await handlePDFRecord(
      this.element,
      this.readerMode,
      this.tempLocation,
      doc
    );
    this.trigger("page-changed");
  }
  async getMetadata() {
    try {
      if (!this.book) {
        await this.parse();
      }
      let parser = new GeneralParser(this.book);
      return await parser.getMetadata();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  getProgress() {
    return {
      totalPage: this.chapterDocList.length,
      currentPage: this.tempLocation.chapterDocIndex,
    };
  }
  async getHightlightCoords() {
    let pageIndex = this.tempLocation.chapterDocIndex;
    let doc = this.getDocument();
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
    let iframe = this.getIframe();
    let doc = this.getDocument();
    if (!doc || !iframe) return;
    clearHighlight(doc);
    let iWin: any = iframe.contentWindow || iframe.contentDocument?.defaultView;
    for (let index = 0; index < notes.length; index++) {
      const item = notes[index];

      let selected = JSON.parse(item.range);
      var pageIndex = selected.page;
      if (selected.readerMode === "double" || this.readerMode === "double") {
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
  async createOneNote(item: any, handleNoteClick: any) {
    let iframe = this.getIframe();
    let doc = this.getDocument();
    if (!doc || !iframe) return;
    let iWin: any = iframe.contentWindow || iframe.contentDocument?.defaultView;

    let selected = JSON.parse(item.range);
    var pageIndex = selected.page;
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
    if (!iWin || !iWin.getSelection()) return;
    iWin.getSelection()?.empty();
  }
}
export default PdfRender;
