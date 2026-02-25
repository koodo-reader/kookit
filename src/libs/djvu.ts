declare var window: any;

const DjVu = window.DjVu;

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
 * Wraps a DjVu page object with pdf.js-compatible methods so that shared
 * utilities (e.g. noteUtil.ts highlight functions) work seamlessly.
 */
const wrapDjVuPage = (page: any) => {
  return {
    // Original DjVu page methods
    getWidth: () => page.getWidth(),
    getHeight: () => page.getHeight(),
    getDpi: () => page.getDpi(),
    getRotation: () => page.getRotation(),
    getImageData: (rotate?: boolean) => page.getImageData(rotate),
    getText: () => page.getText(),
    getNormalizedTextZones: () => page.getNormalizedTextZones(),
    reset: () => page.reset(),
    // pdf.js-compatible method for highlight/annotation utilities
    getViewport: ({ scale }: { scale: number }) => {
      return new DjVuViewport(page.getWidth(), page.getHeight(), scale);
    },
    // pdf.js-compatible render method for convertPageToImage compatibility
    render: (renderContext: {
      canvasContext: CanvasRenderingContext2D;
      viewport: any;
    }) => {
      const promise = (async () => {
        const imageData = page.getImageData();
        const { canvasContext, viewport } = renderContext;
        const pageWidth = page.getWidth();
        const pageHeight = page.getHeight();

        // Draw native-resolution image into an offscreen canvas first
        const offscreen = document.createElement("canvas");
        offscreen.width = pageWidth;
        offscreen.height = pageHeight;
        const offCtx = offscreen.getContext("2d");
        if (offCtx) {
          offCtx.putImageData(imageData, 0, 0);
        }

        // Then scale into the target canvas context at the desired viewport size
        const targetCanvas = canvasContext.canvas;
        canvasContext.drawImage(
          offscreen,
          0,
          0,
          targetCanvas.width,
          targetCanvas.height
        );
      })();
      return { promise };
    },
    _djvuPage: page, // Keep reference to original DjVu page
  };
};

/**
 * Render a DjVu page into a sub-iframe document.
 * Uses DjVu.js page API: getImageData(), getText(), getNormalizedTextZones(),
 * getWidth(), getHeight(), getDpi().
 */
const render = async (
  djvuDoc: any,
  pageNumber: number,
  doc: Document,
  zoom: number,
  isMobile: string,
  viewer: any
) => {
  try {
    const page = await djvuDoc.getPage(pageNumber);
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    let devicePixelRatio =
      window.devicePixelRatio * (isMobile === "yes" ? (1 / zoom) * 1.5 : 1);
    const scale = zoom * devicePixelRatio;

    const scaledWidth = Math.round(pageWidth * scale);
    const scaledHeight = Math.round(pageHeight * scale);

    let docLayer = doc.querySelector("#koodoPDFLayer") as HTMLElement;
    if (!docLayer) return;
    docLayer.style.visibility = "hidden";
    docLayer.style.transform = `scale(${1 / devicePixelRatio})`;
    docLayer.style.transformOrigin = "top left";
    docLayer.style.width = `${scaledWidth}px`;
    docLayer.style.height = `${scaledHeight}px`;

    // Render image onto canvas
    const imageData = page.getImageData();
    const canvas = document.createElement("canvas");
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.putImageData(imageData, 0, 0);
    }

    // Scale canvas to target size via CSS
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

    // Render text layer using getNormalizedTextZones()
    // Following pdf.js pattern: .textLayer directly contains <span> elements,
    // each positioned with percentage-based left/top, using --scale-factor
    // CSS variable for font sizing and scaleX() for width adjustment.
    //
    // DjVu text zone coordinates: zone.x from left, zone.y from BOTTOM of page.
    // We convert zone.y to top-based percentage: top% = (pageHeight - zone.y - zone.height) / pageHeight * 100
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
      // Set --scale-factor CSS variable (like pdf.js)
      container.style.setProperty("--scale-factor", String(scale));

      try {
        const textZones = page.getNormalizedTextZones();
        if (textZones && textZones.length > 0) {
          textZones.forEach((zone: any) => {
            const span = document.createElement("span");
            span.textContent = zone.text;

            // Position using percentages (like pdf.js)
            const leftPercent = (zone.x / pageWidth) * 100;
            // Convert bottom-origin zone.y to top-origin
            const topPercent =
              ((pageHeight - zone.y - zone.height) / pageHeight) * 100;

            span.style.position = "absolute";
            span.style.left = `${leftPercent}%`;
            span.style.top = `${topPercent}%`;
            span.style.fontSize = `calc(var(--scale-factor) * ${zone.height * 0.9}px)`;
            span.style.fontFamily = "sans-serif";
            span.style.color = "transparent";
            span.style.whiteSpace = "pre";
            span.style.lineHeight = "1";

            container.appendChild(span);
          });

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
 * Uses DjVu.js page API: getImageData(), getWidth(), getHeight().
 */
const renderPage = async (
  djvuDoc: any,
  pageNumber: number,
  getImageBlob: boolean
) => {
  try {
    const page = await djvuDoc.getPage(pageNumber);
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const imageData = page.getImageData();

    const canvas = document.createElement("canvas");
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.putImageData(imageData, 0, 0);
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
 * Create a book object from a DjVu file ArrayBuffer.
 * Uses DjVu.js synchronous API: DjVu.Document(arrayBuffer, options)
 *
 * DjVuDocument methods used:
 * - getPagesQuantity(): number
 * - getContents(): Array<Bookmark>
 * - getPage(number): Promise<DjVuPage>
 * - getPageNumberByUrl(url): ?number
 * - toString(): string
 *
 * DjVuPage methods used:
 * - getWidth(): number
 * - getHeight(): number
 * - getDpi(): number
 * - getImageData(rotate?): ImageData
 * - getText(): string
 * - getNormalizedTextZones(): ?Array<TextZone>
 * - reset(): void
 */
export const makeDJVU = async (file: ArrayBuffer | File, password?: string) => {
  // DjVu.Document accepts an ArrayBuffer
  let buffer: ArrayBuffer;
  if (file instanceof File) {
    buffer = await file.arrayBuffer();
  } else {
    buffer = file;
  }

  const djvuDoc = new DjVu.Document(buffer);

  let isScannedDoc = false;
  const pageNum = djvuDoc.getPagesQuantity();

  // Sample a middle page to check if text layer exists
  if (pageNum > 0) {
    const testPageNum = Math.floor(pageNum / 2) + 1;
    try {
      const testedPage = await djvuDoc.getPage(testPageNum);
      const textContent = testedPage.getText();
      isScannedDoc = !textContent || textContent.trim().length < 45;
    } catch (e) {
      isScannedDoc = true;
    }
  }

  const book: any = { rendition: { layout: "pre-paginated" } };

  // DjVu files don't carry rich metadata like PDF; use placeholders
  book.metadata = {
    title: "DjVu Document",
    author: "",
  };
  book.metadata.description =
    (isScannedDoc ? "scanned document" : "") +
    (password ? "\nprotected: #" + password + "#" : "");

  // Table of contents via getContents()
  // Returns Array<Bookmark> where Bookmark = { description, url, children? }
  const outline = djvuDoc.getContents();
  book.toc = outline && outline.length > 0 ? outline.map(makeTOCItem) : null;

  // Page sizes for layout calculations (sync API: getPagesSizes())
  // Returns Array<{ width, height, dpi }>
  let pagesSizes: Array<{ width: number; height: number; dpi: number }> = [];
  try {
    pagesSizes = djvuDoc.getPagesSizes();
  } catch (e) {
    // Fallback: will get dimensions per-page
  }

  const cache = new Map();
  book.sections = Array.from({ length: pageNum }).map((_, i) => ({
    id: i,
    load: async () => {
      const cached = cache.get(i);
      if (cached) return cached;
      const url = await renderPage(djvuDoc, i + 1, false);
      cache.set(i, url);
      return url;
    },
    unload: async () => {
      // getPage() automatically resets the previously requested page
      // Explicit cache cleanup
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
      await render(djvuDoc, i + 1, doc, scale, isMobile, viewer);
    },
    getTextContent: async () => {
      const page = await djvuDoc.getPage(i + 1);
      const textContent = page.getText();
      return textContent || "";
    },
    size: 1000,
    getDimension: async () => {
      // Use pre-fetched pagesSizes if available (avoids decoding entire page)
      if (pagesSizes.length > i) {
        return {
          width: pagesSizes[i].width,
          height: pagesSizes[i].height,
          dpi: pagesSizes[i].dpi,
        };
      }
      // Fallback: decode page to get dimensions
      const page = await djvuDoc.getPage(i + 1);
      return {
        width: page.getWidth(),
        height: page.getHeight(),
        dpi: page.getDpi(),
      };
    },
    getPage: async () => {
      return wrapDjVuPage(await djvuDoc.getPage(i + 1));
    },
  }));
  book.isExternal = (uri: string) => /^\w+:/i.test(uri);
  book.resolveHref = async (href: string) => {
    // Use getPageNumberByUrl to resolve TOC bookmark URLs to page indices
    const pageNumber = djvuDoc.getPageNumberByUrl(href);
    if (pageNumber != null) {
      return { index: pageNumber - 1 }; // Convert 1-based to 0-based
    }
    return { index: 0 };
  };
  book.splitTOCHref = async (href: string) => {
    const pageNumber = djvuDoc.getPageNumberByUrl(href);
    if (pageNumber != null) {
      return [pageNumber - 1, null]; // Convert 1-based to 0-based
    }
    return [0, null];
  };
  book.getTOCFragment = (doc: Document) => doc.documentElement;
  book.getCover = async () => renderPage(djvuDoc, 1, true);
  book.destroy = () => {
    // Revoke all cached blob URLs
    cache.forEach((url: string) => {
      if (typeof url === "string" && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    });
    cache.clear();
  };
  return book;
};
