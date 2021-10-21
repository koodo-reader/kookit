import marked from "marked";
class MdRender {
  htmlBuffer: ArrayBuffer;
  encoding: string;
  constructor(htmlBuffer: ArrayBuffer, encoding: string) {
    this.htmlBuffer = htmlBuffer;
    this.encoding = encoding;
  }
  renderTo(element: HTMLElement) {
    var blob = new Blob([this.htmlBuffer], {
      type: "text/html",
    });
    var reader = new FileReader();
    reader.onload = async (evt) => {
      let docStr = marked(evt.target?.result as any);

      element.innerHTML = docStr;
    };
    reader.readAsText(blob, this.encoding);
  }
}
export default MdRender;
