import Chinese from "../libs/zh-convert";
import { processDocumentBody } from "./bionicUtil";
import { getStylePxNumber, isElectron } from "./common";
import { getBlockElement, isParentBlock } from "./common";
import { applyTextRules } from "./textRuleUtil";
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
  if (!doc.body.getAttribute("data-kookit-fixed-scale")) {
    await handleImageSize(element, readerMode, format, doc);
  }
  await handleTextStyle(doc);
  if (readerMode !== "scroll") {
    iframe.height = element.clientHeight + "px";
    if (readerMode === "double") {
      if (isVerticalLayout()) {
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
};

export const handleOneChapterDoc = async (item, isSearch: boolean) => {
  let chapterText = "";
  if (item && item.load) {
    let chapteruUrl = await item.load();
    let res = await fetch(chapteruUrl);
    let blob = await res.blob();
    chapterText = await blob.text();
  }

  if (isSearch) {
    return chapterText;
  }
  chapterText = await handlePrecacheAssets(chapterText, item);
  return chapterText;
};
export const getImageElement = (Element) => {
  return Array.from(Element.querySelectorAll("img, image")) as HTMLElement[];
};
export const getImageUrl = (el: Element): string | null => {
  return (
    el.getAttribute("src") ||
    el.getAttribute("href") ||
    el.getAttribute("xlink:href") ||
    null
  );
};
export const collectChapterImageUrls = (root: Element): string[] => {
  const urls: string[] = [];
  const nodes = root.querySelectorAll("img, svg, image");

  for (const el of nodes) {
    const tag = el.tagName.toLowerCase();
    if (tag === "img") {
      const url = getImageUrl(el);
      if (url) urls.push(url);
    } else if (tag === "svg") {
      el.querySelectorAll("image").forEach((img) => {
        if (img.closest("svg") !== el) return;
        const url = getImageUrl(img);
        if (url) urls.push(url);
      });
    } else if (tag === "image" && !el.closest("svg")) {
      const url = getImageUrl(el);
      if (url) urls.push(url);
    }
  }
  return urls;
};
export const handlePrecacheAssets = async (bookStr, item) => {
  let chapterDoc = new DOMParser().parseFromString(bookStr, "text/html") as any;
  if (item && item.loadAsset) {
    let loadAsset = item.loadAsset;
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
  }
  if (chapterDoc && chapterDoc.documentElement) {
    chapterDoc.documentElement.lang = "en"; // 方式1（推荐）
  }
  if (window.isHyphenation === "yes" && isElectron()) {
    // to fix electron-specific issue where `hyphens: auto` is silently ignored without a Chromium hyphenation dictionary.
    applyHyphenation(chapterDoc);
  }
  if (
    window.fullTranslationMode === "both" ||
    window.fullTranslationMode === "target"
  ) {
    let nodeList = getBlockElement(chapterDoc.body).filter(
      (item) => !isParentBlock(item)
    );
    for (let node of nodeList) {
      if (node.textContent && node.textContent?.trim()) {
        let id =
          node.getAttribute("id") ||
          "kookit-trans-" + Math.random().toString(36).substr(2, 9);
        if (window.transMap[node.textContent]) {
          id = window.transMap[node.textContent].id;
        }
        node.setAttribute("id", id);
        node.classList.add("kookit-translation-host");
        node.classList.add("kookit-translation-loading");
        node.setAttribute("data-kookit-translation", "");
        let originalText = node.textContent || "";
        window.transMap[originalText] = {
          id,
        };
      }
    }
  }
  let imgDomList = getImageElement(chapterDoc) as any;
  if (imgDomList.length > 0) {
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
  return chapterDoc.documentElement.innerHTML;
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
const fetchHighlightAsset = async (path: string) => {
  const url = `${isElectron() ? "." : ""}/lib/highlight-js/${path}`;
  return await (await fetch(url)).text();
};

const runHighlightScript = (source: string) => {
  const script = document.createElement("script");
  script.textContent = source;
  document.head.appendChild(script);
};

const ensureHighlightJs = async (language: string) => {
  if (!window.hljs) {
    runHighlightScript(await fetchHighlightAsset("highlight.min.js"));
  }
  if (window.kookitHljsLanguage !== language) {
    runHighlightScript(
      await fetchHighlightAsset(`languages/${language}.min.js`)
    );
    window.kookitHljsLanguage = language;
  }
};

const getCodeHighlightTargets = (doc: Document) => {
  return Array.from(doc.querySelectorAll("code")) as HTMLElement[];
};

const applyCodeHighlighting = async (doc: Document, language: string) => {
  await ensureHighlightJs(language);
  if (!doc.head.querySelector("#kookit-code-highlighter-style")) {
    const style = document.createElement("style");
    style.id = "kookit-code-highlighter-style";
    style.textContent = await fetchHighlightAsset("default.min.css");
    doc.head.appendChild(style);
  }
  const langClass = "language-" + language;
  getCodeHighlightTargets(doc).forEach((element) => {
    element.classList.add(langClass);
    delete element.dataset.highlighted;
    window.hljs.highlightElement(element);
  });
};

export const transformText = async (doc: Document) => {
  if (window.bookLayout) {
    const cssPath = () =>
      `${isElectron() ? "." : ""}/lib/${window.bookLayout}-css/${window.bookLayout}.min.css`;

    const fetchText = async (url) => await (await fetch(url)).text();
    const textCSS = async () => await fetchText(cssPath());

    const style = document.createElement("style");
    style.id = "kookit-book-layout-style";
    style.textContent = await textCSS();
    doc.head.appendChild(style);
    //attach class to body for book layout specific adjustments if not exist
    if (!doc.body.classList.contains(window.bookLayout)) {
      doc.body.classList.add(window.bookLayout);
    }
  }
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
  if (window.codeHighlight) {
    await applyCodeHighlighting(doc, window.codeHighlight);
  }
  if (window.textRules && window.textRules.length > 0) {
    applyTextRules(doc, window.textRules);
  }
};
export const handleTextStyle = async (doc: Document) => {
  await transformText(doc);
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
  let imgs = Array.from(doc.querySelectorAll("img, image")) as any[];

  // --- Phase 1: batch-resolve natural dimensions for all <image> (SVG) tags in parallel ---
  await Promise.all(
    imgs.map(async (item) => {
      if (item.tagName === "image" && !item._naturalWidth) {
        let img = await getImageMeta(item.getAttribute("xlink:href"));
        item._naturalWidth = img.naturalWidth;
        item._naturalHeight = img.naturalHeight;
      }
    })
  );

  // --- Phase 2: read all layout measurements up-front (no style writes yet) ---
  // Snapshot every value we need from the DOM in one pass to avoid layout thrashing.
  const BATCH = 20; // yield every N images to keep the UI responsive
  const elementClientWidth = element.clientWidth;
  const elementClientHeight = element.clientHeight;
  const bodyClientHeight = doc.body.clientHeight;

  type ImageMeasure = {
    item: any;
    width: number;
    height: number;
    parentOffsetWidth: number;
    parentClientWidth: number;
    parentClientHeight: number;
    grandClientWidth: number;
    grandClientHeight: number;
    grandTagName: string;
    existingStyle: string;
  };
  const getContentWidth = (el: Element | null | undefined): number => {
    if (!el) return 0;
    const style = getComputedStyle(el);
    return (
      Math.min(el.clientWidth, pageWidth) -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight)
    );
  };
  const getContentHeight = (el: Element | null | undefined): number => {
    if (!el) return 0;
    const style = getComputedStyle(el);
    return (
      Math.min(el.clientHeight, elementClientHeight) -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom)
    );
  };

  const measures: ImageMeasure[] = imgs.map((item) => {
    const parentItem = item.parentElement;
    const grandItem = parentItem?.parentElement;
    let width = item.getAttribute("width");
    let height = item.getAttribute("height");
    if (!width && item.getAttribute("style")) {
      width = getStylePxNumber(item.getAttribute("style") as string, "width");
    }
    if (!height && item.getAttribute("style")) {
      height = getStylePxNumber(item.getAttribute("style") as string, "height");
    }
    if (!width) {
      width = item.tagName === "image" ? item._naturalWidth : item.naturalWidth;
    }
    if (!height) {
      height =
        item.tagName === "image" ? item._naturalHeight : item.naturalHeight;
    }
    return {
      item,
      width: width || 0,
      height: height || 0,
      parentOffsetWidth: parentItem?.offsetWidth || 0,
      parentClientWidth: getContentWidth(parentItem),
      parentClientHeight: getContentHeight(parentItem),
      grandClientWidth: getContentWidth(grandItem),
      grandClientHeight: getContentHeight(grandItem),
      grandTagName: grandItem?.tagName || "",
      existingStyle: item.getAttribute("style") || "",
    };
  });

  // --- Phase 3: compute styles (pure calculation, no DOM reads) ---
  type StyleWrite = {
    item: any;
    styles: string[];
    isSvgImage: boolean;
    maxWidth: number;
    maxHeight: number;
    parentItem: any;
    grandItem: any;
    setParentIndent: boolean;
    setGrandIndent: boolean;
  };

  const writes: StyleWrite[] = measures.map((m) => {
    const {
      item,
      width,
      height,
      parentOffsetWidth,
      parentClientWidth,
      parentClientHeight,
      grandClientWidth,
      grandClientHeight,
      grandTagName,
    } = m;

    let maxHeight = 0;
    let maxWidth = 0;
    let setParentIndent = false;
    let setGrandIndent = false;

    if (format.startsWith("CB") && readerMode === "scroll") {
      maxWidth = parentOffsetWidth;
    } else if (format.startsWith("CB") && readerMode === "single") {
      maxHeight = elementClientHeight;
      maxWidth = elementClientWidth;
    } else if (parentClientWidth && parentClientHeight && width && height) {
      let isImageScaleLargerThanElement =
        height / width > parentClientHeight / parentClientWidth;
      if (isImageScaleLargerThanElement) {
        maxHeight = parentClientHeight;
        maxWidth = parseInt((maxHeight * width) / height + "");
      } else {
        maxWidth = parentClientWidth;
        maxHeight = parseInt((maxWidth * height) / width + "");
      }
      if (maxHeight > bodyClientHeight && readerMode !== "scroll") {
        maxWidth = parseInt(maxWidth * (bodyClientHeight / maxHeight) + "");
        maxHeight = bodyClientHeight;
      }
      setParentIndent = true;
    } else if (parentClientWidth > 0) {
      maxWidth = parentClientWidth;
      maxHeight = parentClientHeight;
      setParentIndent = true;
    } else if (grandTagName !== "BODY" && grandClientWidth > 0) {
      maxWidth = grandClientWidth;
      maxHeight = grandClientHeight;
      setGrandIndent = true;
    } else {
      maxWidth = elementClientWidth;
      maxHeight = elementClientHeight;
    }

    if (maxWidth) {
      maxWidth = Math.min(
        readerMode === "scroll" || readerMode === "single"
          ? elementClientWidth
          : pageWidth,
        maxWidth
      );
    } else {
      maxWidth =
        readerMode === "scroll" || readerMode === "single"
          ? elementClientWidth
          : pageWidth;
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
      maxHeight > elementClientHeight
    ) {
      maxWidth = maxWidth * (elementClientHeight / maxHeight);
      maxHeight = elementClientHeight;
    }

    const styles: string[] = [];
    if (maxWidth || maxHeight) {
      //轻易不要改这里，很容易出问题
      styles.push(
        `max-width: ${maxWidth > 0 ? maxWidth + "px" : ""};max-height:${
          maxHeight > 0 ? maxHeight + "px" : ""
        }; margin: 0 auto; min-width: 0px; min-height: 0px;`
      );
      // Note: CB margin-left using item.clientWidth is deferred to write phase
      // because it requires a live layout read after the first style is applied.
    }
    if (format.startsWith("CB") && readerMode === "scroll") {
      styles.push("margin-left: 0px; width: 100%;");
    }

    return {
      item,
      styles,
      isSvgImage: item.tagName === "image",
      maxWidth,
      maxHeight,
      parentItem: item.parentElement,
      grandItem: item.parentElement?.parentElement,
      setParentIndent,
      setGrandIndent,
    };
  });

  // --- Phase 4: apply all writes in batches, yielding between batches ---
  for (let i = 0; i < writes.length; i++) {
    if (i > 0 && i % BATCH === 0) {
      // Yield to the browser so it can handle input/render between batches
      await new Promise((r) => setTimeout(r, 0));
    }

    const w = writes[i];
    const { item, styles, isSvgImage, maxWidth, maxHeight } = w;

    if (w.setParentIndent && w.parentItem) {
      w.parentItem.style.textIndent = "0px";
    }
    if (w.setGrandIndent && w.grandItem) {
      w.grandItem.style.textIndent = "0px";
    }

    if (styles.length > 0) {
      const existing = item.getAttribute("style") || "";
      item.setAttribute("style", existing + ";" + styles.join(";"));
    }

    if (isSvgImage) {
      item.parentElement?.setAttribute("width", maxWidth);
      item.parentElement?.setAttribute("height", maxHeight);
    }

    // CB non-scroll: margin-left needs live clientWidth after styles are applied
    if (format.startsWith("CB") && readerMode !== "scroll") {
      const liveWidth = item.getBoundingClientRect().width;
      const existing = item.getAttribute("style") || "";
      item.setAttribute(
        "style",
        existing + `;margin-left: calc(50% - ${liveWidth / 2}px);`
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
  style.textContent = "body{margin: 0px}";
  doc.head.appendChild(style);
  const vertical = isVerticalLayout();
  if (readerMode === "scroll") {
    return;
  }
  let scale = readerMode === "double" ? 2 : 1;
  if (vertical) {
    let section = Math.floor(element.clientHeight / 12);
    let gap = section % 2 === 0 ? section : section - 1;
    doc.documentElement.setAttribute(
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
    //ios 特殊处理否则平滑翻页有问题
    doc.documentElement.setAttribute(
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
