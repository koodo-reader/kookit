import GeneralParser from "../utils/generalParser";
import ComicRender from "./ComicRender";

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
    const res = await fetch(chapterUrl);
    const chapterText = await res.text();
    if (!chapterText) return;
    subDoc.open();
    subDoc.write(chapterText);
    subDoc.close();
    const style = subDoc.createElement("style");
    style.textContent = `html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;}img,svg{max-width:100%!important;max-height:100%!important;object-fit:contain;}img{display:block;margin:auto;}`;
    subDoc.head?.appendChild(style);
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
