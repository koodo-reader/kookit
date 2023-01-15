class Chapter {
  title: string;
  id: string;
  href: string;
  index: number;
  subitems: any[];
  constructor(
    title: string,
    id: string,
    href: string,
    index: number,
    subitems: any[]
  ) {
    this.title = title;
    this.id = id;
    this.href = href;
    this.index = index;
    this.subitems = subitems;
  }
}

export default Chapter;
