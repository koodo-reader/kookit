const pdfjsPath = (path) => `${isElectron() ? "." : ""}/lib/pdfjs/${path}`;

const pdfjsLib = window.pdfjsLib;

const fetchText = async (url) => await (await fetch(url)).text();
const isElectron = () => {
  // Renderer process
  if (
    typeof window !== "undefined" &&
    typeof window.process === "object" &&
    window.process.type === "renderer"
  ) {
    return true;
  }
  // Main process
  if (
    typeof process !== "undefined" &&
    typeof process.versions === "object" &&
    !!process.versions.electron
  ) {
    return true;
  }
  // Detect the user agent when the `nodeIntegration` option is set to true
  if (
    typeof navigator === "object" &&
    typeof navigator.userAgent === "string" &&
    navigator.userAgent.indexOf("Electron") >= 0
  ) {
    return true;
  }

  return false;
};
function vexPromptAsync(message, placeholder = "", value = "") {
  return new Promise((resolve) => {
    vex.dialog.prompt({
      message,
      placeholder,
      value,
      callback: function (input) {
        resolve(input);
      },
    });
  });
}
// https://github.com/mozilla/pdf.js/blob/642b9a5ae67ef642b9a8808fd9efd447e8c350e2/web/text_layer_builder.css
const textLayerBuilderCSS = async () =>
  await fetchText(pdfjsPath("text_layer_builder.css"));
// https://github.com/mozilla/pdf.js/blob/642b9a5ae67ef642b9a8808fd9efd447e8c350e2/web/annotation_layer_builder.css
const annotationLayerBuilderCSS = async () =>
  await fetchText(pdfjsPath("annotation_layer_builder.css"));

const render = async (
  page,
  pdf,
  doc,
  zoom,
  isMobile,
  viewer,
  isKeepPDFBackground
) => {
  try {
    const basePixelRatio = window.devicePixelRatio;
    const mobileFactor = isMobile === "yes" ? 1.5 : 1;
    const rawDpr = basePixelRatio * mobileFactor;
    // Cap DPR to avoid iOS WebContent OOM (max 3.1M pixels for mobile)
    const MAX_RENDER_DPR = 2;
    const MAX_CANVAS_PIXELS = 2048 * 1536;
    const cappedDpr = Math.min(rawDpr, MAX_RENDER_DPR);
    let devicePixelRatio = cappedDpr;

    const initialViewport = page.getViewport({ scale: zoom * devicePixelRatio });
    const totalPixels = initialViewport.width * initialViewport.height;
    // If canvas area exceeds budget, reduce dpr proportionally
    if (totalPixels > MAX_CANVAS_PIXELS) {
      devicePixelRatio = devicePixelRatio * Math.sqrt(MAX_CANVAS_PIXELS / totalPixels);
    }

    const scale = zoom * devicePixelRatio;
    let docLayer = doc.querySelector("#koodoPDFLayer");
    docLayer.style.visibility = "hidden";
    // Scale layer back to 1x layout size (no device-pixel upsampling in DOM)
    docLayer.style.transform = `scale(${1 / devicePixelRatio})`;
    docLayer.style.transformOrigin = "top left";
    docLayer.style.setProperty("--scale-factor", scale);
    const viewport = page.getViewport({ scale });
    docLayer.style.width = `${viewport.width / devicePixelRatio}px`;
    docLayer.style.height = `${viewport.height / devicePixelRatio}px`;

    // the canvas must be in the `PDFDocument`'s `ownerDocument`
    // (`globalThis.document` by default); that's where the fonts are loaded
    const canvas = document.createElement("canvas");
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const canvasContext = canvas.getContext("2d");
    try {
      if (isKeepPDFBackground === "yes") {
        await page.render({
          canvasContext,
          viewport,
        }).promise;
      } else {
        await page.render({
          canvasContext,
          viewport,
          background: "rgba(0,0,0,0)",
        }).promise;
      }
    } catch (error) {
      console.error(error);
    }
    doc.querySelector("#canvas").replaceChildren(doc.adoptNode(canvas));
    docLayer.style.overflow = "hidden";
    const container = doc.querySelector("#textLayer");
    try {
      const textLayer = new pdfjsLib.TextLayer({
        textContentSource: await page.streamTextContent(),
        container,
        viewport,
      });
      await textLayer.render();
    } catch (error) {
      console.error(error);
    }

    // hide "offscreen" canvases appended to docuemnt when rendering text layer
    // https://github.com/mozilla/pdf.js/blob/642b9a5ae67ef642b9a8808fd9efd447e8c350e2/web/pdf_viewer.css#L51-L58
    for (const canvas of document.querySelectorAll(".hiddenCanvasElement"))
      Object.assign(canvas.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: "0",
        height: "0",
        display: "none",
      });

    // fix text selection
    // https://github.com/mozilla/pdf.js/blob/642b9a5ae67ef642b9a8808fd9efd447e8c350e2/web/text_layer_builder.js#L105-L107
    const endOfContent = document.createElement("div");
    endOfContent.className = "endOfContent";
    container.append(endOfContent);
    let isSelecting = false;
    let closestElement = null;
    // TODO: this only works in Firefox; see https://github.com/mozilla/pdf.js/pull/17923
    container.onpointerdown = () => {
      let iWin = doc?.defaultView;
      const selectedText = iWin.getSelection().toString().trim();
      if (selectedText.length > 0) {
        // if there is already selected text, do not start selecting
        container.classList.remove("selecting");
        isSelecting = false;
        endOfContent.remove();
        container.append(endOfContent);
        return;
      }
      container.classList.add("selecting");
      isSelecting = true;
    };
    if (isMobile !== "yes") {
      container.onpointerup = () => {
        container.classList.remove("selecting");
        isSelecting = false;
        endOfContent.remove();
        container.append(endOfContent);
      };
      container.onpointermove = (e) => {
        if (!isSelecting) return;
        let element = e.target.closest(".textLayer > span");
        // Check if the target or any of its parents is a span element within the text layer
        const isText = element !== null;
        container.style.cursor = isText ? "text" : "default";
        //if not, insert end of content element next to closest element
        //remove end of content element from container
        if (isText) {
          closestElement = element;
        }

        endOfContent.remove();
        container.insertBefore(endOfContent, closestElement);
      };
    } else {
      //adapt to touch screen
      doc.addEventListener("selectionchange", (e) => {
        if (!isSelecting) return;
        // get the end element of the current selection
        let iWin = doc?.defaultView;
        var range = iWin.getSelection().getRangeAt(0);
        // get the end element of the current range
        var endNode = range.endContainer;
        // Get the parent HTMLElement. If endNode is a Text node, parentNode is the element.
        // If endNode is already an element (less common for endContainer), use it directly.
        let element =
          endNode.nodeType === Node.TEXT_NODE ? endNode.parentNode : endNode;
        element = element.closest(".textLayer > span");
        // Check if the target or any of its parents is a span element within the text layer
        const isText = element !== null;
        container.style.cursor = isText ? "text" : "default";
        //if not, insert end of content element next to closest element
        //remove end of content element from container
        if (isText) {
          closestElement = element;
        }
        endOfContent.remove();
        container.insertBefore(
          endOfContent,
          closestElement.nextSibling
            ? closestElement.nextSibling
            : closestElement
        );
      });
    }

    const div = doc.querySelector("#annotationLayer");
    try {
      await new pdfjsLib.AnnotationLayer({ page, viewport, div }).render({
        annotations: await page.getAnnotations(),
        linkService: {
          goToDestination: async (dest) => {
            try {
              // 解析目标位置
              const parsed =
                typeof dest === "string"
                  ? await pdf.getDestination(dest)
                  : dest;

              if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
                console.warn("Invalid destination:", dest);
                return;
              }

              // 获取目标页面索引
              const pageIndex = await pdf.getPageIndex(parsed[0]);
              viewer.goToChapterDocIndex(pageIndex);
            } catch (error) {
              console.error("Error navigating to destination:", error);
            }
          },
          getDestinationHash: (dest) => JSON.stringify(dest),
          addLinkAttributes: (link, url) => (link.href = url),
        },
      });
    } catch (error) {
      console.error(error);
    }
  } catch (error) {
    console.error(error);
  }
};

const renderPage = async (page, getImageBlob) => {
  try {
    const viewport = page.getViewport({ scale: 1 });
    if (getImageBlob) {
      const canvas = document.createElement("canvas");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      const canvasContext = canvas.getContext("2d");
      await page.render({ canvasContext, viewport }).promise;
      return new Promise((resolve) => canvas.toBlob(resolve));
    }
    const src = URL.createObjectURL(
      new Blob(
        [
          `
    <!DOCTYPE html>
    <html lang="en">
    <meta charset="utf-8">
    <meta name="viewport" content="width=${viewport.width}, height=${viewport.height}">
    <style>
    html, body {
        margin: 0;
        padding: 0;
    }
    ${await textLayerBuilderCSS()}
    ${await annotationLayerBuilderCSS()}
    .koodoPDFLayer {
        position: relative;
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
        will-change: transform;
    }

    .textLayer {
        position: absolute;
        z-index: 1;
        transform-origin: 0 0;
        contain: layout style paint;
        pointer-events: auto;
    }

    .annotationLayer {
        position: absolute;
        z-index: 2;
        transform-origin: 0 0;
        will-change: transform;
        contain: layout style paint;
        pointer-events: none;
    }

    #canvas {
        position: relative;
        z-index: 0;
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
    }
    .canvas-container {
        position: absolute !important;
        z-index: 3;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        pointer-events: auto;
    }
    .fabric {
        position: absolute !important;
        z-index: 3;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        pointer-events: auto;
        display: none;
    }

    /* 只有注释元素本身可点击 */
    .annotationLayer > * {
        pointer-events: auto !important;
    }

    /* 链接和按钮等交互元素 */
    .annotationLayer a,
    .annotationLayer button,
    .annotationLayer input,
    .annotationLayer [data-annotation-id] {
        pointer-events: auto !important;
        z-index: inherit;
    }

    /* Match pdf.js viewer rotation handling for layers with page-level rotation.
       Without these rules, PDFs that embed a 90/180/270 degree page rotation
       can render the text/annotation layers mirrored relative to the canvas. */
    .textLayer[data-main-rotation="90"],
    .annotationLayer[data-main-rotation="90"] {
        transform: rotate(90deg) translateY(-100%);
    }

    .textLayer[data-main-rotation="180"],
    .annotationLayer[data-main-rotation="180"] {
        transform: rotate(180deg) translate(-100%, -100%);
    }

    .textLayer[data-main-rotation="270"],
    .annotationLayer[data-main-rotation="270"] {
        transform: rotate(270deg) translateX(-100%);
    }
    </style>
    <div class="noteLayer"></div>
    <div class="koodoPDFLayer" id="koodoPDFLayer">
        <div id="canvas"></div>
        <div class="textLayer" id="textLayer"></div>
        <canvas class="fabric" id="fabric"></canvas>
        <div class="annotationLayer" id="annotationLayer"></div>
    </div>
`,
        ],
        { type: "text/html" }
      )
    );
    return src;
  } catch (error) {
    console.error(error);
  }
};

const makeTOCItem = (item) => ({
  label: item.title,
  href: item.dest ? JSON.stringify(item.dest) : null,
  subitems: item.items.length ? item.items.map(makeTOCItem) : null,
});
function getPasswordPrompt(type = "need") {
  const lang = navigator.language?.toLowerCase() || "en";
  if (lang.startsWith("zh")) {
    return type === "need" ? "请输入PDF密码：" : "密码错误，请重新输入：";
  }
  // 可扩展更多语言
  return type === "need"
    ? "Need password to open this PDF:"
    : "Incorrect password, please try again:";
}
export const makePDF = async (file, password) => {
  let pdf;
  while (true) {
    // 每次都新建 transport，避免 no PDFDataTransportStreamRangeReader instance found 错误
    const transport = new pdfjsLib.PDFDataRangeTransport(file.size, []);
    transport.requestDataRange = (begin, end) => {
      file
        .slice(begin, end)
        .arrayBuffer()
        .then((chunk) => {
          transport.onDataRange(begin, chunk);
        });
    };
    try {
      pdf = await pdfjsLib.getDocument({
        range: transport,
        cMapUrl: pdfjsPath("cmaps/"),
        standardFontDataUrl: pdfjsPath("standard_fonts/"),
        isEvalSupported: false,
        password,
      }).promise;
      break; // 成功加载，跳出循环
    } catch (e) {
      if (e.name === "PasswordException") {
        if (e.code === pdfjsLib.PasswordResponses.NEED_PASSWORD) {
          // 如果是 Electron 环境，使用 electron-prompt 获取密码
          if (isElectron()) {
            password = await vexPromptAsync(getPasswordPrompt("need"), "", "");
            vex.closeAll(); // 关闭对话框
          } else {
            password = prompt(getPasswordPrompt("need"));
          }
        } else if (e.code === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD) {
          if (isElectron()) {
            password = await vexPromptAsync(
              getPasswordPrompt("incorrect"),
              "",
              ""
            );
            vex.closeAll(); // 关闭对话框
          } else {
            password = prompt(getPasswordPrompt("incorrect"));
          }
        }
        if (!password) {
          throw new Error("PDF loading failed: no password provided");
        }
      } else {
        throw e;
      }
    }
  }
  let isScannedPdf = false;
  let testedPage =
    pdf.numPages > 0
      ? await pdf.getPage(Math.floor(pdf.numPages / 2) + 1)
      : null;
  if (testedPage) {
    const textContent = await testedPage.getTextContent();
    isScannedPdf = textContent.items.length === 0;
    // 进一步检查文本有效性（避免误判带OCR的扫描件）
    if (textContent.items.length > 0) {
      const totalChars = textContent.items.reduce(
        (sum, item) => sum + item.str.trim().length,
        0
      );
      // 阈值策略：字符少于50或文本覆盖率过低
      isScannedPdf = totalChars < 45;
    }
    testedPage.cleanup();
  }

  const book = { rendition: { layout: "pre-paginated" } };

  const { metadata, info } = (await pdf.getMetadata()) ?? {};
  // TODO: for better results, parse `metadata.getRaw()`
  book.metadata = {
    title: metadata?.get("dc:title") ?? info?.Title,
    author: metadata?.get("dc:creator") ?? info?.Author,
    contributor: metadata?.get("dc:contributor"),
    description: metadata?.get("dc:description") ?? info?.Subject,
    language: metadata?.get("dc:language"),
    publisher: metadata?.get("dc:publisher"),
    subject: metadata?.get("dc:subject"),
    identifier: metadata?.get("dc:identifier"),
    source: metadata?.get("dc:source"),
    rights: metadata?.get("dc:rights"),
  };
  book.metadata.description =
    (book.metadata.description ? book.metadata.description : "") +
    (isScannedPdf ? "\nscanned PDF" : "") +
    (password ? "\nprotected PDF: #" + password + "#" : "");

  const outline = await pdf.getOutline();
  book.toc = outline?.map(makeTOCItem);

  const cache = new Map();
  book.sections = Array.from({ length: pdf.numPages }).map((_, i) => ({
    id: i,
    load: async () => {
      const cached = cache.get(i);
      if (cached) return cached;
      const url = await renderPage(await pdf.getPage(i + 1), false);
      cache.set(i, url);
      return url;
    },
    unload: async () => {
      let page = await pdf.getPage(i + 1);
      page.cleanup();
    },
    render: async (doc, scale, isMobile, viewer, isKeepPDFBackground) => {
      await render(
        await pdf.getPage(i + 1),
        pdf,
        doc,
        scale,
        isMobile,
        viewer,
        isKeepPDFBackground
      );
    },
    getTextContent: async () => {
      const page = await pdf.getPage(i + 1);
      const textContent = await page.getTextContent();
      return textContent;
      // return textContent.items.map(item => item.str).join('\n')
    },
    size: 1000,
    getDimension: async () => {
      let viewport = (await pdf.getPage(i + 1)).getViewport({ scale: 1 });
      return { width: viewport.width, height: viewport.height };
    },
    getPage: async () => {
      return await pdf.getPage(i + 1);
    },
  }));
  book.isExternal = (uri) => /^\w+:/i.test(uri);
  book.resolveHref = async (href) => {
    const parsed = JSON.parse(href);
    const dest =
      typeof parsed === "string" ? await pdf.getDestination(parsed) : parsed;
    const index = await pdf.getPageIndex(dest[0]);
    return { index };
  };
  book.resolveHrefIndex = async (href) => {
    const parsed = JSON.parse(href);
    const dest =
      typeof parsed === "string" ? await pdf.getDestination(parsed) : parsed;
    const index = await pdf.getPageIndex(dest[0]);
    return { index: index ? index : 0 };
  };
  book.splitTOCHref = async (href) => {
    const parsed = JSON.parse(href);
    const dest =
      typeof parsed === "string" ? await pdf.getDestination(parsed) : parsed;
    const index = await pdf.getPageIndex(dest[0]);
    return [index, null];
  };
  book.getTOCFragment = (doc) => doc.documentElement;
  book.getCover = async () => renderPage(await pdf.getPage(1), true);
  book.destroy = () => pdf.destroy();
  return book;
};
export const isPDF = async (file) => {
  const arr = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return (
    arr[0] === 0x25 &&
    arr[1] === 0x50 &&
    arr[2] === 0x44 &&
    arr[3] === 0x46 &&
    arr[4] === 0x2d
  );
};
