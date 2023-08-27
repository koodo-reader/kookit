class ChapterDoc {
  label: string;
  text: any;
  href: string;
  constructor(label: string, href: string, text: string) {
    this.label = label;
    this.href = href;
    this.text = text;
  }
}

export default ChapterDoc;
