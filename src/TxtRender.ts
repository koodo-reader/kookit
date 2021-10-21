import iconv from "iconv-lite";
import { txtToHtml } from "./utils/xmlUtil";
import { getCharset } from "./utils/charsetUtil";
class TxtRender {
  txtBuffer: ArrayBuffer;
  encoding: string;
  constructor(txtBuffer: ArrayBuffer, encoding: string) {
    this.txtBuffer = txtBuffer;
    this.encoding = encoding;
  }
  renderTo(element: HTMLElement) {
    if (!this.encoding) {
      this.encoding = getCharset(this.txtBuffer) || "utf8";
    }
    let text = iconv.decode(Buffer.from(this.txtBuffer), this.encoding);

    let docStr = "";
    docStr = txtToHtml(text);
    element.innerHTML = docStr;
  }
}
export default TxtRender;
