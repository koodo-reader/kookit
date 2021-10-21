class TxtRender {
  docStr: string;
  constructor(docStr: string) {
    this.docStr = docStr;
  }
  renderTo(element: HTMLElement) {
    element.innerHTML = this.docStr;
  }
}
export default TxtRender;
