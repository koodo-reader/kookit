class Chapter {
  label: string;
  href: string;
  index: number;
  subitems: any[];
  constructor(label: string, href: string, index: number, subitems: any[]) {
    this.label = label;
    this.href = href;
    this.index = index;
    this.subitems = subitems;
  }
}

export default Chapter;
