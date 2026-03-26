import Chinese from "../libs/zh-convert";
import { processDocumentBody } from "./bionicUtil";
import { isElectron } from "./pdfUtil";
declare var window: any;
export const isVerticalLayout = (): boolean => {
  return window.textOrientation === "vertical";
};
export const convertStyleNum = (value: number) => {
  if (!value) return 0;
  return parseFloat(value + "");
};
export const convertComputedNum = (value: string) => {
  return parseFloat(value.substring(0, value.length - 2));
};
export const handleIframeHeight = async (
  element: HTMLElement,
  readerMode: string,
  format: string,
  iframe: any,
  doc: Document
) => {
  await Promise.race([
    Promise.all(
      Array.from([...doc.images, ...doc.querySelectorAll("image")]).map(
        (img: any) => {
          if (img.complete) return Promise.resolve(img.naturalHeight !== 0);
          return new Promise((resolve) => {
            img.addEventListener("load", () => resolve(true));
            img.addEventListener("error", () => resolve(false));
          });
        }
      )
    ),
    new Promise((resolve, reject) => {
      setTimeout(() => {
        // reject(new Error("Timeout"));
        resolve("image load timeout");
      }, 10);
    }),
  ]);
  await handleImageSize(element, readerMode, format, doc);
  handleTextStyle(doc);
  if (readerMode !== "scroll") {
    iframe.height = element.clientHeight + "px";
    if (readerMode === "double") {
      if (isVerticalLayout()) {
        let section = Math.floor(element.clientHeight / 12);
        let gap = section % 2 === 0 ? section : section - 1;
        let pageHeight = (element.clientHeight + gap) / 2;
        if (
          ((doc.body.scrollHeight - doc.body.clientHeight) / pageHeight) % 2 ===
          1
        ) {
          let tailElem = document.createElement("div");
          tailElem.setAttribute(
            "style",
            "width: " +
              doc.body.clientWidth +
              "px; display: inline-block; height: " +
              (pageHeight - gap) +
              "px"
          );
          doc.body.appendChild(tailElem);
        }
      } else {
        let section = Math.floor(element.clientWidth / 12);
        let gap = section % 2 === 0 ? section : section - 1;
        let pageWidth = (element.clientWidth + gap) / 2;
        if (
          ((doc.body.scrollWidth - doc.body.clientWidth) / pageWidth) % 2 ===
          1
        ) {
          let tailElem = document.createElement("div");
          tailElem.setAttribute(
            "style",
            "height: " +
              doc.body.clientHeight +
              "px; display: inline-block; width: " +
              (pageWidth - gap) +
              "px"
          );
          doc.body.appendChild(tailElem);
        }
      }
    }
  } else {
    //fix text blocked issue under scroll readerMode, don't ask me why
    iframe.height = doc.body.scrollHeight + "px";
    iframe.height = doc.body.scrollHeight + 300 + "px";
  }
  // await new Promise((r) => setTimeout(r, 1));
};

export const handleOneChapterDoc = async (item, isSearch: boolean) => {
  let chapterText = "";
  if (item && item.load) {
    let blob = await fetch(await item.load()).then((r) => r.blob());
    chapterText = await blob.text();
  }

  if (isSearch) {
    return chapterText;
  }
  if (item && item.loadAsset) {
    chapterText = await handlePrecacheAssets(chapterText, item.loadAsset);
  }
  chapterText = handleImageMarker(chapterText);
  return chapterText;
};
export const getImageElement = (Element) => {
  return Array.from(Element.querySelectorAll("img, image")) as HTMLElement[];
};
export const handlePrecacheAssets = async (bookStr, loadAsset) => {
  let chapterDoc = new DOMParser().parseFromString(bookStr, "text/html") as any;
  let imgDomList = getImageElement(chapterDoc) as any;
  for (let subindex = 0; subindex < imgDomList.length; subindex++) {
    if (imgDomList[subindex].getAttribute("src")) {
      imgDomList[subindex].src = await loadAsset(
        imgDomList[subindex].getAttribute("src")
      );
    } else if (imgDomList[subindex].getAttribute("xlink:href")) {
      imgDomList[subindex].setAttribute(
        "xlink:href",
        await loadAsset(imgDomList[subindex].getAttribute("xlink:href"))
      );
    }
  }
  let linkList = Array.from(chapterDoc.getElementsByTagName("link"));
  for (let index = 0; index < linkList.length; index++) {
    const link: any = linkList[index];
    if (link.getAttribute("href")) {
      link.href = await loadAsset(link.getAttribute("href"));
    }
  }
  return chapterDoc.documentElement.innerHTML;
};
export const handleImageMarker = (bookStr) => {
  let chapterDoc = new DOMParser().parseFromString(bookStr, "text/html") as any;
  if (chapterDoc && chapterDoc.documentElement) {
    chapterDoc.documentElement.lang = "en"; // 方式1（推荐）
  }
  if (window.isHyphenation === "yes" && isElectron()) {
    // to fix electron-specific issue where `hyphens: auto` is silently ignored without a Chromium hyphenation dictionary.
    applyHyphenation(chapterDoc);
  }
  let imgDomList = getImageElement(chapterDoc);
  if (imgDomList.length === 0) {
    return bookStr;
  } else {
    for (let i = 0; i < imgDomList.length; i++) {
      if (imgDomList[i].tagName === "image") {
        continue;
      }
      var newItem = document.createElement("kookitmarker");
      var textnode = document.createTextNode("img");
      newItem.appendChild(textnode);
      newItem.setAttribute(
        "style",
        "visibility: hidden; position: absolute;display: inline-block; width: 0; height: 0;"
      );
      // 找到图片元素在body中的位置，确保marker插入到body下
      let imgElement = imgDomList[i];

      // 找到包含当前图片的顶级body子元素
      let topLevelParent = imgElement;
      while (
        topLevelParent.parentElement &&
        topLevelParent.parentElement !== chapterDoc.body
      ) {
        topLevelParent = topLevelParent.parentElement;
      }

      // 在该顶级元素后插入marker
      if (topLevelParent.parentElement === chapterDoc.body) {
        topLevelParent.insertAdjacentElement("afterend", newItem);
      } else {
        // 如果找不到合适位置，插入到body末尾
        chapterDoc.body.appendChild(newItem);
      }
    }
    return chapterDoc.documentElement.innerHTML;
  }
};
export const createIframe = (
  element: HTMLElement,
  isAllowScript: string,
  scale?: number
) => {
  var iframe = document.createElement("iframe");
  iframe.style.width = scale ? (scale - 0.4) * 100 + "%" : "100%";
  iframe.style.margin = "0";
  iframe.style.border = "0";
  iframe.style.padding = "0";
  iframe.style.minHeight = "calc(100% - 2px)";
  iframe.style.fontSize = "100%";
  iframe.style.font = "inherit";
  iframe.scrolling = "no";
  iframe.tabIndex = 0;
  iframe.id = "kookit-iframe";
  iframe.style.verticalAlign = "baseline";
  if (isAllowScript !== "yes") {
    iframe.setAttribute("sandbox", "allow-same-origin");
  }
  element.innerHTML = "";
  element.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (doc && doc.documentElement) {
    doc.documentElement.lang = "en"; // 方式1（推荐）
  }
  // 控制iframe滚动到页面水平正中的位置
  if (scale) {
    element.scrollLeft = element.scrollWidth / 2 - element.clientWidth / 2;
  }
};

export const progressInfo = (
  readerMode: string,
  doc: Document,
  element: any
) => {
  //TODO 是否有必要保留延时
  // if (parseInt(doc.body.scrollWidth / doc.body.clientWidth + "") === 1) {
  //   await new Promise((r) => setTimeout(r, 1000));
  // }
  const vertical = isVerticalLayout() && readerMode !== "scroll";
  if (vertical) {
    let section = Math.floor(element.clientHeight / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    return {
      totalPage:
        readerMode === "single"
          ? Math.round(
              parseFloat(
                doc.body.scrollHeight / (doc.body.clientHeight + gap) + ""
              )
            )
          : Math.round(
              parseFloat(
                doc.body.scrollHeight / (doc.body.clientHeight + gap) + ""
              )
            ) * 2,
      currentPage:
        Math.round(
          parseFloat(
            convertStyleNum(doc.body.scrollTop) /
              (doc.body.clientHeight + gap) +
              ""
          )
        ) + 1,
    };
  }
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  return {
    totalPage:
      readerMode === "scroll"
        ? Math.floor(element.scrollHeight / (element.clientHeight - 50))
        : readerMode === "single"
          ? Math.round(
              parseFloat(
                doc.body.scrollWidth / (doc.body.clientWidth + gap) + ""
              )
            )
          : Math.round(
              parseFloat(
                doc.body.scrollWidth / (doc.body.clientWidth + gap) + ""
              )
            ) * 2,
    currentPage:
      readerMode === "scroll"
        ? Math.floor(element.scrollTop / (element.clientHeight - 50)) + 1
        : Math.round(
            parseFloat(
              convertStyleNum(doc.body.scrollLeft) /
                (doc.body.clientWidth + gap) +
                ""
            )
          ) + 1,
  };
};
export const tranformText = (doc: Document) => {
  if (window.convertChinese === "Simplified To Traditional") {
    doc
      .querySelectorAll(
        "h1,h2,h3,h4,h5,h6,p,div,ul,dl,ol,pre,li,dt,dd,blockquote,address,kookitmarker"
      )
      .forEach((item) => {
        item.innerHTML = item.innerHTML
          .split("")
          .map((item) => Chinese.s2t(item))
          .join("");
      });
  } else if (window.convertChinese === "Traditional To Simplified") {
    doc
      .querySelectorAll(
        "h1,h2,h3,h4,h5,h6,p,div,ul,dl,ol,pre,li,dt,dd,blockquote,address,kookitmarker"
      )
      .forEach((item) => {
        item.innerHTML = item.innerHTML
          .split("")
          .map((item) => Chinese.t2s(item))
          .join("");
      });
  }
  //确保页面完全加载完毕之后，在修改缩进
  if (window.isIndent === "yes") {
    doc
      .querySelectorAll(
        "h1,h2,h3,h4,h5,h6,p,div,ul,dl,ol,pre,li,dt,dd,blockquote,address"
      )
      .forEach((item) => {
        for (let node of item.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            // 将前导空格替换为零宽度字符，保留原始内容但不显示
            const text = node.nodeValue || "";
            const firstChar = text.charAt(0);
            // 检查首字符是否为空白字符但不是普通空格或制表符或换行符
            if (
              firstChar &&
              firstChar.trim() === "" &&
              firstChar !== " " &&
              firstChar !== "\n" &&
              firstChar !== "\t"
            ) {
              (item as HTMLElement).setAttribute(
                "style",
                ((item as HTMLElement).getAttribute("style") || "") +
                  "text-indent: 0em !important;"
              );
            }
            // 只处理第一个，退出循环
            break;
          }
          //如果子元素为img则也缩进设为0
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node as HTMLElement).tagName.toLowerCase() === "img"
          ) {
            (item as HTMLElement).setAttribute(
              "style",
              ((item as HTMLElement).getAttribute("style") || "") +
                "text-indent: 0em !important;"
            );
            break;
          }
        }
      });
  }
  if (window.isBionic === "yes") {
    processDocumentBody(doc);
  }
};
export const handleTextStyle = (doc: Document) => {
  tranformText(doc);
};
export const getImageMeta = async (url) => {
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (error) {
    console.error(error);
  }
  return img;
};
export const handleImageSize = async (
  element: HTMLElement,
  readerMode: string,
  format: string,
  doc: Document
) => {
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  let scale = readerMode === "double" ? 2 : 1;
  let pageWidth = (element.clientWidth - gap) / scale;
  let imgs = doc.querySelectorAll("img, image") as any;
  for (let item of imgs) {
    let parentItem = item.parentElement;
    let grandItem = parentItem?.parentElement;
    let maxHeight = 0;
    let maxWidth = 0;
    let width = item.naturalWidth;
    let height = item.naturalHeight;
    if (item.tagName === "image") {
      let img = await getImageMeta(item.getAttribute("xlink:href"));
      width = img.naturalWidth;
      height = img.naturalHeight;
    }
    if (format.startsWith("CB") && readerMode === "scroll") {
      maxWidth = parentItem.offsetWidth;
    } else if (format.startsWith("CB") && readerMode === "single") {
      maxHeight = element.clientHeight;
      maxWidth = element.clientWidth;
    } else if (
      parentItem &&
      width &&
      height &&
      parentItem.clientHeight &&
      parentItem.clientWidth
    ) {
      let isImageScaleLargerThanElement =
        height / width > parentItem.clientHeight / parentItem.clientWidth;
      if (isImageScaleLargerThanElement) {
        maxHeight = parentItem.clientHeight;
        maxWidth = parseInt((maxHeight * width) / height + "");
      } else {
        maxWidth = parentItem.clientWidth;
        maxHeight = parseInt((maxWidth * height) / width + "");
      }
      if (maxHeight > doc.body.clientHeight && readerMode !== "scroll") {
        maxWidth = parseInt(
          maxWidth * (doc.body.clientHeight / maxHeight) + ""
        );
        maxHeight = doc.body.clientHeight;
      }
      parentItem.style.textIndent = "0px";
    } else if (
      parentItem &&
      parentItem.clientWidth &&
      parentItem.clientWidth > 0
    ) {
      maxWidth = parentItem.clientWidth;
      maxHeight = parentItem.clientHeight;
      parentItem.style.textIndent = "0px";
    } else if (
      grandItem &&
      grandItem.tagName !== "BODY" &&
      grandItem.clientWidth &&
      grandItem.clientWidth > 0
    ) {
      maxWidth = grandItem.clientWidth;
      maxHeight = grandItem.clientHeight;
      grandItem.style.textIndent = "0px";
    } else {
      maxWidth = element.clientWidth;
      maxHeight = element.clientHeight;
    }
    if (maxWidth) {
      maxWidth = Math.min(
        readerMode === "scroll" || readerMode === "single"
          ? element.clientWidth
          : (element.clientWidth - gap) / 2,
        maxWidth
      );
    } else {
      maxWidth =
        readerMode === "scroll" || readerMode === "single"
          ? element.clientWidth
          : (element.clientWidth - gap) / 2;
    }
    if (width && height) {
      if (width > height) {
        maxHeight = maxWidth * (height / width);
      } else {
        if (maxHeight / maxWidth > height / width) {
          maxHeight = maxWidth * (height / width);
        } else {
          maxWidth = maxHeight * (width / height);
        }
      }
    }
    if (
      readerMode !== "scroll" &&
      maxWidth &&
      maxHeight &&
      maxHeight > element.clientHeight
    ) {
      maxWidth = maxWidth * (element.clientHeight / maxHeight);
      maxHeight = element.clientHeight;
    }
    if (maxWidth || maxHeight) {
      //轻易不要改这里，很容易出问题
      item.setAttribute(
        "style",
        (item.getAttribute("style") ? item.getAttribute("style") : "") +
          ";" +
          `max-width: ${maxWidth > 0 ? maxWidth + "px" : ""};max-height:${
            maxHeight > 0 ? maxHeight + "px" : ""
          }; margin: 0 auto; min-width: 0px; min-height: 0px; ${
            format.startsWith("CB")
              ? `margin-left: calc(100% - ${item.clientWidth}px);`
              : ""
          }`
      );
    }
    if (item.tagName === "image") {
      item.parentElement?.setAttribute("width", maxWidth);
      item.parentElement?.setAttribute("height", maxHeight);
    }
    if (format.startsWith("CB") && readerMode === "scroll") {
      item.setAttribute(
        "style",
        (item.getAttribute("style") ? item.getAttribute("style") : "") +
          ";margin-left: 0px; width: 100%;"
      );
    }
    if (format.startsWith("CB") && readerMode !== "scroll") {
      item.setAttribute(
        "style",
        (item.getAttribute("style") ? item.getAttribute("style") : "") +
          `;margin-left: calc(50% - ${
            item.getBoundingClientRect().width / 2
          }px);`
      );
    }
  }
};

export const handleLayout = (
  element: HTMLElement,
  readerMode: string,
  doc: Document
) => {
  let style = doc.createElement("style");
  style.id = "default-style";
  style.textContent =
    "p,empty-line{display: inherit;margin-block-start: inherit;margin-block-end: inherit;margin-inline-start: inherit;margin-inline-end: inherit;}body{margin: 0px}";
  doc.head.appendChild(style);
  const vertical = isVerticalLayout();
  if (readerMode === "scroll") {
    return;
  }
  let scale = readerMode === "double" ? 2 : 1;
  if (vertical) {
    let section = Math.floor(element.clientHeight / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    doc.body.setAttribute(
      "style",
      `writing-mode: vertical-rl; text-orientation: mixed; height: ${
        element.clientHeight + "px"
      };width: 100%;overflow-y: hidden;overflow-x: hidden;padding-left: 0px;padding-right: 0px;margin: 0px;box-sizing: border-box;touch-action:none; overscroll-behavior: none;max-width: inherit;column-fill: auto;column-gap: ${gap}px; column-width: ${
        (element.clientHeight - gap) / scale
      }px;`
    );
  } else {
    let section = Math.floor(element.clientWidth / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    doc.body.setAttribute(
      "style",
      `width: ${
        element.clientWidth + "px"
      };height: 100%;overflow-y: hidden;overflow-X: hidden;padding-left: 0px;padding-right: 0px;margin: 0px;box-sizing: border-box;touch-action:none; overscroll-behavior: none;max-width: inherit;column-fill: auto;column-gap: ${gap}px; column-width: ${
        (element.clientWidth - gap) / scale
      }px;`
    );
  }
};

export const isElement = (obj) => {
  try {
    //Using W3 DOM2 (works for FF, Opera and Chrome)
    return obj instanceof HTMLElement;
  } catch (e) {
    //Browsers not supporting W3 DOM2 don't have HTMLElement and
    //an exception is thrown and we end up here. Testing some
    //properties that all elements have (works on IE7)
    return (
      typeof obj === "object" &&
      obj.nodeType === 1 &&
      typeof obj.style === "object" &&
      typeof obj.ownerDocument === "object"
    );
  }
};
export function getSelectedElement(doc: Document) {
  const selection = doc.getSelection();
  if (!selection) return null;
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const selectedElement = range.startContainer.parentElement;
    return selectedElement;
  }
  return null;
}
/**
 * 向文档文本节点注入软连字符（U+00AD），解决 Electron 无 Chromium 连字词典时
 * `hyphens: auto` 静默失效的问题。CSS 规范保证：即使 hyphens:auto 无词典，
 * 浏览器仍会在 \u00AD 处断行并插入可见连字符。
 *
 * 调用时机：章节内容渲染完成后，在 Electron 环境中调用。
 * @param doc - iframe 的 contentDocument
 */
export const applyHyphenation = (doc: Document): void => {
  if (!doc || !doc.body) return;
  const SHY = "\u00AD";
  const SKIP_TAGS = new Set([
    "CODE",
    "PRE",
    "SCRIPT",
    "STYLE",
    "KBD",
    "SAMP",
    "A",
  ]);

  // 向 9+ 字符的单词中按固定步长插入软连字符
  // 保证首尾各保留 3 个字符不断，每 6 字符一个断点
  function addShy(text: string): string {
    return text.replace(/[A-Za-z\u00C0-\u024F]{9,}/g, (word) => {
      const len = word.length;
      let result = "";
      for (let i = 0; i < len; i++) {
        result += word[i];
        if (i >= 2 && len - i - 1 >= 3 && (i + 1) % 6 === 0) {
          result += SHY;
        }
      }
      return result;
    });
  }

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node) {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (SKIP_TAGS.has(parent.tagName?.toUpperCase())) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    nodes.push(node as Text);
  }

  for (const textNode of nodes) {
    const original = textNode.textContent || "";
    const updated = addShy(original);
    if (updated !== original) {
      textNode.textContent = updated;
    }
  }
};
