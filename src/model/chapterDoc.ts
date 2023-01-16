class ChapterDoc {
  title: string;
  text: string;
  href: string;
  constructor(title: string, href: string, text: string) {
    this.title = title;
    this.href = href;
    this.text = text;
  }
}

export default ChapterDoc;
