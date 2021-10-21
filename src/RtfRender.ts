import iconv from "iconv-lite";
import * as rtfToHTML from "@iarna/rtf-to-html";
import { getCharset } from "./utils/charsetUtil";
class RtfRender {
  rtfBuffer: ArrayBuffer;
  encoding: string;
  constructor(rtfBuffer: ArrayBuffer, encoding: string) {
    this.rtfBuffer = rtfBuffer;
    this.encoding = encoding;
  }
  renderTo(element: HTMLElement) {
    if (!this.encoding) {
      this.encoding = getCharset(this.rtfBuffer) || "utf8";
    }
    let text = iconv.decode(Buffer.from(this.rtfBuffer), this.encoding);

    rtfToHTML.fromString(text, async (err: any, html: any) => {
      element.innerHTML = html;
    });
  }
}
export default RtfRender;
