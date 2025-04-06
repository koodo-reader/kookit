import { createIframe, handleLayout } from "../utils/layoutUtil.js";
import GeneralParser from "../utils/generalParser.js";
import { isPDF, makePDF } from "../libs/pdf.js";
import GeneralRender from "./GeneralRender.js";
import { clearHighlight, showPDFHighlight } from "../utils/noteUtil.js";
import { getPdfScale } from "../utils/navigationUtil.js";
import { getCache } from "../libs/cache.js";
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
      let doc = this.getDocument();
      if (!doc) return;
      handleLayout(element, this.readerMode, doc);
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
