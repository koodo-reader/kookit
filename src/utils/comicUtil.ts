import StorageUtil from "./storageUtil";

export const handleScrollPage = async (
  element: HTMLElement,
  delta: number,
  isSliding: boolean
) => {
  if (delta > 0 && window.frames[0].document.body.scrollLeft > 0) {
    window.frames[0].document.body.scrollBy({
      top: 0,
      left: -element.offsetWidth - 88,
      behavior: isSliding ? "smooth" : "auto",
    });
  } else if (delta > 0 && window.frames[0].document.body.scrollLeft === 0) {
    return;
  } else if (delta < 0) {
    window.frames[0].document.body.scrollBy({
      top: 0,
      left: element.offsetWidth + 88,
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
  if (id) {
    let nodeList = Array.from(
      window.frames[0].document.body.querySelectorAll("img")
    ) as HTMLElement[];

    let targetNode = nodeList[id];
    if (mode !== "scroll") {
      window.frames[0].document.body.scrollTo(
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
      window.frames[0].document.body.scrollTo(0, 0);
    } else {
      element.scrollTo(0, 0);
    }
  }
};
