import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeCacheBook } from "../libs/cache-mobile";
import GeneralParser from "../utils/generalParser";
import {
  addAndroidTouchEvent,
  addAppleTouchEvent,
} from "../utils/navigationUtil";
import rangy from "rangy/lib/rangy-core.js";
import "rangy/lib/rangy-textrange";
import { filterRects, getSafeRanges } from "../utils/noteUtil";
declare var window: any;

class MobileRender extends GeneralRender {
  toc: any[];
  sections: any[];
  constructor(toc: any[], sections: any[], config: any) {
    super({ format: "CACHE", ...config });
    this.toc = toc;
    this.sections = sections;
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      console.log = function (...args) {
        window.ReactNativeWebView.postMessage(
          args.map((arg) => String(arg)).join(", ")
        );
      };
      this.element = element;
      this.book = await makeCacheBook(this.toc, this.sections);
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
  setStyle(css: string) {
    let doc = this.getDocument();
    if (!doc) return;

    var defaultStyle = document.createElement("style");
    defaultStyle.innerHTML = css;
    doc.head.appendChild(defaultStyle);
  }
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
    if (!doc) return;
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
  addTouchEvent(isAndroid: string) {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    if (isAndroid === "yes") {
      addAndroidTouchEvent(doc, iframe, this.element, this.readerMode);
    } else {
      addAppleTouchEvent(doc, iframe, this.element, this.readerMode);
    }
  }
  clearSelection() {
    let iframe = this.getIframe();
    if (!iframe) return;
    let iWin: any = iframe.contentWindow || iframe.contentDocument?.defaultView;
    if (!iWin || !iWin.getSelection()) return;
    iWin.getSelection()?.empty();
  }
  clearSelectionKeepHighlight() {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    let iWin: any = iframe.contentWindow || iframe.contentDocument?.defaultView;
    if (!iWin || !iWin.getSelection()) return;
    let sel = doc!.getSelection();
    if (!sel) return;
    let newRange = sel.getRangeAt(0);
    var safeRanges: Range[] = getSafeRanges(newRange);
    for (var i = 0; i < safeRanges.length; i++) {
      const rects = filterRects(safeRanges[i].getClientRects());
      for (let index = 0; index < rects.length; index++) {
        const rect = rects[index];
        let newNode = document.createElement("span");
        newNode?.setAttribute(
          "style",
          "position: absolute; background-color: #f3a6a68c;left:" +
            (Math.min(rect.left, rect.x) + doc.body.scrollLeft) +
            "px; top:" +
            (Math.min(rect.top, rect.y) + doc.body.scrollTop) +
            "px;" +
            "width:" +
            rect.width +
            "px; height:" +
            rect.height +
            "px; z-index:-1;"
        );
        newNode.setAttribute("id", "temp-highlight");
        doc.body.appendChild(newNode);
      }
    }
    let charRange = rangy.getSelection(iframe).saveCharacterRanges(doc.body)[0];
    window.charRange = charRange;
    iWin.getSelection()?.removeAllRanges();
  }
  restoreSelectionClearHighlight() {
    let doc = this.getDocument();
    if (!doc) return;
    let tempHighlights = doc.querySelectorAll("#temp-highlight");
    tempHighlights.forEach((element) => {
      element.parentNode?.removeChild(element);
    });
    let iframe = this.getIframe();
    if (!iframe) return;
    rangy.init();
    let charRange = window.charRange;
    if (!charRange) return;
    rangy.getSelection(iframe).restoreCharacterRanges(doc, [charRange]);
  }
}
export default MobileRender;
