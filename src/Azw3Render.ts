import MobiParser from "./utils/mobiParser";
class Azw3Render {
  azw3Buffer: ArrayBuffer;
  constructor(azw3Buffer: ArrayBuffer) {
    this.azw3Buffer = azw3Buffer;
  }
  async renderTo(element: HTMLElement) {
    let mobiDoc: Element = await new MobiParser(this.azw3Buffer).render();
    element.innerHTML = mobiDoc.outerHTML;
  }
}
export default Azw3Render;
