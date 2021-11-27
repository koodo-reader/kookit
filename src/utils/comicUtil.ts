import StorageUtil from "./storageUtil";

export const handleScrollPage = (element: HTMLElement, delta: number) => {
  if (delta > 0 && window.frames[0].document.body.scrollLeft > 0) {
    window.frames[0].document.body.scrollLeft -= element.offsetWidth + 88;
  } else if (delta > 0 && window.frames[0].document.body.scrollLeft === 0) {
    return;
  } else if (delta < 0) {
    window.frames[0].document.body.scrollLeft += element.offsetWidth + 88;
  }
};
export const handleScrollPosition = (
  element: HTMLElement,
  mode: string,
  _id: string = ""
) => {
  let id = _id || parseInt(StorageUtil.getKookitConfig("count")) || 0;
  if (id) {
    let nodeList = Array.from(
      window.frames[0].document.body.querySelectorAll("img")
    ) as HTMLElement[];

    let targetNode = nodeList[id];
    if (mode !== "scroll") {
      window.frames[0].document.body.scrollTo(
        id && targetNode ? targetNode.offsetLeft : 0,
        0
      );
    } else {
      element.scrollTo(0, id && targetNode ? targetNode.offsetTop : 0);
    }
  } else {
    if (mode !== "scroll") {
      window.frames[0].document.body.scrollTo(0, 0);
    } else {
      element.scrollTo(0, 0);
    }
  }
};
