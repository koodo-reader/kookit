import { isTitle } from "./titleUtil";
export const txtToHtml = (text: string) => {
  let html: string = "";
  let isStartWithKeyword = false;
  let lines = text.split("\n");
  for (let item of lines) {
    if (item.trim()) {
      if (isTitle(item.trim(), isStartWithKeyword)) {
        //只要出现以第，chapter，CHAPTER开头的章节，就不再检测不以这些字开头的段落
        if (
          item.trim().startsWith("第") ||
          item.trim().startsWith("Chapter") ||
          item.trim().startsWith("CHAPTER")
        ) {
          isStartWithKeyword = true;
        }

        html += `<h1>${item}</h1>`;
      } else {
        html += `<p>${item}</p>`;
      }
    }
  }

  return html;
};
