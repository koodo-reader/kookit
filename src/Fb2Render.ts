import iconv from "iconv-lite";
import { xmlBookTagFilter, xmlBookToObj } from "./utils/xmlUtil";
import { getCharset } from "./utils/charsetUtil";
class Fb2Render {
  fb2Buffer: ArrayBuffer;
  encoding: string;
  constructor(fb2Buffer: ArrayBuffer, encoding: string) {
    this.fb2Buffer = fb2Buffer;
    this.encoding = encoding;
  }
  renderTo(element: HTMLElement) {
    if (!this.encoding) {
      this.encoding = getCharset(this.fb2Buffer) || "utf8";
    }
    let fb2Str = iconv.decode(Buffer.from(this.fb2Buffer), this.encoding);

    let bookObj = xmlBookToObj(Buffer.from(this.fb2Buffer));
    bookObj += xmlBookTagFilter(fb2Str);
    element.innerHTML = bookObj || "";
  }
}
export default Fb2Render;
