const pdfjsPath = (path) => `${isElectron() ? "." : ""}/lib/pdfjs/${path}`;

const getPdfjsLib = () => {
  const pdfjsLib = window.pdfjsLib || globalThis.pdfjsLib;
  if (!pdfjsLib) {
    throw new Error(
      "pdf.js is not available. Please load the pdf.js bundle before using Kookit."
    );
  }
  return pdfjsLib;
};

const configurePdfjs = () => {
  const pdfjsLib = getPdfjsLib();
  const workerOptions = pdfjsLib.GlobalWorkerOptions;

  if (workerOptions && !workerOptions.workerSrc && !workerOptions.workerPort) {
    workerOptions.workerSrc = pdfjsPath("pdf.worker.mjs");
  }

  return pdfjsLib;
};

const getDocumentOptions = (source, password) => ({
  ...source,
  cMapUrl: pdfjsPath("cmaps/"),
  cMapPacked: true,
  standardFontDataUrl: pdfjsPath("standard_fonts/"),
  wasmUrl: pdfjsPath("wasm/"),
  isEvalSupported: false,
  password,
});

const PDF_LAYER_CSS = `
html, body {
  margin: 0;
  padding: 0;
  background: transparent;
  overflow: hidden;
}

body {
  color-scheme: only light;
}

.noteLayer {
  position: relative;
  z-index: 3;
}

.koodoPDFLayer {
  position: relative;
  isolation: isolate;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  will-change: contents;
}

#canvas {
  position: absolute;
  inset: 0;
  z-index: 0;
}

#canvas canvas {
  display: block;
}

.textLayer {
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor, 1) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
  position: absolute;
  inset: 0;
  overflow: clip;
  opacity: 1;
  line-height: 1;
  text-align: initial;
  transform-origin: 0 0;
  z-index: 1;
  color-scheme: only light;
  forced-color-adjust: none;
  caret-color: CanvasText;
  -webkit-text-size-adjust: none;
  -moz-text-size-adjust: none;
  text-size-adjust: none;
}

.textLayer.highlighting {
  touch-action: none;
}

.textLayer :is(span, br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0 0;
}

.textLayer > :not(.markedContent),
.textLayer .markedContent span:not(.markedContent) {
  z-index: 1;
  --font-height: 0;
  --scale-x: 1;
  --rotate: 0deg;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  transform: rotate(var(--rotate)) scaleX(var(--scale-x))
    scale(var(--min-font-size-inv));
}

.textLayer .markedContent {
  display: contents;
}

.textLayer span[role="img"] {
  user-select: none;
  cursor: default;
}

.textLayer ::selection {
  /* stylelint-disable declaration-block-no-duplicate-properties */
  /*#if !MOZCENTRAL*/
  background: rgba(0 0 255 / 0.25);
  /*#endif*/
  /* stylelint-enable declaration-block-no-duplicate-properties */
  background: color-mix(in srgb, AccentColor, transparent 75%);
}
.textLayer br::selection {
  background: transparent;
}
.textLayer .endOfContent {
  display: block;
  position: absolute;
  inset: 100% 0 0;
  z-index: 0;
  cursor: default;
  user-select: none;
}
.textLayer.selecting .endOfContent {
  top: 0;
}
#koodoPDFLayerExtra {
  display: none;
}

`;

const isElectron = () => {
  if (
    typeof window !== "undefined" &&
    typeof window.process === "object" &&
    window.process.type === "renderer"
  ) {
    return true;
  }
  if (
    typeof process !== "undefined" &&
    typeof process.versions === "object" &&
    !!process.versions.electron
  ) {
    return true;
  }
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

const buildPdfPageMarkup = (viewport) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta
    name="viewport"
    content="width=${viewport.width}, height=${viewport.height}, initial-scale=1"
  >
  <style>${PDF_LAYER_CSS}</style>
</head>
<body>
  <div class="noteLayer"></div>
  <div class="koodoPDFLayer" id="koodoPDFLayer">
    <div id="canvas"></div>
    <div class="textLayer" id="textLayer"></div>
    <div class="annotationLayer" id="annotationLayer"></div>
  </div>
</body>
</html>
`;

const hideOffscreenCanvases = (root) => {
  if (!root?.querySelectorAll) {
    return;
  }

  for (const canvas of root.querySelectorAll(".hiddenCanvasElement")) {
    Object.assign(canvas.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "0",
      height: "0",
      display: "none",
    });
  }
};

const attachTextSelectionHandlers = (container, doc, isMobile) => {
  const endOfContent = document.createElement("div");
  endOfContent.className = "endOfContent";
  container.append(endOfContent);

  let isSelecting = false;
  let closestElement = null;

  container.onpointerdown = () => {
    const innerWindow = doc?.defaultView;
    const selectedText = innerWindow?.getSelection()?.toString().trim() || "";

    if (selectedText.length > 0) {
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

    container.onpointermove = (event) => {
      if (!isSelecting) {
        return;
      }

      const element = event.target.closest(".textLayer > span");
      const isText = element !== null;
      container.style.cursor = isText ? "text" : "default";

      if (isText) {
        closestElement = element;
      }

      endOfContent.remove();
      container.insertBefore(endOfContent, closestElement);
    };
    return;
  }

  doc.addEventListener("selectionchange", () => {
    if (!isSelecting) {
      return;
    }

    const innerWindow = doc?.defaultView;
    const selection = innerWindow?.getSelection();

    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const endNode = range.endContainer;
    let element =
      endNode.nodeType === Node.TEXT_NODE ? endNode.parentNode : endNode;
    element = element?.closest(".textLayer > span");

    const isText = element !== null;
    container.style.cursor = isText ? "text" : "default";

    if (isText) {
      closestElement = element;
    }

    endOfContent.remove();
    container.insertBefore(
      endOfContent,
      closestElement?.nextSibling || closestElement || null
    );
  });
};

const createLinkService = (pdf, viewer) => ({
  goToDestination: async (dest) => {
    try {
      const parsed =
        typeof dest === "string" ? await pdf.getDestination(dest) : dest;

      if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
        console.warn("Invalid destination:", dest);
        return;
      }

      const pageIndex = await pdf.getPageIndex(parsed[0]);
      viewer.goToChapterDocIndex(pageIndex);
    } catch (error) {
      console.error("Error navigating to destination:", error);
    }
  },
  getDestinationHash: (dest) => JSON.stringify(dest),
  addLinkAttributes: (link, url) => {
    link.href = url;
  },
});

const renderTextLayer = async (
  pdfjsLib,
  page,
  container,
  viewport,
  doc,
  isMobile
) => {
  container.replaceChildren();
  container.removeAttribute("data-main-rotation");
  container.style.setProperty("--total-scale-factor", `${viewport.scale}`);
  container.style.setProperty("--scale-round-x", "1px");
  container.style.setProperty("--scale-round-y", "1px");

  const textLayer = new pdfjsLib.TextLayer({
    textContentSource: page.streamTextContent({
      includeMarkedContent: true,
      disableNormalization: true,
    }),
    container,
    viewport: viewport.clone({ dontFlip: true }),
  });

  await textLayer.render();
  attachTextSelectionHandlers(container, doc, isMobile);
  hideOffscreenCanvases(document);
  hideOffscreenCanvases(doc);
  hideBrElement(container);
};
const hideBrElement = (container) => {
  const brElements = container.querySelectorAll("br");
  for (const br of brElements) {
    br.style.display = "none";
  }
};

const renderAnnotationLayer = async (
  pdfjsLib,
  page,
  pdf,
  container,
  viewport,
  viewer
) => {
  container.replaceChildren();
  container.removeAttribute("data-main-rotation");
  container.style.setProperty("--total-scale-factor", `${viewport.scale}`);

  const annotationLayer = new pdfjsLib.AnnotationLayer({
    div: container,
    page,
    viewport: viewport.clone({ dontFlip: true }),
    linkService: createLinkService(pdf, viewer),
  });

  await annotationLayer.render({
    annotations: await page.getAnnotations({ intent: "display" }),
    imageResourcesPath: pdfjsPath("images/"),
    renderForms: true,
  });
};

const render = async (page, pdf, doc, zoom, isMobile, viewer) => {
  try {
    const pdfjsLib = configurePdfjs();
    const docLayer = doc.querySelector("#koodoPDFLayer");
    const canvasHost = doc.querySelector("#canvas");
    const textLayerHost = doc.querySelector("#textLayer");
    const annotationLayerHost = doc.querySelector("#annotationLayer");

    if (!docLayer || !canvasHost || !textLayerHost || !annotationLayerHost) {
      return;
    }

    const devicePixelRatio =
      (window.devicePixelRatio || 1) *
      (isMobile === "yes" ? (1 / zoom) * 1.5 : 1);
    const viewport = page.getViewport({ scale: zoom });

    docLayer.style.visibility = "hidden";
    docLayer.style.width = `${viewport.width}px`;
    docLayer.style.height = `${viewport.height}px`;
    docLayer.style.overflow = "hidden";
    docLayer.style.setProperty("--scale-factor", `${zoom}`);
    docLayer.style.setProperty("--total-scale-factor", `${zoom}`);

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(Math.floor(viewport.width * devicePixelRatio), 1);
    canvas.height = Math.max(Math.floor(viewport.height * devicePixelRatio), 1);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const canvasContext = canvas.getContext("2d", { alpha: true });
    if (!canvasContext) {
      return;
    }

    await page.render({
      canvasContext,
      viewport,
      transform:
        devicePixelRatio === 1
          ? null
          : [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0],
      background: "rgba(0,0,0,0)",
    }).promise;

    canvasHost.replaceChildren(doc.adoptNode(canvas));

    await renderTextLayer(
      pdfjsLib,
      page,
      textLayerHost,
      viewport,
      doc,
      isMobile
    );
    await renderAnnotationLayer(
      pdfjsLib,
      page,
      pdf,
      annotationLayerHost,
      viewport,
      viewer
    );

    docLayer.style.visibility = "visible";
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

    return URL.createObjectURL(
      new Blob([buildPdfPageMarkup(viewport)], { type: "text/html" })
    );
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
    return type === "need" ? "请输入 PDF 密码：" : "密码错误，请重试：";
  }
  return type === "need"
    ? "Need password to open this PDF:"
    : "Incorrect password, please try again:";
}

export const makePDF = async (file, password) => {
  const pdfjsLib = configurePdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  let pdf;

  while (true) {
    try {
      pdf = await pdfjsLib.getDocument(getDocumentOptions({ data }, password))
        .promise;
      break;
    } catch (error) {
      if (error.name !== "PasswordException") {
        throw error;
      }

      if (error.code === pdfjsLib.PasswordResponses.NEED_PASSWORD) {
        if (isElectron()) {
          password = await vexPromptAsync(getPasswordPrompt("need"), "", "");
          vex.closeAll();
        } else {
          password = prompt(getPasswordPrompt("need"));
        }
      } else if (error.code === pdfjsLib.PasswordResponses.INCORRECT_PASSWORD) {
        if (isElectron()) {
          password = await vexPromptAsync(
            getPasswordPrompt("incorrect"),
            "",
            ""
          );
          vex.closeAll();
        } else {
          password = prompt(getPasswordPrompt("incorrect"));
        }
      } else {
        throw error;
      }

      if (!password) {
        throw new Error("PDF loading failed: no password provided");
      }
    }
  }

  let isScannedPdf = false;
  const testedPage =
    pdf.numPages > 0
      ? await pdf.getPage(Math.floor(pdf.numPages / 2) + 1)
      : null;

  if (testedPage) {
    const textContent = await testedPage.getTextContent();
    isScannedPdf = textContent.items.length === 0;

    if (textContent.items.length > 0) {
      const totalChars = textContent.items.reduce(
        (sum, item) => sum + item.str.trim().length,
        0
      );
      isScannedPdf = totalChars < 45;
    }

    testedPage.cleanup();
  }

  const book = { rendition: { layout: "pre-paginated" } };
  const { metadata, info } = (await pdf.getMetadata()) ?? {};

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
    (book.metadata.description || "") +
    (isScannedPdf ? "\nscanned PDF" : "") +
    (password ? `\nprotected PDF: #${password}#` : "");

  const outline = await pdf.getOutline();
  book.toc = outline?.map(makeTOCItem);

  const cache = new Map();
  book.sections = Array.from({ length: pdf.numPages }).map((_, i) => ({
    id: i,
    load: async () => {
      const cached = cache.get(i);
      if (cached) {
        return cached;
      }

      const url = await renderPage(await pdf.getPage(i + 1), false);
      cache.set(i, url);
      return url;
    },
    unload: async () => {
      const page = await pdf.getPage(i + 1);
      page.cleanup();
    },
    render: async (doc, scale, isMobile, viewer) => {
      await render(await pdf.getPage(i + 1), pdf, doc, scale, isMobile, viewer);
    },
    getTextContent: async () => {
      const page = await pdf.getPage(i + 1);
      return await page.getTextContent();
    },
    size: 1000,
    getDimension: async () => {
      const viewport = (await pdf.getPage(i + 1)).getViewport({ scale: 1 });
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
