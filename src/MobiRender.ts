import MobiParser from "./utils/mobiParser";
class MobiRender {
  mobiBuffer: ArrayBuffer;
  constructor(mobiBuffer: ArrayBuffer) {
    this.mobiBuffer = mobiBuffer;
  }
  async renderTo(element: HTMLElement) {
    let mobiDoc: Element = await new MobiParser(this.mobiBuffer).render();
    element.innerHTML = mobiDoc.outerHTML;
  }
}
export default MobiRender;
