import { EPUB } from "./epub";
import JSZip from "jszip";
import * as fflate from "fflate";

export const makeEpubZipLoader = async (file: File) => {
  let zip = await JSZip.loadAsync(file);
  const entries = zip.files;
  const loadText = async (name: string) => {
    let entry = zip.file(name);
    if (entry) {
      return entry.async("string");
    }
    return "";
  };
  const loadBlob = async (name: string) => {
    let entry = zip.file(name);
    if (entry) {
      let buffer = await entry.async("arraybuffer");
      return new Blob([buffer]);
    }
    return new Blob([new ArrayBuffer(0)]);
  };
  const getSize = (name: string) => {
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
};

export const makeEpubZipLoaderV2 = async (file: File) => {
  function partialUnzipWithFflate(buffer: ArrayBuffer) {
    const unzipper = new fflate.Unzip();
    const files: any = {};

    unzipper.onfile = (file) => {
      if (file.name.endsWith("/") || file.originalSize === 0) {
        return;
      }
      const chunks: any = [];
      file.ondata = (err, data, final) => {
        if (err) {
          console.warn(`Error in file "${file.name}": ${err.message}`);
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
          files[file.name] = content;
        }
      };

      try {
        file.start();
      } catch (error: any) {
        console.warn(`Error starting file "${file.name}": ${error.message}`);
      }
    };

    unzipper.register(fflate.UnzipInflate);

    try {
      unzipper.push(new Uint8Array(buffer), true);
    } catch (error: any) {
      console.warn(
        `Error during unzip: ${error.message}, returning partial results`
      );
    }

    return files;
  }

  let zip = partialUnzipWithFflate(await file.arrayBuffer());
  const entries = Object.keys(zip);
  const loadText = async (name: string) => {
    let entry = zip[name];
    if (entry) {
      let decoder = new TextDecoder("utf-8");
      return decoder.decode(entry);
    }
    return "";
  };
  const loadBlob = async (name: string) => {
    let entry = zip[name];
    if (entry) {
      return new Blob([entry]);
    }
    return new Blob([new ArrayBuffer(0)]);
  };
  const getSize = (name: string) => {
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
};

export const loadEpubBook = async (epubBuffer: ArrayBuffer) => {
  let blob = new Blob([epubBuffer]);
  let file = new File([blob], "book", {
    lastModified: new Date().getTime(),
    type: blob.type,
  });
  try {
    const loader: any = await makeEpubZipLoader(file);
    return await new EPUB(loader).init();
  } catch (error) {
    console.error(error);
    try {
      const loader: any = await makeEpubZipLoaderV2(file);
      return await new EPUB(loader).init();
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
};
