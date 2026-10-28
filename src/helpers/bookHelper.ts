import Book from "../model/Book";
declare var window: any;

const copyArrayBuffer = (src) => {
  var dst = new ArrayBuffer(src.byteLength);
  new Uint8Array(dst).set(new Uint8Array(src));
  return dst;
};
const getMetadataText = (value: any): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(getMetadataText).filter(Boolean).join(",");
  }
  if (typeof value === "object" && typeof value.name === "string") {
    return value.name;
  }
  return "";
};
function throttle(fn: (...args: any[]) => void, wait: number) {
  let lastTime = 0;
  let timeout: any = null;
  let lastArgs: any[] | null = null;

  return function (this: any, ...args: any[]) {
    const now = Date.now();
    if (now - lastTime >= wait) {
      lastTime = now;
      fn.apply(this, args);
    } else {
      clearTimeout(timeout);
      lastArgs = args;
      timeout = setTimeout(
        () => {
          lastTime = Date.now();
          fn.apply(this, lastArgs ?? []);
        },
        wait - (now - lastTime)
      );
    }
  };
}
class BookHelper {
  static getRendition = (
    result: ArrayBuffer,
    config: {
      format: string;
      readerMode: string;
      charset: string;
      animation: string;
      convertChinese: string;
      parserRegex: string;
      isDarkMode: string;
      isMobile: string;
      password: string;
      isConvertPDF: string;
      backgroundColor: string;
      isScannedPDF: string;
      // tesseract / paddle / system-ocr / external-engine / official-ai-ocr / plugin-ocr
      // 所有引擎均要求通过 externalWorker 传入识别实现（recognize => Promise<string>）
      ocrEngine: string;
      revertDirection?: string;
      // 通用 OCR 传入 image URL 调用 recognize(imageURL)；
      // external-engine（移动端桥接）调用 recognize(chapterDocIndex, "")；
      // official-ai-ocr accurate 模式调用 recognize(File)
      externalWorker?: any;
      isFixedLayout?: string;
    },
    Kookit: any
  ) => {
    let rendition;
    let format = config.format.toUpperCase();
    const isFixedLayout = config.isFixedLayout === "yes";
    if (format === "CACHE") {
      rendition = new Kookit.CacheRender(result, config);
    } else if (format === "MOBI" || format === "AZW3" || format === "AZW") {
      rendition = isFixedLayout
        ? new Kookit.FixedLayoutRender(result, config)
        : new Kookit.MobiRender(result, config);
    } else if (format === "EPUB") {
      rendition = isFixedLayout
        ? new Kookit.FixedLayoutRender(result, config)
        : new Kookit.EpubRender(result, config);
    } else if (format === "TXT") {
      // let text = iconv.decode(Buffer.from(result), charset || "utf8");
      rendition = new Kookit.TxtRender(result, config);
    } else if (format === "MD") {
      rendition = new Kookit.MdRender(result, config);
    } else if (format === "PDF") {
      if (config.isConvertPDF === "yes") {
        if (
          config.isScannedPDF === "yes" &&
          config.ocrEngine === "external-engine"
        ) {
          config.externalWorker = { recognize: this.getPDFOcrResult };
        }
        rendition = new Kookit.PdfTextRender(result, config);
      } else {
        rendition = new Kookit.PdfRender(result, config);
      }
    } else if (format === "FB2") {
      rendition = new Kookit.Fb2Render(result, config);
    } else if (format === "CHM") {
      rendition = new Kookit.ChmRender(result, config);
    } else if (format === "DOCX") {
      rendition = new Kookit.DocxRender(result, config);
    } else if (format === "DOC") {
      rendition = new Kookit.DocRender(result, config);
    } else if (format === "RTF") {
      rendition = new Kookit.RtfRender(result, config);
    } else if (
      format === "HTML" ||
      format === "XHTML" ||
      format === "MHTML" ||
      format === "HTM" ||
      format === "XML"
    ) {
      rendition = new Kookit.HtmlRender(result, config);
    } else if (
      format === "CBR" ||
      format === "CBT" ||
      format === "CBZ" ||
      format === "CB7"
    ) {
      rendition = new Kookit.ComicRender(copyArrayBuffer(result), config);
    } else if (format === "PPTX" || format === "PPT") {
      // PPTX/PPT 逐页渲染为 SVG，沿用漫画的多 iframe 分页结构
      rendition = new Kookit.PptxRender(copyArrayBuffer(result), config);
    } else if (format === "XPS" || format === "OXPS") {
      // XPS/OXPS 为固定版式文档，逐页渲染为 SVG，沿用漫画的多 iframe 分页结构
      rendition = new Kookit.XpsRender(copyArrayBuffer(result), config);
    } else if (format === "DJVU" || format === "DJV") {
      // DjVu 为固定版式文档（MRC 位图），逐页解码合成为 canvas，沿用漫画的多 iframe 分页结构
      rendition = new Kookit.DjvuRender(copyArrayBuffer(result), config);
    } else if (format === "OFD") {
      // OFD 为固定版式文档，逐页由 liteofd 渲染为 canvas，沿用漫画的多 iframe 分页结构
      rendition = new Kookit.OfdRender(copyArrayBuffer(result), config);
    }
    return rendition;
  };
  static generateBook(
    bookName: string,
    extension: string,
    md5: string,
    size: number,
    path: string,
    file_content: ArrayBuffer,
    rendition: any
  ) {
    return new Promise<Book>(async (resolve, reject) => {
      try {
        let cover: any = "";
        let key: string,
          name: string,
          author: string,
          publisher: string,
          description: string,
          charset: string,
          page: number;
        [name, author, description, publisher, charset, page] = [
          bookName,
          "",
          "",
          "",
          "",
          0,
        ];
        let metadata: any = {};

        switch (extension) {
          case "pdf":
          case "epub":
          case "mobi":
          case "azw":
          case "azw3":
          case "fb2":
          case "chm":
            metadata = await rendition.getMetadata();
            [name, author, description, publisher, cover] = [
              metadata.name || bookName,
              metadata.author || "",
              metadata.description || "",
              metadata.publisher || "",
              metadata.cover || "",
            ];
            break;
          case "cbr":
          case "cbt":
          case "cbz":
          case "cb7":
          case "pptx":
          case "ppt":
          case "xps":
          case "oxps":
          case "djvu":
          case "djv":
          case "ofd":
            metadata = await rendition.getMetadata();
            cover = metadata.cover;
            break;
          case "txt":
            metadata = await rendition.getMetadata(file_content);
            charset = metadata.charset;
            break;
          default:
            break;
        }
        let format = extension.toUpperCase();
        key = new Date().getTime() + "";
        resolve(
          new Book(
            key,
            name,
            author,
            description,
            md5,
            cover,
            format,
            publisher,
            size,
            page,
            path,
            charset,
            getMetadataText(metadata.published),
            getMetadataText(metadata.modified),
            getMetadataText(metadata.identifier),
            getMetadataText(metadata.language),
            getMetadataText(metadata.subject),
            getMetadataText(metadata.rights),
            getMetadataText(metadata.isbn),
            getMetadataText(metadata.layout)
          )
        );
      } catch (error) {
        console.error(error);
        reject(error);
      }
    });
  }
  static initMobileBook = async (
    bookUrl: string,
    config: {
      format: string;
      readerMode: string;
      charset: string;
      animation: string;
      convertChinese: string;
      parserRegex: string;
      bookLocation: any;
      isDarkMode: string;
      password: string;
      isConvertPDF: string;
      platform?: string;
      backgroundColor: string;
      isScannedPDF: string;
      ocrEngine: string;
    }
  ) => {
    try {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          event: "user-agent",
          userAgent: navigator.userAgent,
        })
      );
      if (
        config.isConvertPDF === "yes" &&
        config.isScannedPDF === "yes" &&
        config.format.toUpperCase() === "PDF" &&
        config.ocrEngine === "external-engine"
      ) {
        window.file_content = new ArrayBuffer(0);
      } else {
        //get arraybuffer from url
        // Using fetch instead of axios
        const response = await fetch(bookUrl);

        if (!response.ok) {
          throw new Error(
            `Failed to download book: ${response.status} ${response.statusText}`
          );
        }
        // Get the array buffer from the response
        const file_content = await response.arrayBuffer();
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            event: "finish-download",
          })
        );

        window.file_content = file_content;
      }
      let rendition = this.getRendition(
        window.file_content,
        { ...config, isMobile: "yes" },
        window.Kookit
      );
      window.rendition = rendition;
      let element = document.getElementById("page-area");
      if (config.format && config.format.toUpperCase() === "TXT") {
        await window.rendition.renderTo(element, config.bookLocation);
      } else {
        await window.rendition.renderTo(element);
      }

      window.rendition.on("rendered", async (chapterDocIndex: number) => {
        let position = { ...window.rendition.getPosition() };
        let progress = { ...(await window.rendition.getProgress()) };
        if (config.format === "PDF" && chapterDocIndex) {
          position.chapterDocIndex = chapterDocIndex + "";
        }
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            event: "content-loaded",
            bookLocation: position,
            progress,
          })
        );
      });
      const throttledPageChanged = throttle(async () => {
        let position = { ...window.rendition.getPosition() };
        let progress = { ...(await window.rendition.getProgress()) };
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            event: "page-changed",
            bookLocation: position,
            progress,
          })
        );
      }, 3000);

      window.rendition.on("page-changed", () => {
        throttledPageChanged();
      });
      window.rendition.on("chapter-pages", () => {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            event: "chapter-pages",
            pages: window.rendition.getPages(),
          })
        );
      });
      window.rendition.on("scroll-text", async () => {
        setTimeout(async () => {
          let position = { ...window.rendition.getPosition() };
          let progress = { ...(await window.rendition.getProgress()) };
          window.ReactNativeWebView.postMessage(
            JSON.stringify({
              event: "scroll-text",
              bookLocation: position,
              progress,
            })
          );
        }, 1000);
      });
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          event: "book-inited",
          chapterList: window.rendition.getChapter(),
        })
      );
    } catch (error) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          event: "error",
          message: "Parse book failed",
          error: String(error) ? String(error) : "Unknown error",
        })
      );
    }
  };
  static addMobileBook = async (
    bookUrl: string,
    bookName: string,
    extension: string,
    md5: string,
    size: number,
    path: string,
    parserRegex: string = ""
  ) => {
    try {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          event: "user-agent",
          userAgent: navigator.userAgent,
        })
      );
      //get arraybuffer from url
      // Using fetch instead of axios
      const response = await fetch(bookUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to download book: ${response.status} ${response.statusText}`
        );
      }

      // Get the array buffer from the response
      const file_content = await response.arrayBuffer();

      // Report download completion
      window.ReactNativeWebView?.postMessage(
        JSON.stringify({ event: "finish-download" })
      );

      window.file_content = file_content;
      let rendition = this.getRendition(
        file_content,
        {
          format: extension.toUpperCase(),
          readerMode: "",
          charset: "",
          animation: "",
          convertChinese: "no",
          parserRegex: parserRegex || "",
          isDarkMode: "no",
          isMobile: "yes",
          password: "",
          isConvertPDF: "no",
          backgroundColor: "",
          isScannedPDF: "",
          ocrEngine: "",
        },
        window.Kookit
      );
      window.rendition = rendition;
      //remove book extension
      bookName = bookName.replace(/\.[^/.]+$/, "");
      let bookInfo = await BookHelper.generateBook(
        bookName,
        extension,
        md5,
        size,
        path,
        file_content,
        rendition
      );
      if (!bookInfo || !bookInfo.key) {
        return;
      }
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ event: "metadata", bookInfo: bookInfo })
      );
    } catch (error: any) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          event: "error",
          message: "Parse book failed",
          error: String(error) ? String(error) : "Unknown error",
        })
      );
    }
  };
  static precacheMobileBook = async (serverUrl: string, bookKey: string) => {
    let cache = await window.rendition.preCache(window.file_content);
    if (cache === "") {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          event: "cache",
          cacheBase64: "",
          key: bookKey,
        })
      );
    } else if (cache !== "err") {
      try {
        const fileName = "cache-" + bookKey + ".zip";
        const uploadUrl = `${serverUrl}/dav/${fileName}`;
        const putResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/octet-stream",
            Overwrite: "T",
          },
          body: cache,
        });
        if (putResponse.ok) {
          console.info("文件上传成功");
        } else {
          throw new Error(`上传失败: ${putResponse.status}`);
        }
      } catch (error) {
        console.error("操作失败:" + error);
      }
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          event: "cache",
          key: bookKey,
        })
      );
    } else {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          event: "error",
          message: "Parse book failed",
        })
      );
    }
    window.file_content = null;
    window.rendition = null;
  };
  static getPDFOcrResult = (chapterDocIndex: number, imageUrl: string) => {
    return new Promise<string>((resolve, reject) => {
      try {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            event: "get-ocr-result",
            index: chapterDocIndex,
            imageUrl: imageUrl,
          })
        );
        document.addEventListener(
          "message",
          function handleOcrResult(event: any) {
            try {
              const data = JSON.parse(event.data);
              if (
                data.event === "ocr-result" &&
                data.index === chapterDocIndex
              ) {
                document.removeEventListener("message", handleOcrResult);
                const ocrResult = data.text || "";
                resolve(ocrResult);
              }
            } catch (error) {
              document.removeEventListener("message", handleOcrResult);
              reject(error);
            }
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  };
}
export default BookHelper;
