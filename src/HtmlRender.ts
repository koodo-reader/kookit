class HtmlRender {
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
      const html = evt.target?.result as any;
      element.innerHTML = html;
    };
    reader.readAsText(blob, this.encoding);
  }
}
export default HtmlRender;
