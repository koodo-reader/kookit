import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeCacheBook } from "../libs/cache-mobile";
import GeneralParser from "../utils/generalParser";
import { addTouchEvent } from "../utils/navigationUtil";
declare var window: any;

class MobileRender extends GeneralRender {
  toc: any[];
  sections: any[];
  constructor(toc: any[], sections: any[], mode: string, animation: string) {
    super(mode, "CACHE", animation);
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

      handleLayout(element, this.mode, doc);

      resolve();
    });
  }
  setStyle() {
    let doc = this.getDocument();
    if (!doc) return;

    var defaultStyle = document.createElement("style");
    defaultStyle.innerHTML = `
      body{
        margin: 0;
        font-size: 60px;
        word-wrap: break-word;
        overflow-wrap: break-word;
        overflow-x: hidden;
        text-align: justify;
        font-family: "Ubuntu-Regular" !important;
      }

    `;
    doc.head.appendChild(defaultStyle);
  }
  displayFont(fontName: string, fontBase64: string) {
    let doc = this.getDocument();
    if (!doc) return;
    const fontFaceCSS =
      "@font-face {" +
      "  font-family: '" +
      fontName +
      "';" +
      "  src: url('data:font/ttf;charset=utf-8;base64," +
      fontBase64 +
      "') format('truetype');" +
      "}";
    const styleElement = document.createElement("style");
    styleElement.type = "text/css";
    styleElement.appendChild(document.createTextNode(fontFaceCSS));
    doc.head.appendChild(styleElement);
  }
  addTouchEvent() {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    addTouchEvent(doc, iframe);
  }
}
export default MobileRender;
