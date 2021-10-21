import _ from "underscore";
export const isScrolledIntoView = (el: HTMLElement) => {
  var rect = el.getBoundingClientRect();
  var elemTop = rect.top;
  var viewer = document.getElementsByClassName("ebook-viewer")[0];
  var screen = document.getElementsByClassName("viewer")[0];
  var isVisible =
    elemTop >= viewer.scrollTop &&
    elemTop <= viewer.scrollTop + (screen as HTMLElement).offsetHeight;

  return isVisible;
};
export const handleIframeHeight = () => {
  let iFrame: any = document.getElementsByTagName("iframe")[0];
  var body = iFrame.contentWindow.document.body,
    html = iFrame.contentWindow.document.documentElement;
  iFrame.height =
    Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    ) * 2;

  setTimeout(() => {
    let iFrame: any = document.getElementsByTagName("iframe")[0];
    let body = iFrame.contentWindow.document.body;
    let lastchild = body.lastElementChild;
    let lastEle = body.lastChild;
    let itemAs = body.querySelectorAll("a");
    let itemPs = body.querySelectorAll("p");
    let lastItemA = itemAs[itemAs.length - 1];
    let lastItemP = itemPs[itemPs.length - 1];

    let lastItem = lastItemP || lastItemA;
    if (_.isElement(lastItemA) && _.isElement(lastItemP)) {
      if (
        lastItemA.clientHeight + (lastItemA as any).offsetTop >
        lastItemP.clientHeight + (lastItemP as any).offsetTop
      ) {
        lastItem = lastItemA;
      } else {
        lastItem = lastItemP;
      }
    }
    let nodeHeight = 0;

    if (!lastchild && !lastItem && !lastEle) return;
    if (lastEle.nodeType === 3 && !lastchild && !lastItem) return;

    if (lastEle.nodeType === 3) {
      if (document.createRange) {
        let range = document.createRange();
        range.selectNodeContents(lastEle);
        if (range.getBoundingClientRect) {
          let rect = range.getBoundingClientRect();
          if (rect) {
            nodeHeight = rect.bottom - rect.top;
          }
        }
      }
    }

    iFrame.height =
      Math.max(
        _.isElement(lastchild)
          ? lastchild.clientHeight + (lastchild as any).offsetTop
          : 0,
        _.isElement(lastEle)
          ? lastEle.clientHeight + (lastEle as any).offsetTop
          : 0,
        _.isElement(lastItem)
          ? lastItem.clientHeight + (lastItem as any).offsetTop
          : 0
      ) +
      600 +
      (lastEle.nodeType === 3 ? nodeHeight : 0);
  }, 500);
};
