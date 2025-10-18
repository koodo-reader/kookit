import { createIframe, handleLayout } from "../utils/layoutUtil";
import GeneralParser from "../utils/generalParser";
import { EPUB } from "../libs/epub";
import GeneralRender from "./GeneralRender";
import { getCache } from "../libs/cache.js";
import JSZip from "jszip";
import * as fflate from "fflate";
import * as zip from "@zip.js/zip.js";
class EpubRender extends GeneralRender {
  epubBuffer: ArrayBuffer;
  constructor(epubBuffer: ArrayBuffer, config: any) {
    super({ ...config, format: "EPUB" });
    this.epubBuffer = epubBuffer;
  }
  renderTo(element: HTMLElement) {
    return new Promise<void>(async (resolve, reject) => {
      this.element = element;
      if (!this.book) {
        await this.parse();
      }
      console.log(this.book);
      let parser = new GeneralParser(this.book);
      this.chapterList = await parser.getChapter(this.book.toc);
      this.chapterDocList = await parser.getChapterDoc();
      createIframe(element);
      let doc = this.getDocument();
      if (!doc) return;
      handleLayout(element, this.readerMode, doc);
      resolve();
    });
  }
  async parse() {
    let blob = new Blob([this.epubBuffer]);
    let file = new File([blob], "book", {
      lastModified: new Date().getTime(),
      type: blob.type,
    });
    try {
      const loader: any = await this.makeZipLoader(file);
      this.book = await new EPUB(loader).init();
    } catch (error) {
      console.error(error);
      try {
        const loader: any = await this.makeZipLoaderV3(file);
        this.book = await new EPUB(loader).init();
      } catch (error) {
        console.error(error);
        try {
          const loader: any = await this.makeZipLoaderV2(file);
          this.book = await new EPUB(loader).init();
        } catch (error) {
          console.error(error);
          throw error;
        }
      }
    }
  }
  async preCache() {
    try {
      if (!this.book) {
        await this.parse();
      }
      return await getCache(this.book);
    } catch (error) {
      return "";
    }
  }
  async makeZipLoader(file) {
    let zip = await JSZip.loadAsync(file);
    const entries = zip.files;
    const loadText = async (name) => {
      let entry = zip.file(name);
      if (entry) {
        return entry.async("string");
      }
      return "";
    };
    const loadBlob = async (name) => {
      let entry = zip.file(name);
      if (entry) {
        let buffer = await entry.async("arraybuffer");
        return new Blob([buffer]);
      }
      return new Blob([new ArrayBuffer(0)]);
    };
    const getSize = (name) => {
      let entry: any = zip.file(name);
      if (entry) {
        return entry._data.uncompressedSize || 0;
      }
    };
    return {
      entries: Object.values(entries).map((item) => {
        return { filename: item.name };
      }),
      loadText,
      loadBlob,
      getSize,
    };
  }
  async makeZipLoaderV2(file) {
    function partialUnzipWithFflate(buffer) {
      const unzipper = new fflate.Unzip();
      const files: any = {};

      unzipper.onfile = (file) => {
        if (file.name.endsWith("/") || file.originalSize === 0) {
          return; // 跳过目录或空文件
        }
        const chunks: any = [];
        file.ondata = (err, data, final) => {
          if (err) {
            console.warn(`Error in file "${file.name}": ${err.message}`); // 捕获错误，继续其他文件
            return;
          }
          chunks.push(data);
          if (final) {
            const content = new Uint8Array(
              chunks.reduce((acc, chunk) => acc + chunk.length, 0)
            );
            let offset = 0;
            chunks.forEach((chunk) => {
              content.set(chunk, offset);
              offset += chunk.length;
            });
            // files.push({ name: file.name, content });
            files[file.name] = content; // 存储文件内容
          }
        };

        // 为每个文件添加错误处理
        try {
          file.start(); // 只启动需要的文件
        } catch (error: any) {
          console.warn(`Error starting file "${file.name}": ${error.message}`);
        }
      };

      unzipper.register(fflate.UnzipInflate); // 支持 Deflate

      // 使用 try-catch 包装整个解压过程
      try {
        unzipper.push(new Uint8Array(buffer), true); // 输入缓冲区
      } catch (error: any) {
        console.warn(
          `Error during unzip: ${error.message}, returning partial results`
        );
      }

      return files;
    }

    // let zip = fflate.unzipSync(new Uint8Array(await file.arrayBuffer()), {
    //   filter: (file) => true,
    // });
    let zip = partialUnzipWithFflate(await file.arrayBuffer());
    const entries = Object.keys(zip);
    const loadText = async (name) => {
      let entry = zip[name];
      if (entry) {
        let decoder = new TextDecoder("utf-8");
        return decoder.decode(entry);
      }
      return "";
    };
    const loadBlob = async (name) => {
      let entry = zip[name];
      if (entry) {
        return new Blob([entry]);
      }
      return new Blob([new ArrayBuffer(0)]);
    };
    const getSize = (name) => {
      let entry: any = zip[name];
      if (entry) {
        return entry.length || 0;
      }
    };
    return {
      entries: entries.map((item) => {
        return { filename: item };
      }),
      loadText,
      loadBlob,
      getSize,
    };
  }
  async makeZipLoaderV3(file) {
    let zipReader = new zip.ZipReader(new zip.BlobReader(file));
    let entries: any = await zipReader.getEntries();
    const loadText = async (name) => {
      let entry = entries.find((item) => item.filename === name);
      if (entry) {
        return await entry.getData(new zip.TextWriter("utf-8"));
      }
      return "";
    };
    const loadBlob = async (name) => {
      let entry = entries.find((item) => item.filename === name);
      if (entry) {
        return await entry.getData(new zip.BlobWriter());
      }
      return new Blob([new ArrayBuffer(0)]);
    };
    const getSize = (name) => {
      let entry = entries.find((item) => item.filename === name);
      if (entry) {
        return entry.uncompressedSize || 0;
      }
    };
    return {
      entries: entries.map((item) => {
        return { filename: item.filename };
      }),
      loadText,
      loadBlob,
      getSize,
    };
  }
  async getMetadata() {
    try {
      if (!this.book) {
        await this.parse();
      }
      let parser = new GeneralParser(this.book);
      return await parser.getMetadata();
    } catch (error) {
      console.error(error, "error");
      throw error;
    }
  }
}
export default EpubRender;
