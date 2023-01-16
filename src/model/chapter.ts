class Chapter {
  title: string;
  href: string;
  index: number;
  subitems: any[];
  constructor(title: string, href: string, index: number, subitems: any[]) {
    this.title = title;
    this.href = href;
    this.index = index;
    this.subitems = subitems;
  }
}

export default Chapter;
