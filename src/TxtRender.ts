import { txtToHtml } from "./utils/htmlUtil";
import HtmlParser from "./utils/htmlParser";
class TxtRender {
  txtBuffer: ArrayBuffer;
  encoding: string;
  docStr: string;
  constructor(txtBuffer: ArrayBuffer, encoding: string) {
    this.txtBuffer = txtBuffer;
    this.encoding = encoding;
    this.docStr = "";
  }
  renderTo(element: HTMLElement) {
    let text = new TextDecoder(this.encoding || "utf-8").decode(this.txtBuffer);

    let docStr = "";
    docStr = txtToHtml(text);
    element.innerHTML = docStr;
    this.docStr = docStr;
  }
  getContent() {
    return new HtmlParser(this.docStr).getContent;
  }
}

export default TxtRender;
