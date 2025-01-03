import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralRender from "./GeneralRender";
import { makeCacheBook } from "../libs/cache-mobile";
import GeneralParser from "../utils/generalParser";
import { addTouchEvent } from "../utils/navigationUtil";
declare var window: any;

class MobileRender extends GeneralRender {
  toc: any[];
  sections: any[];
  constructor(
    toc: any[],
    sections: any[],
    mode: string,
    animation: string,
    convertChinese: string,
    isBionic: string
  ) {
    super({ mode, format: "CACHE", animation, convertChinese, isBionic });
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
  setStyle(css: string) {
    let doc = this.getDocument();
    if (!doc) return;

    var defaultStyle = document.createElement("style");
    defaultStyle.innerHTML = css;
    doc.head.appendChild(defaultStyle);
  }
  displayFontBase64(fontName: string, fontBase64: string) {
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
  async displayFontUrl(fontName: string, fontUrl: string) {
    let doc = this.getDocument();
    if (!doc) return;
    // 使用 FontFace API 创建字体
    const font = new FontFace(fontName, `url(${fontUrl})`);

    // 加载字体并监听加载完成事件
    let loadedFont = await font.load();
    // 将加载的字体添加到文档的字体集合中
    document.fonts.add(loadedFont);
    console.log("Font loaded successfully");
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
    // console.log("displayFontUrl", fontName, fontUrl);
  }
  addTouchEvent() {
    let doc = this.getDocument();
    let iframe = this.getIframe();
    if (!doc || !iframe) return;
    addTouchEvent(doc, iframe);
  }
}
export default MobileRender;
