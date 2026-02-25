declare var window: any;

const DjVu = window.DjVu;

/**
 * Creates a pdf.js-compatible viewport object for a DjVu page.
 * This allows reuse of pdf.js highlight utilities (noteUtil.ts) with DjVu pages.
 */
class DjVuViewport {
  width: number;
  height: number;
  scale: number;
  private pageWidth: number;
  private pageHeight: number;

  constructor(pageWidth: number, pageHeight: number, scale: number) {
    this.pageWidth = pageWidth;
    this.pageHeight = pageHeight;
    this.scale = scale;
    this.width = pageWidth * scale;
    this.height = pageHeight * scale;
  }

  /**
   * Converts a point from page coordinates to viewport (screen) coordinates.
   * pdf.js convention: page coords have origin at bottom-left, Y axis goes up.
   */
  convertToViewportPoint(x: number, y: number): [number, number] {
    return [x * this.scale, (this.pageHeight - y) * this.scale];
  }

  /**
   * Converts a point from viewport (screen) coordinates to page coordinates.
   * Inverse of convertToViewportPoint.
   */
  convertToPdfPoint(x: number, y: number): [number, number] {
    return [x / this.scale, this.pageHeight - y / this.scale];
  }

  /**
   * Converts a rectangle [x1, y1, x2, y2] from page coordinates to viewport coordinates.
   * Compatible with pdf.js viewport.convertToViewportRectangle().
   */
  convertToViewportRectangle(
    rect: [number, number, number, number]
  ): [number, number, number, number] {
    const [x1, y1] = this.convertToViewportPoint(rect[0], rect[1]);
    const [x2, y2] = this.convertToViewportPoint(rect[2], rect[3]);
    return [x1, y1, x2, y2];
  }
}

/**
 * Creates a pdf.js-compatible wrapper from pre-fetched page data (from Worker).
 * Since DjVu.Worker only returns serializable data (ImageData, strings, plain objects),
 * we cannot get a real DjVuPage object. Instead we fetch all needed data from the
 * worker and wrap it into an interface expected by shared utilities.
 */
const wrapDjVuPageData = (pageData: {
  width: number;
  height: number;
  dpi: number;
  imageData: ImageData;
  text: string;
  textZones: any[] | null;
}) => {
  return {
    getWidth: () => pageData.width,
    getHeight: () => pageData.height,
    getDpi: () => pageData.dpi,
    getRotation: () => 0,
    getImageData: () => pageData.imageData,
    getText: () => pageData.text,
    getNormalizedTextZones: () => pageData.textZones,
    reset: () => {},
    // pdf.js-compatible method for highlight/annotation utilities
    getViewport: ({ scale }: { scale: number }) => {
      return new DjVuViewport(pageData.width, pageData.height, scale);
    },
    // pdf.js-compatible render method for convertPageToImage compatibility
    render: (renderContext: {
      canvasContext: CanvasRenderingContext2D;
      viewport: any;
    }) => {
      const promise = (async () => {
        const { canvasContext } = renderContext;
        const targetCanvas = canvasContext.canvas;

        if (typeof createImageBitmap === "function") {
          const bitmap = await createImageBitmap(pageData.imageData);
          canvasContext.drawImage(
            bitmap,
            0,
            0,
            targetCanvas.width,
            targetCanvas.height
          );
          bitmap.close();
        } else {
          const offscreen = document.createElement("canvas");
          offscreen.width = pageData.width;
          offscreen.height = pageData.height;
          const offCtx = offscreen.getContext("2d");
          if (offCtx) {
            offCtx.putImageData(pageData.imageData, 0, 0);
          }
          canvasContext.imageSmoothingEnabled = true;
          canvasContext.imageSmoothingQuality = "medium";
          canvasContext.drawImage(
            offscreen,
            0,
            0,
            targetCanvas.width,
            targetCanvas.height
          );
        }
      })();
      return { promise };
    },
  };
};

/**
 * DjVu text zone type constants (from the DjVu specification).
 * getPageTextZone() returns a hierarchical RawTextZone tree:
 *   PAGE → COLUMN → REGION → PARAGRAPH → LINE → WORD → CHARACTER
 */
const ZONE_TYPE_LINE = 5;

/**
 * Extract LINE-level zones from a hierarchical RawTextZone tree.
 * Instead of using getNormalizedTextZones() which produces one zone per WORD
 * (causing thousands of DOM spans per page), we walk the tree to LINE level
 * and concatenate all child word/character texts into a single text per line.
 * This matches the pdf.js approach where one span ≈ one line of text.
 *
 * @param pageTextZone - The root RawTextZone from getPageTextZone()
 * @param fullText - The page's full text string from getText()
 * @returns Array of line-level TextZone objects compatible with the existing rendering code
 */
const extractLineZones = (
  pageTextZone: any,
  fullText: string
): Array<{
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}> | null => {
  if (!pageTextZone || !fullText) return null;

  // RawTextZone.textStart/textLength are byte offsets into the raw UTF-8 byte array,
  // NOT character indices into the JS string. We must encode back to UTF-8
  // to correctly extract text by byte offset.
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(fullText);
  const decoder = new TextDecoder();

  const lines: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
  }> = [];

  const walk = (zone: any) => {
    if (zone.type === ZONE_TYPE_LINE) {
      // This is a LINE zone — extract its text using UTF-8 byte offsets
      const textBytes = utf8Bytes.slice(
        zone.textStart,
        zone.textStart + zone.textLength
      );
      const text = decoder.decode(textBytes);
      if (text.trim().length > 0) {
        lines.push({
          x: zone.x,
          y: zone.y,
          width: zone.width,
          height: zone.height,
          text: text,
        });
      }
      return; // Don't recurse deeper — we want line-level granularity
    }
    // Recurse into children for non-LINE zones (PAGE, COLUMN, REGION, PARAGRAPH)
    if (zone.children && zone.children.length > 0) {
      for (const child of zone.children) {
        walk(child);
      }
    } else if (zone.type > ZONE_TYPE_LINE) {
      // Leaf zone below LINE level without a LINE parent (unusual but possible)
      // Treat it like a line
      const textBytes = utf8Bytes.slice(
        zone.textStart,
        zone.textStart + zone.textLength
      );
      const text = decoder.decode(textBytes);
      if (text.trim().length > 0) {
        lines.push({
          x: zone.x,
          y: zone.y,
          width: zone.width,
          height: zone.height,
          text: text,
        });
      }
    }
  };

  walk(pageTextZone);
  return lines.length > 0 ? lines : null;
};

/**
 * Render a DjVu page into a sub-iframe document.
 * All heavy decoding (getImageData, getPageTextZone) runs in the Web Worker.
 * Only canvas drawing and DOM manipulation happen on the main thread.
 */
const MAX_CANVAS_PIXELS = 4_000_000;

const render = async (
  worker: any,
  pageNumber: number,
  doc: Document,
  zoom: number,
  isMobile: string,
  viewer: any,
  pagesSizes: Array<{ width: number; height: number; dpi: number }>
) => {
  try {
    // Batch fetch imageData, text, and hierarchical text zone from Worker in a single message
    const [imageData, pageTextZone, fullText] = await worker.run(
      worker.doc.getPage(pageNumber).getImageData(),
      worker.doc.getPage(pageNumber).getPageTextZone(),
      worker.doc.getPage(pageNumber).getText()
    );
    // Extract LINE-level zones (one span per line instead of one per word)
    const textZones = extractLineZones(pageTextZone, fullText || "");

    // Get page dimensions from pre-fetched sizes (no worker call needed)
    const pageWidth = pagesSizes[pageNumber - 1]?.width ?? imageData.width;
    const pageHeight = pagesSizes[pageNumber - 1]?.height ?? imageData.height;

    let devicePixelRatio =
      window.devicePixelRatio * (isMobile === "yes" ? (1 / zoom) * 1.5 : 1);
    const scale = zoom * devicePixelRatio;

    let scaledWidth = Math.round(pageWidth * scale);
    let scaledHeight = Math.round(pageHeight * scale);

    // Cap canvas resolution to avoid excessive memory/GPU usage
    const totalPixels = scaledWidth * scaledHeight;
    let canvasWidth = scaledWidth;
    let canvasHeight = scaledHeight;
    if (totalPixels > MAX_CANVAS_PIXELS) {
      const downscale = Math.sqrt(MAX_CANVAS_PIXELS / totalPixels);
      canvasWidth = Math.round(scaledWidth * downscale);
      canvasHeight = Math.round(scaledHeight * downscale);
    }

    let docLayer = doc.querySelector("#koodoPDFLayer") as HTMLElement;
    if (!docLayer) return;
    docLayer.style.visibility = "hidden";
    docLayer.style.transform = `scale(${1 / devicePixelRatio})`;
    docLayer.style.transformOrigin = "top left";
    docLayer.style.width = `${scaledWidth}px`;
    docLayer.style.height = `${scaledHeight}px`;

    // Render image: imageData was decoded in worker, just draw to canvas on main thread
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      if (typeof createImageBitmap === "function") {
        const bitmap = await createImageBitmap(imageData, {
          resizeWidth: canvasWidth,
          resizeHeight: canvasHeight,
          resizeQuality: "medium",
        });
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
      } else {
        canvas.width = pageWidth;
        canvas.height = pageHeight;
        ctx.putImageData(imageData, 0, 0);
      }
    }

    canvas.style.width = `${scaledWidth}px`;
    canvas.style.height = `${scaledHeight}px`;
    canvas.style.display = "block";

    const canvasContainer = doc.querySelector("#canvas") as HTMLElement;
    if (canvasContainer) {
      canvasContainer.replaceChildren(doc.adoptNode(canvas));
      canvasContainer.style.width = `${scaledWidth}px`;
      canvasContainer.style.height = `${scaledHeight}px`;
      canvasContainer.style.position = "relative";
    }
    docLayer.style.overflow = "hidden";

    // Render text layer
    const container = doc.querySelector("#textLayer") as HTMLElement;
    if (container) {
      container.innerHTML = "";
      container.style.position = "absolute";
      container.style.textAlign = "initial";
      container.style.inset = "0";
      container.style.overflow = "clip";
      container.style.opacity = "1";
      container.style.lineHeight = "1";
      container.style.transformOrigin = "0 0";
      container.style.zIndex = "1";
      container.style.setProperty("--scale-factor", String(scale));

      try {
        if (textZones && textZones.length > 0) {
          // Use DocumentFragment for batch DOM insertion (avoids layout thrashing)
          const fragment = document.createDocumentFragment();
          textZones.forEach((zone: any) => {
            const span = document.createElement("span");
            span.textContent = zone.text;

            // Position using percentages (like pdf.js)
            const leftPercent = (zone.x / pageWidth) * 100;
            // Convert bottom-origin zone.y to top-origin
            const topPercent =
              ((pageHeight - zone.y - zone.height) / pageHeight) * 100;

            span.style.cssText = `position:absolute;left:${leftPercent}%;top:${topPercent}%;font-size:calc(var(--scale-factor) * ${zone.height * 0.9}px);font-family:sans-serif;color:transparent;white-space:pre;line-height:1`;

            fragment.appendChild(span);
          });
          container.appendChild(fragment);

          // Adjust scaleX so each span fills its zone width
          // (like pdf.js uses transform: scaleX(...))
          requestAnimationFrame(() => {
            const spans = container.querySelectorAll("span");
            let idx = 0;
            textZones.forEach((zone: any) => {
              const span = spans[idx] as HTMLElement;
              if (span && span.offsetWidth > 0) {
                const targetWidth = zone.width * scale;
                const scaleXVal = targetWidth / span.offsetWidth;
                span.style.transform = `scaleX(${scaleXVal})`;
                span.style.transformOrigin = "left top";
              }
              idx++;
            });
          });
        }
      } catch (error) {
        console.error("Error rendering text layer:", error);
      }

      // Text selection support (same as pdf.js: .textLayer > span)
      const endOfContent = document.createElement("div");
      endOfContent.className = "endOfContent";
      container.append(endOfContent);
      let isSelecting = false;
      let closestElement: Element | null = null;

      container.onpointerdown = () => {
        let iWin = doc?.defaultView;
        const selectedText = iWin?.getSelection()?.toString().trim();
        if (selectedText && selectedText.length > 0) {
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
        container.onpointermove = (e: any) => {
          if (!isSelecting) return;
          let element = e.target.closest(".textLayer > span");
          const isText = element !== null;
          container.style.cursor = isText ? "text" : "default";
          if (isText) {
            closestElement = element;
          }
          endOfContent.remove();
          if (closestElement) {
            container.insertBefore(endOfContent, closestElement);
          }
        };
      } else {
        doc.addEventListener("selectionchange", () => {
          if (!isSelecting) return;
          let iWin = doc?.defaultView;
          try {
            var range = iWin!.getSelection()!.getRangeAt(0);
            var endNode = range.endContainer;
            let element: any =
              endNode.nodeType === Node.TEXT_NODE
                ? endNode.parentNode
                : endNode;
            element = element.closest(".textLayer > span");
            const isText = element !== null;
            container.style.cursor = isText ? "text" : "default";
            if (isText) {
              closestElement = element;
            }
            endOfContent.remove();
            if (closestElement) {
              container.insertBefore(
                endOfContent,
                closestElement.nextSibling
                  ? closestElement.nextSibling
                  : closestElement
              );
            }
          } catch (e) {
            // selection might be empty
          }
        });
      }
    }

    docLayer.style.visibility = "visible";
  } catch (error) {
    console.error("Error rendering DjVu page:", error);
  }
};

/**
 * Render a DjVu page for preview (iframe blob URL) or cover (image blob).
 * Heavy decoding runs in the Web Worker.
 */
const PREVIEW_MAX_WIDTH = 800;

const renderPage = async (
  worker: any,
  pageNumber: number,
  getImageBlob: boolean,
  pagesSizes: Array<{ width: number; height: number; dpi: number }>
) => {
  try {
    const imageData: ImageData = await worker.run(
      worker.doc.getPage(pageNumber).getImageData()
    );
    const pageWidth = pagesSizes[pageNumber - 1]?.width ?? imageData.width;
    const pageHeight = pagesSizes[pageNumber - 1]?.height ?? imageData.height;

    // Determine target size: for covers/previews, cap width to save memory
    let targetWidth = pageWidth;
    let targetHeight = pageHeight;
    if (getImageBlob && pageWidth > PREVIEW_MAX_WIDTH) {
      const ratio = PREVIEW_MAX_WIDTH / pageWidth;
      targetWidth = PREVIEW_MAX_WIDTH;
      targetHeight = Math.round(pageHeight * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Use createImageBitmap for GPU-accelerated resize when available
      if (typeof createImageBitmap === "function") {
        const bitmap = await createImageBitmap(imageData, {
          resizeWidth: targetWidth,
          resizeHeight: targetHeight,
          resizeQuality: "medium",
        });
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
      } else {
        // Fallback: draw at native size, rely on canvas downscale
        canvas.width = pageWidth;
        canvas.height = pageHeight;
        ctx.putImageData(imageData, 0, 0);
      }
    }

    if (getImageBlob) {
      return new Promise((resolve) => canvas.toBlob(resolve));
    }

    const src = URL.createObjectURL(
      new Blob(
        [
          `
    <!DOCTYPE html>
    <html lang="en">
    <meta charset="utf-8">
    <meta name="viewport" content="width=${pageWidth}, height=${pageHeight}">
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
        top: 0;
        left: 0;
        z-index: 1;
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
        contain: layout style paint;
        pointer-events: auto;
    }

    #canvas {
        position: relative;
        z-index: 0;
        transform: translateZ(0);
        -webkit-transform: translateZ(0);
    }
    </style>
    <div class="noteLayer"></div>
    <div class="koodoPDFLayer" id="koodoPDFLayer">
        <div id="canvas"></div>
        <div class="textLayer" id="textLayer"></div>
    </div>
`,
        ],
        { type: "text/html" }
      )
    );
    return src;
  } catch (error) {
    console.error("Error rendering DjVu page:", error);
  }
};

/**
 * Convert a DjVu bookmark to the internal TOC item format.
 * DjVu.js Bookmark: { description: string, url: string, children?: Array<Bookmark> }
 */
const makeTOCItem = (item: any) => ({
  label: item.description,
  href: item.url ? item.url : null,
  subitems:
    item.children && item.children.length
      ? item.children.map(makeTOCItem)
      : null,
});

/**
 * Recursively collect all bookmark URLs from a TOC tree for pre-caching.
 */
const collectTOCUrls = (items: any[]): string[] => {
  const urls: string[] = [];
  for (const item of items) {
    if (item.url) urls.push(item.url);
    if (item.children && item.children.length) {
      urls.push(...collectTOCUrls(item.children));
    }
  }
  return urls;
};

/**
 * Create a book object from a DjVu file ArrayBuffer.
 * Uses DjVu.js asynchronous Worker API (DjVu.Worker) to avoid blocking the main thread.
 *
 * All heavy decoding (getPage, getImageData, getText, etc.) runs in a Web Worker.
 * Only serializable results (ImageData, strings, plain objects, numbers) are
 * returned to the main thread.
 */
export const makeDJVU = async (file: ArrayBuffer | File, password?: string) => {
  let buffer: ArrayBuffer;
  if (file instanceof File) {
    buffer = await file.arrayBuffer();
  } else {
    buffer = file;
  }

  // Create DjVu.Worker — all decoding happens off the main thread.
  // createDocument() transfers the ArrayBuffer to the worker, which detaches it.
  // We pass a copy so the original buffer remains usable (e.g. for IndexedDB storage).
  const worker = new DjVu.Worker();
  await worker.createDocument(buffer.slice(0));

  // Fetch structural metadata from worker (these are fast, no page decoding)
  const [pageNum, outline, pagesSizes] = await worker.run(
    worker.doc.getPagesQuantity(),
    worker.doc.getContents(),
    worker.doc.getPagesSizes()
  );

  // Sample a middle page to check if text layer exists
  let isScannedDoc = false;
  if (pageNum > 0) {
    const testPageNum = Math.floor(pageNum / 2) + 1;
    try {
      const textContent: string = await worker.run(
        worker.doc.getPage(testPageNum).getText()
      );
      isScannedDoc = !textContent || textContent.trim().length < 45;
    } catch (e) {
      isScannedDoc = true;
    }
  }

  // Pre-cache TOC URL → page number mapping.
  // getPageNumberByUrl() is a sync method on DjVuDocument; via the worker we
  // batch all lookups at init time so resolveHref/splitTOCHref stay fast.
  const tocUrlToPage = new Map<string, number>();
  if (outline && outline.length > 0) {
    const allUrls = collectTOCUrls(outline);
    if (allUrls.length > 0) {
      const tasks = allUrls.map((url) => worker.doc.getPageNumberByUrl(url));
      const results: any = await worker.run(...tasks);
      // worker.run with single task returns the value directly, not an array
      const resultsArray = allUrls.length === 1 ? [results] : results;
      allUrls.forEach((url, idx) => {
        const pageNumber = resultsArray[idx];
        if (pageNumber != null) {
          tocUrlToPage.set(url, pageNumber);
        }
      });
    }
  }

  const book: any = { rendition: { layout: "pre-paginated" } };

  book.metadata = {
    title: "",
    author: "",
  };
  book.metadata.description =
    (isScannedDoc ? "scanned document" : "") +
    (password ? "\nprotected: #" + password + "#" : "");

  book.toc = outline && outline.length > 0 ? outline.map(makeTOCItem) : null;

  const cache = new Map();

  book.sections = Array.from({ length: pageNum }).map((_, i) => ({
    id: i,
    load: async () => {
      const cached = cache.get(i);
      if (cached) return cached;
      const url = await renderPage(worker, i + 1, false, pagesSizes);
      cache.set(i, url);
      return url;
    },
    unload: async () => {
      if (cache.has(i)) {
        const url = cache.get(i);
        if (typeof url === "string" && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
        cache.delete(i);
      }
    },
    render: async (
      doc: Document,
      scale: number,
      isMobile: string,
      viewer: any
    ) => {
      await render(worker, i + 1, doc, scale, isMobile, viewer, pagesSizes);
    },
    getTextContent: async () => {
      const textContent: string = await worker.run(
        worker.doc.getPage(i + 1).getText()
      );
      return textContent || "";
    },
    size: 1000,
    getDimension: async () => {
      if (pagesSizes && pagesSizes.length > i) {
        return {
          width: pagesSizes[i].width,
          height: pagesSizes[i].height,
          dpi: pagesSizes[i].dpi,
        };
      }
      // Fallback: ask worker for dimensions (rare, pagesSizes usually available)
      const [w, h, dpi] = await worker.run(
        worker.doc.getPage(i + 1).getWidth(),
        worker.doc.getPage(i + 1).getHeight(),
        worker.doc.getPage(i + 1).getDpi()
      );
      return { width: w, height: h, dpi: dpi };
    },
    getPage: async () => {
      // Fetch all needed page data from worker in one batch
      const [imageData, text, pageTextZone, w, h, dpi] = await worker.run(
        worker.doc.getPage(i + 1).getImageData(),
        worker.doc.getPage(i + 1).getText(),
        worker.doc.getPage(i + 1).getPageTextZone(),
        worker.doc.getPage(i + 1).getWidth(),
        worker.doc.getPage(i + 1).getHeight(),
        worker.doc.getPage(i + 1).getDpi()
      );
      // Extract LINE-level zones (one span per line instead of one per word)
      const textZones = extractLineZones(pageTextZone, text || "");
      return wrapDjVuPageData({
        width: w,
        height: h,
        dpi: dpi,
        imageData: imageData,
        text: text || "",
        textZones: textZones,
      });
    },
  }));

  book.isExternal = (uri: string) => /^\w+:/i.test(uri);

  book.resolveHref = async (href: string) => {
    // Use pre-cached mapping (built at init time)
    const pageNumber = tocUrlToPage.get(href);
    if (pageNumber != null) {
      return { index: pageNumber - 1 };
    }
    // Fallback: ask worker (for dynamically generated hrefs)
    try {
      const pn: number | null = await worker.run(
        worker.doc.getPageNumberByUrl(href)
      );
      if (pn != null) {
        tocUrlToPage.set(href, pn);
        return { index: pn - 1 };
      }
    } catch (e) {
      // ignore
    }
    return { index: 0 };
  };

  book.splitTOCHref = async (href: string) => {
    const pageNumber = tocUrlToPage.get(href);
    if (pageNumber != null) {
      return [pageNumber - 1, null];
    }
    try {
      const pn: number | null = await worker.run(
        worker.doc.getPageNumberByUrl(href)
      );
      if (pn != null) {
        tocUrlToPage.set(href, pn);
        return [pn - 1, null];
      }
    } catch (e) {
      // ignore
    }
    return [0, null];
  };

  book.getTOCFragment = (doc: Document) => doc.documentElement;

  book.getCover = async () => renderPage(worker, 1, true, pagesSizes);

  book.destroy = () => {
    // Revoke all cached blob URLs
    cache.forEach((url: string) => {
      if (typeof url === "string" && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    });
    cache.clear();
    // Terminate the worker to free resources
    try {
      worker.reset();
    } catch (e) {
      // ignore
    }
  };

  // Expose worker reference for external access if needed
  book._djvuWorker = worker;

  return book;
};
