import GeneralParser from "./generalParser";
import ComicRender from "../renders/ComicRender";

const getChapterImageSrc = (doc: Document) => {
  const img = doc.querySelector("img");
  if (img) {
    return img.getAttribute("src") || "";
  }
  const image = doc.querySelector("image");
  if (image) {
    return (
      image.getAttributeNS("http://www.w3.org/1999/xlink", "href") ||
      image.getAttribute("href") ||
      image.getAttribute("xlink:href") ||
      ""
    );
  }
  return "";
};

const updateScrollPageHeight = (
  render: ComicRender,
  chapterDocIndex: number,
  img: HTMLImageElement
) => {
  if (render.readerMode !== "scroll") return;
  if (!img.naturalWidth || !img.naturalHeight) return;
  const doc = render.getDocument();
  const container = doc?.getElementById(
    "pdf-container-" + chapterDocIndex
  ) as HTMLElement | null;
  if (container) {
    container.style.paddingTop = `${
      (img.naturalHeight / img.naturalWidth) * 100
    }%`;
  }
  const iframe: any = render.getIframe();
  if (iframe && doc?.body) {
    iframe.height = doc.body.scrollHeight + 300 + "px";
  }
};

export const renderFixedLayoutChapter = async (
  render: ComicRender,
  chapterDocIndex: number
) => {
  if (
    chapterDocIndex >= render.chapterDocList.length ||
    chapterDocIndex < 0
  ) {
    return;
  }
  const chapterDoc = render.chapterDocList[chapterDocIndex];
  if (!chapterDoc?.text?.load) {
    return;
  }
  const iframe = render.getSubIframe(chapterDocIndex);
  const subDoc: any = iframe?.contentDocument;
  if (!iframe || !subDoc) return;
  if (iframe.dataset.rendered === "true") {
    return;
  }
  try {
    const chapterUrl = await chapterDoc.text.load();
    if (!chapterUrl) return;
    const chapterText = await (await fetch(chapterUrl)).text();
    if (!chapterText) return;
    const chapterDocument = new DOMParser().parseFromString(
      chapterText,
      "text/html"
    );
    const outerDoc = render.getDocument();
    if (outerDoc?.body) {
      outerDoc.body.style.margin = "0";
      outerDoc.body.style.padding = "0";
      outerDoc.documentElement.style.margin = "0";
    }
    subDoc.documentElement.setAttribute(
      "style",
      "width:100%;height:100%;margin:0;padding:0;overflow:hidden;"
    );
    subDoc.body.setAttribute(
      "style",
      "margin:0;padding:0;width:100%;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:transparent;"
    );
    const imageSrc = getChapterImageSrc(chapterDocument);
    if (imageSrc) {
      const img = subDoc.createElement("img");
      img.src = imageSrc;
      img.setAttribute(
        "style",
        "display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;"
      );
      img.addEventListener("load", () =>
        updateScrollPageHeight(render, chapterDocIndex, img)
      );
      subDoc.body.appendChild(img);
      if (img.complete) {
        updateScrollPageHeight(render, chapterDocIndex, img);
      }
    } else {
      subDoc.body.innerHTML = chapterDocument.body.innerHTML;
    }
    iframe.dataset.rendered = "true";
    render.trigger("rendered", [chapterDocIndex] as any);
  } catch (error) {
    console.error(error);
  }
};

export const unloadFixedLayoutChapter = async (
  render: ComicRender,
  chapterDocIndex: number
) => {
  if (
    chapterDocIndex >= render.chapterDocList.length ||
    chapterDocIndex < 0
  ) {
    return;
  }
  const doc = render.getDocument();
  const iframe: any = doc?.getElementById("pdf-iframe-" + chapterDocIndex);
  const subDoc = iframe?.contentDocument;
  if (subDoc && !subDoc.body?.innerHTML) {
    return;
  }
  delete iframe?.dataset?.rendered;
  await render.chapterDocList[chapterDocIndex]?.text?.unload?.();
  if (subDoc) {
    subDoc.body.innerHTML = "";
  }
};

export const measureFixedLayoutAspectRatio = async (render: ComicRender) => {
  const viewport = render.book?.rendition?.viewport;
  if (viewport?.width && viewport?.height) {
    return viewport.width / viewport.height;
  }
  const sampleCount = Math.min(3, render.chapterDocList.length);
  const ratios: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    try {
      const chapterDoc = render.chapterDocList[i];
      if (!chapterDoc?.text?.load) continue;
      const chapterUrl = await chapterDoc.text.load();
      if (!chapterUrl) continue;
      const chapterText = await (await fetch(chapterUrl)).text();
      const chapterDocument = new DOMParser().parseFromString(
        chapterText,
        "text/html"
      );
      const imageSrc = getChapterImageSrc(chapterDocument);
      if (!imageSrc) continue;
      const imageBlob = await (await fetch(imageSrc)).blob();
      const meta = await render.getImageMeta(imageBlob);
      if (meta.width && meta.height) {
        ratios.push(Math.round((meta.width / meta.height) * 1000) / 1000);
      }
    } catch (error) {
      console.error(error);
    }
  }
  if (ratios.length === 0) return 0.75;
  const frequency = new Map<number, number>();
  ratios.forEach((ratio) => {
    frequency.set(ratio, (frequency.get(ratio) || 0) + 1);
  });
  let maxRatio = ratios[0];
  let maxCount = 0;
  frequency.forEach((count, ratio) => {
    if (count > maxCount) {
      maxCount = count;
      maxRatio = ratio;
    }
  });
  return maxRatio;
};

export const getFixedLayoutMetadata = async (render: ComicRender) => {
  try {
    if (!render.book) {
      await render.parse();
    }
    const parser = new GeneralParser(render.book);
    return await parser.getMetadata();
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const removeFixedLayoutContent = (render: ComicRender) => {
  const book: any = render.book;
  if (typeof book?.destroy === "function") {
    book.destroy();
  } else {
    book?.sections?.forEach((section: any) => section?.unload?.());
  }
  render.book = "";
};
