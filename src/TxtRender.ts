import { txtToHtml } from "./utils/htmlUtil";
import txtParser from "./utils/txtParser";
class TxtRender {
  txtBuffer: ArrayBuffer;
  encoding: string;
  docStr: string;
  constructor(txtBuffer: ArrayBuffer, encoding: string = "utf-8") {
    this.txtBuffer = txtBuffer;
    this.encoding = encoding;

    this.docStr = "";
    console.log(txtBuffer);
  }
  renderTo(element: HTMLElement) {
    let text = new TextDecoder(this.encoding).decode(this.txtBuffer);
    let docStr = "";
    docStr = txtToHtml(text);
    console.log(element);
    element.innerHTML = docStr;
    // var ifrm = document.createElement("iframe");
    // ifrm.style.width = "100%";
    // let parser = new txtParser(this.docStr);
    // ifrm.innerHTML = parser.getChapterDoc()[0].text;
    // console.log(new txtParser(this.docStr).getChapter(this.docStr));
    // console.log(ifrm);
    // element.appendChild(ifrm);

    this.docStr = docStr;
  }
  getChapter() {
    let parser = new txtParser(this.docStr);
    console.log(parser.getChapter(), parser.getChapterDoc());
  }
}

export default TxtRender;
