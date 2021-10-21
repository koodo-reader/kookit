import mammoth from "mammoth";
class MobiRender {
  docxBuffer: ArrayBuffer;
  constructor(docxBuffer: ArrayBuffer) {
    this.docxBuffer = docxBuffer;
  }
  renderTo(element: HTMLElement) {
    mammoth
      .convertToHtml({ arrayBuffer: this.docxBuffer })
      .then(async (res: any) => {
        element.innerHTML = res.value;
      });
  }
}
export default MobiRender;
