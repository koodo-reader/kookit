import StorageUtil from "./storageUtil";

export const handleScrollPage = async (
  element: HTMLElement,
  delta: number,
  isSliding: boolean
) => {
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  if (delta > 0 && doc.body.scrollLeft > 0) {
    doc.body.scrollBy({
      top: 0,
      left: -element.offsetWidth - gap,
      behavior: isSliding ? "smooth" : "auto",
    });
  } else if (delta > 0 && doc.body.scrollLeft === 0) {
    return;
  } else if (delta < 0) {
    doc.body.scrollBy({
      top: 0,
      left: element.offsetWidth + gap,
      behavior: isSliding ? "smooth" : "auto",
    });
  }
};
export const handleScrollPosition = (
  element: HTMLElement,
  mode: string,
  _id: string = ""
) => {
  let id = _id || parseInt(StorageUtil.getKookitConfig("count")) || 0;
  let pageArea = document.getElementById("page-area");
  if (!pageArea) return;
  let iframe = pageArea.getElementsByTagName("iframe")[0];
  if (!iframe) return;
  let doc = iframe.contentDocument;
  if (!doc) {
    return;
  }
  if (id) {
    let nodeList = Array.from(
      doc.body.querySelectorAll("img")
    ) as HTMLElement[];

    let targetNode = nodeList[id];
    if (mode !== "scroll") {
      doc.body.scrollTo(
        id && targetNode ? targetNode.getBoundingClientRect().left : 0,
        0
      );
    } else {
      element.scrollTo(
        0,
        id && targetNode ? targetNode.getBoundingClientRect().top : 0
      );
    }
  } else {
    if (mode !== "scroll") {
      doc.body.scrollTo(0, 0);
    } else {
      element.scrollTo(0, 0);
    }
  }
};
