declare var window: any;

const djvujsPath = (path) => `${isElectron() ? "." : ""}/lib/djvujs/${path}`;

const DjVu = window.DjVu;

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

const render = async (page, pdf, doc, zoom, isMobile, viewer) => {
  // try {
  //   let devicePixelRatio =
  //     window.devicePixelRatio * (isMobile === "yes" ? (1 / zoom) * 1.5 : 1);
  //   const scale = zoom * devicePixelRatio;
  //   let docLayer = doc.querySelector("#koodoPDFLayer");
  //   docLayer.style.visibility = "hidden";
  //   docLayer.style.transform = `scale(${1 / devicePixelRatio})`;
  //   docLayer.style.transformOrigin = "top left";
  //   docLayer.style.setProperty("--scale-factor", scale);
  //   const viewport = page.getViewport({ scale });
  //   // the canvas must be in the `PDFDocument`'s `ownerDocument`
  //   // (`globalThis.document` by default); that's where the fonts are loaded
  //   const canvas = document.createElement("canvas");
  //   docLayer.style.width = `${viewport.width}px`;
  //   docLayer.style.height = `${viewport.height}px`;
  //   canvas.height = viewport.height;
  //   canvas.width = viewport.width;
  //   const canvasContext = canvas.getContext("2d");
  //   try {
  //     await page.render({
  //       canvasContext,
  //       viewport,
  //       background: "rgba(0,0,0,0)",
  //     }).promise;
  //   } catch (error) {
  //     console.error(error);
  //   }
  //   doc.querySelector("#canvas").replaceChildren(doc.adoptNode(canvas));
  //   docLayer.style.overflow = "hidden";
  //   const container = doc.querySelector("#textLayer");
  //   try {
  //     const textLayer = new pdfjsLib.TextLayer({
  //       textContentSource: await page.streamTextContent(),
  //       container,
  //       viewport,
  //     });
  //     await textLayer.render();
  //   } catch (error) {
  //     console.error(error);
  //   }
  //   // hide "offscreen" canvases appended to docuemnt when rendering text layer
  //   // https://github.com/mozilla/pdf.js/blob/642b9a5ae67ef642b9a8808fd9efd447e8c350e2/web/pdf_viewer.css#L51-L58
  //   for (const canvas of document.querySelectorAll(".hiddenCanvasElement"))
  //     Object.assign(canvas.style, {
  //       position: "absolute",
  //       top: "0",
  //       left: "0",
  //       width: "0",
  //       height: "0",
  //       display: "none",
  //     });
  //   // fix text selection
  //   // https://github.com/mozilla/pdf.js/blob/642b9a5ae67ef642b9a8808fd9efd447e8c350e2/web/text_layer_builder.js#L105-L107
  //   const endOfContent = document.createElement("div");
  //   endOfContent.className = "endOfContent";
  //   container.append(endOfContent);
  //   let isSelecting = false;
  //   let closestElement = null;
  //   // TODO: this only works in Firefox; see https://github.com/mozilla/pdf.js/pull/17923
  //   container.onpointerdown = () => {
  //     let iWin = doc?.defaultView;
  //     const selectedText = iWin.getSelection().toString().trim();
  //     if (selectedText.length > 0) {
  //       // if there is already selected text, do not start selecting
  //       container.classList.remove("selecting");
  //       isSelecting = false;
  //       endOfContent.remove();
  //       container.append(endOfContent);
  //       return;
  //     }
  //     container.classList.add("selecting");
  //     isSelecting = true;
  //   };
  //   if (isMobile !== "yes") {
  //     container.onpointerup = () => {
  //       container.classList.remove("selecting");
  //       isSelecting = false;
  //       endOfContent.remove();
  //       container.append(endOfContent);
  //     };
  //     container.onpointermove = (e) => {
  //       if (!isSelecting) return;
  //       let element = e.target.closest(".textLayer > span");
  //       // Check if the target or any of its parents is a span element within the text layer
  //       const isText = element !== null;
  //       container.style.cursor = isText ? "text" : "default";
  //       //if not, insert end of content element next to closest element
  //       //remove end of content element from container
  //       if (isText) {
  //         closestElement = element;
  //       }
  //       endOfContent.remove();
  //       container.insertBefore(endOfContent, closestElement);
  //     };
  //   } else {
  //     //adapt to touch screen
  //     doc.addEventListener("selectionchange", (e) => {
  //       if (!isSelecting) return;
  //       // get the end element of the current selection
  //       let iWin = doc?.defaultView;
  //       var range = iWin.getSelection().getRangeAt(0);
  //       // get the end element of the current range
  //       var endNode = range.endContainer;
  //       // Get the parent HTMLElement. If endNode is a Text node, parentNode is the element.
  //       // If endNode is already an element (less common for endContainer), use it directly.
  //       let element =
  //         endNode.nodeType === Node.TEXT_NODE ? endNode.parentNode : endNode;
  //       element = element.closest(".textLayer > span");
  //       // Check if the target or any of its parents is a span element within the text layer
  //       const isText = element !== null;
  //       container.style.cursor = isText ? "text" : "default";
  //       //if not, insert end of content element next to closest element
  //       //remove end of content element from container
  //       if (isText) {
  //         closestElement = element;
  //       }
  //       endOfContent.remove();
  //       container.insertBefore(
  //         endOfContent,
  //         closestElement.nextSibling
  //           ? closestElement.nextSibling
  //           : closestElement
  //       );
  //     });
  //   }
  //   const div = doc.querySelector("#annotationLayer");
  //   try {
  //     await new pdfjsLib.AnnotationLayer({ page, viewport, div }).render({
  //       annotations: await page.getAnnotations(),
  //       linkService: {
  //         goToDestination: async (dest) => {
  //           try {
  //             // 解析目标位置
  //             const parsed =
  //               typeof dest === "string"
  //                 ? await pdf.getDestination(dest)
  //                 : dest;
  //             if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
  //               console.warn("Invalid destination:", dest);
  //               return;
  //             }
  //             // 获取目标页面索引
  //             const pageIndex = await pdf.getPageIndex(parsed[0]);
  //             viewer.goToChapterDocIndex(pageIndex);
  //           } catch (error) {
  //             console.error("Error navigating to destination:", error);
  //           }
  //         },
  //         getDestinationHash: (dest) => JSON.stringify(dest),
  //         addLinkAttributes: (link, url) => (link.href = url),
  //       },
  //     });
  //   } catch (error) {
  //     console.error(error);
  //   }
  // } catch (error) {
  //   console.error(error);
  // }
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
    .koodoPDFLayer {
        position: relative;
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
        will-change: transform;
    }

    .textLayer {
        position: absolute;
        z-index: 1;
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
        contain: layout style paint;
        pointer-events: auto;
    }

    .annotationLayer {
        position: absolute;
        z-index: 2;
        transform: translateZ(1px);
        -webkit-transform: translateZ(1px);
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
    </style>
    <div class="noteLayer"></div>
    <div class="koodoPDFLayer" id="koodoPDFLayer">
        <div id="canvas"></div>
        <div class="textLayer" id="textLayer"></div>
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
  label: item.description,
  href: item.url ? item.url : null,
  subitems: item.children.length ? item.children.map(makeTOCItem) : null,
});

export const makeDJVU = async (file, password) => {
  let djvu = new DjVu.Document(file);

  let isScannedPdf = false;
  let pageNum = djvu.getPagesQuantity();
  let testedPage =
    pageNum > 0 ? await djvu.getPage(Math.floor(pageNum / 2) + 1) : null;
  if (testedPage) {
    const textContent = await testedPage.getText();
    isScannedPdf = textContent.length < 45;
    testedPage.cleanup();
  }

  const book: any = { rendition: { layout: "pre-paginated" } };

  const spec = await djvu.toString();
  console.log(spec, "spec");
  book.metadata = {
    title: "Title Placeholder",
    author: "Author Placeholder",
  };
  book.metadata.description =
    (book.metadata.description ? book.metadata.description : "") +
    (isScannedPdf ? "\nscanned PDF" : "") +
    (password ? "\nprotected PDF: #" + password + "#" : "");

  const outline = await djvu.getContents();
  book.toc = outline?.map(makeTOCItem);

  const cache = new Map();
  book.sections = Array.from({ length: pageNum }).map((_, i) => ({
    id: i,
    load: async () => {
      const cached = cache.get(i);
      if (cached) return cached;
      const url = await renderPage(await djvu.getPage(i + 1), false);
      cache.set(i, url);
      return url;
    },
    unload: async () => {
      let page = await djvu.getPage(i + 1);
      page.reset();
    },
    render: async (doc, scale, isMobile, viewer) => {
      await render(
        await djvu.getPage(i + 1),
        djvu,
        doc,
        scale,
        isMobile,
        viewer
      );
    },
    getTextContent: async () => {
      const page = await djvu.getPage(i + 1);
      const textContent = await page.getText();
      return textContent;
      // return textContent.items.map(item => item.str).join('\n')
    },
    size: 1000,
    getDimension: async () => {
      let page = await djvu.getPage(i + 1);
      return { width: page.getWidth(), height: page.getHeight() };
    },
    getPage: async () => {
      return await djvu.getPage(i + 1);
    },
  }));
  book.isExternal = (uri) => /^\w+:/i.test(uri);
  book.resolveHref = async (href) => {
    //TODO
    return { index: 0 };
  };
  book.splitTOCHref = async (href) => {
    //TODO
    return [0, null];
  };
  book.getTOCFragment = (doc) => doc.documentElement;
  book.getCover = async () => renderPage(await djvu.getPage(1), true);
  book.destroy = () => {
    //TODO: destroy djvu document to release memory
  };
  return book;
};
