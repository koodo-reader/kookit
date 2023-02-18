import { isTitle } from "./titleUtil";
declare var window: any;
window.a = window.atob;

(String.prototype as any).slim = function () {
  return this.split("")
    .filter(
      (item: string) =>
        item !== "=" && item !== "-" && item !== "_" && item !== "+"
    )
    .join("");
};
export const txtToHtml = (text: string) => {
  let html: string = "";
  let isStartWithKeyword = false;
  let lines = text.split("\n");
  for (let item of lines) {
    if ((item.trim() as any).slim()) {
      if (isTitle((item.trim() as any).slim(), isStartWithKeyword)) {
        //只要出现以第，chapter，CHAPTER开头的章节，就不再检测不以这些字开头的段落
        if (
          (item.trim() as any).slim().startsWith("第") ||
          (item.trim() as any).slim().startsWith("Chapter") ||
          (item.trim() as any).slim().startsWith("CHAPTER")
        ) {
          isStartWithKeyword = true;
        }

        html += `<h1>${item}</h1>`;
      } else {
        html += `<p>${item}</p>`;
      }
    }
  }
  if (html) {
    return html;
  } else {
    return `<h1>Title</h1><p>${text}</p>`;
  }
};
