import { txtToHtml } from "./utils/htmlUtil";
import {
  bindEvent,
  createIframe,
  handleIframeHeight,
} from "./utils/layoutUtil";
import txtParser from "./utils/txtParser";
class TxtRender {
  txtBuffer: ArrayBuffer;
  encoding: string;
  bookStr: string;
  constructor(txtBuffer: ArrayBuffer, encoding: string = "utf-8") {
    this.txtBuffer = txtBuffer;
    this.encoding = encoding;

    this.bookStr = "";
    console.log(txtBuffer);
  }
  renderTo(element: HTMLElement) {
    let text = new TextDecoder(this.encoding).decode(this.txtBuffer);
    let bookStr = txtToHtml(text);
    this.bookStr = bookStr;

    let parser = new txtParser(this.bookStr);
    console.log(parser.getChapter());
    console.log(parser.getChapterDoc());

    createIframe(element);
    window.frames[0].document.body.innerHTML = parser.getChapterDoc()[1].text;
    handleIframeHeight();
    bindEvent(element, parser.getChapter());
  }
  getChapter() {
    let parser = new txtParser(this.bookStr);
    console.log(parser.getChapter(), parser.getChapterDoc());
  }
}

export default TxtRender;
