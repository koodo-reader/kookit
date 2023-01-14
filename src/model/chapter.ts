class Chapter {
  label: string;
  id: string;
  href: string;
  index: number;
  subitems: any[];
  constructor(
    label: string,
    id: string,
    href: string,
    index: number,
    subitems: any[]
  ) {
    this.label = label;
    this.id = id;
    this.href = href;
    this.index = index;
    this.subitems = subitems;
  }
}

export default Chapter;
