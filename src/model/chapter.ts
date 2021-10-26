class Chapter {
  label: string;
  id: string;
  href: string;
  subitems: any[];
  constructor(label: string, id: string, href: string, subitems: any[]) {
    this.label = label;
    this.id = id;
    this.href = href;
    this.subitems = subitems;
  }
}

export default Chapter;
