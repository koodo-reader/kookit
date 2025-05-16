import { cleanText, isTitle, txtToHtml } from "./textProcessor";
export const makeHtmlBook = (
  bookStr: string,
  isTxt = false,
  parserRegex = "",
  bookLocation?: any
) => {
  const bookDoc = new DOMParser().parseFromString(
    isTxt ? txtToHtml(bookStr, parserRegex, bookLocation) : bookStr,
    "text/html"
  );
  let chapterDomList = getTitleElement(bookDoc);
  if (chapterDomList.length === 0) {
    chapterDomList = getTitlefromText(bookDoc) as any;
  }
  for (let i = 0; i < chapterDomList.length; i++) {
    // this.chapterDomList[i].id = this.chapterList[i].id;
    var newItem = document.createElement("kookitmarker");
    var textnode = document.createTextNode(" ");
    newItem.appendChild(textnode);

    chapterDomList[i].parentNode &&
      chapterDomList[i].parentNode!.insertBefore(newItem, chapterDomList[i]);
  }
  const chapterList = getChapterDoc(bookDoc.body.innerHTML);
  const load = async (index: number) => {
    const page = URL.createObjectURL(
      new Blob([chapterList[index].text], { type: "text/html" })
    );
    return page;
  };
  const unload = (index: number) => {};
  const book: any = {};
  book.getCover = () => "";
  book.sections = chapterList.map((item) => ({
    id: item.index,
    load: () => load(item.index),
    unload: () => unload(item.index),
  }));
  book.toc = chapterList
    .map((item) => ({
      label: item.label,
      href: "title" + item.index,
    }))
    .filter((item) => item.label !== "");
  book.rendition = { layout: "pre-paginated" };
  book.resolveHref = (href: string) => {
    return { index: parseInt(href.substring(5, href.length)) };
  };
  book.splitTOCHref = (href) => [href, null];
  book.getTOCFragment = (doc) => doc.documentElement;
  return book;
};

const getTitleElement = (Element) => {
  return Array.from(
    Element.querySelectorAll("h1,h2,h3,h4,h5,h6,title")
  ) as HTMLElement[];
};

const getChapterDoc = (bookStr: string) => {
  let chapterDocList: {
    index: number;
    label: string;
    text: any;
    href: string;
  }[] = [];
  let chapterStrList: any = bookStr
    .split("<kookitmarker> </kookitmarker>")
    .filter((item) => item.trim() !== "");
  let titleList: string[] = chapterStrList.map((item) => {
    return getHFromStr(item) || getTitleFromStr(item);
  });

  chapterDocList = chapterStrList.map((item, index) => {
    return {
      index: index,
      label: titleList[index],
      text: item,
      href: "title" + index,
    };
  });
  return chapterDocList;
};

const getHFromStr = (str: string): string => {
  // Create temporary DOM element
  const tempDoc = new DOMParser().parseFromString(str, "text/html");

  // Find first heading tag
  const headingTag = tempDoc.querySelector("h1, h2, h3, h4, h5, h6");

  // Return content if found, otherwise empty string
  return headingTag ? headingTag.textContent?.trim() || "" : "";
};

const getTitleFromStr = (str) => {
  // Create temporary DOM element
  const tempDoc = new DOMParser().parseFromString(str, "text/html");

  // Find first heading tag
  const headingTag = tempDoc.querySelector("title");

  // Return content if found, otherwise empty string
  return headingTag ? headingTag.textContent?.trim() || "" : "";
};
const getTitlefromText = (bookDoc) => {
  let elements = bookDoc.getElementsByTagName("*");
  let titleElements = Array.from(elements).filter((item: any) => {
    return (
      item.childNodes.length === 1 &&
      item.childNodes[0].nodeType === Node.TEXT_NODE &&
      isTitle(cleanText(item.textContent))
    );
  });
  let h1TitleElements: any = [];
  for (let index = 0; index < titleElements.length; index++) {
    const oldElement: any = titleElements[index];
    const newElement = document.createElement("h1");
    newElement.innerHTML = oldElement.innerText;
    oldElement.parentNode.replaceChild(newElement, oldElement);
    h1TitleElements.push(newElement);
  }
  return h1TitleElements;
};
