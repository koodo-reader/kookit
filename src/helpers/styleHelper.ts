declare var window: any;
class StyleHelper {
  // get default css for iframe
  static getDefaultCss(ConfigService: any, bookKey: string = "") {
    const cssRules: string[] = [];

    // Selection styles
    cssRules.push("::selection{background:#f3a6a68c}");
    cssRules.push("::-moz-selection{background:#f3a6a68c}");

    // Note hover effect
    cssRules.push(".kookit-note:hover{cursor:pointer;}");
    // Ensure inline highlight spans don't disrupt text flow
    cssRules.push(".kookit-note{line-height:inherit;}");
    // Word definition styles
    cssRules.push(
      ".kookit-word-def{" +
        "border-bottom:1px dashed currentColor;" +
        "cursor:pointer;line-height:inherit;" +
        "}"
    );
    cssRules.push(
      ".kookit-word-def::after{" +
        "content:'(' attr(data-meaning) ')';" +
        "font-size:0.82em;opacity:0.75;" +
        "margin-left:2px;" +
        "}"
    );
    cssRules.push(
      ".kookit-note-icon{line-height:1;font-size:14px;cursor:pointer;}"
    );
    // Use CSS ::before to render the icon so no text node is added to the DOM
    // (prevents interference with rangy character-offset calculations)
    cssRules.push(".kookit-note-icon::before{content:'📋';}");
    let fullTranslationMode = ConfigService.getAllListConfig(
      "fullTranslationBooks"
    ).includes(bookKey)
      ? ConfigService.getReaderConfig("fullTranslationMode") || ""
      : "";
    // Translation display styles
    cssRules.push(
      `.kookit-translation-host::after{content: attr(data-kookit-translation);display:block;${fullTranslationMode === "both" || fullTranslationMode === "target" ? this.getCustomCss(ConfigService) : "display:none;"}${fullTranslationMode === "target" ? "font-size: " + (ConfigService.getReaderConfig("fontSize") || 18) + "px !important; text-indent: 2rem !important;" : ""} }`
    );

    // Translation loading spinner (shown on body while batch translation is in progress)
    if (fullTranslationMode === "both" || fullTranslationMode === "target") {
      cssRules.push(
        `.kookit-translation-loading:after{content:"";display:block;width:16px;height:16px;margin:4px auto 0;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;opacity:0.4;animation:kookit-spin 0.8s linear infinite;}`
      );
      cssRules.push(
        `@keyframes kookit-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}`
      );
    }

    // Body and html base styles
    cssRules.push(
      "body,html{margin: 0px !important; padding: 0px !important; font-size: 18px; background-color: transparent !important;}"
    );

    // Force horizontal writing mode - only if vertical writing is not enabled
    if (ConfigService.getReaderConfig("textOrientation") !== "vertical") {
      cssRules.push("body,html{writing-mode: horizontal-tb !important;}");
    }

    // Content elements with custom styles
    cssRules.push(
      `a, article, cite, div, li, p, span:not(.kookit-note):not(.kookit-note-icon):not(.kookit-note-tooltip):not(.kookit-word-def):not(.kookit-word-tooltip), pre, dt, dd, table, bold, font, blockquote{${this.getCustomCss(ConfigService)}}`
    );

    // Title elements with custom styles
    cssRules.push(
      `h1, h2, h3, h4, h5, h6, title{${this.getCustomCss(ConfigService, true)}}`
    );

    // Hide aside elements
    cssRules.push("aside{position: absolute; left: -9999px}");

    // Code formatting
    cssRules.push("code,pre{white-space: pre-wrap;}");

    // Blockquote styles
    cssRules.push(
      "blockquote{border-left: 4px solid #ccc; padding-left: 1em; margin: 1em 0; color: #666;}"
    );

    // Paragraph margin reset
    cssRules.push("div,p{margin-block: 0;margin-inline: 0;display: block;}");

    // Ruby text font size
    cssRules.push("rt span{font-size: unset !important;}");

    // Conditional link styles
    if (ConfigService.getReaderConfig("isOverwriteLink") === "yes") {
      cssRules.push(
        "a{color: #0066cc !important; text-decoration: underline !important; cursor: pointer !important;}"
      );
      cssRules.push("a:hover{color: #004080 !important;}");
      cssRules.push("a:visited{color: #6600cc !important;}");
    }

    // Conditional h1 font size for merged words
    if (ConfigService.getReaderConfig("isMergeWord") === "yes") {
      const fontSize = ConfigService.getReaderConfig("fontSize") || 18;
      cssRules.push(`h1{font-size: ${fontSize}px !important;}`);
    }

    // Comic styles
    cssRules.push(this.getComicCss(ConfigService));

    return cssRules.join("");
  }
  //force horizontal writing mode
  static getCustomCss(ConfigService: any, isTitle: boolean = false) {
    let cssRules: string[] = [];

    // Font size - only for non-title elements and if fontSize exists
    if (!isTitle && ConfigService.getReaderConfig("fontSize")) {
      cssRules.push(
        `font-size: ${ConfigService.getReaderConfig("fontSize")}px !important`
      );
    }

    // Line height - has default value
    const lineHeight = ConfigService.getReaderConfig("lineHeight") || "1.25";
    cssRules.push(`line-height: ${lineHeight} !important`);

    // Font family - only if exists
    const fontFamily = ConfigService.getReaderConfig("fontFamily");
    const subFontFamily = ConfigService.getReaderConfig("subFontFamily");
    if (fontFamily || subFontFamily) {
      cssRules.push(
        `font-family: ${fontFamily ? fontFamily : ""} ${subFontFamily ? (fontFamily ? ", " : "") + subFontFamily : ""} !important`
      );
      const fontWeightMap: Record<string, string> = {
        extralight: "200",
        light: "300",
        normal: "400",
        regular: "400",
        medium: "500",
        bold: "700",
        heavy: "900",
      };
      const combinedFont =
        `${fontFamily || ""} ${subFontFamily || ""}`.toLowerCase();
      for (const [keyword, weight] of Object.entries(fontWeightMap)) {
        if (combinedFont.includes(keyword)) {
          cssRules.push(`font-weight: ${weight} !important`);
          break;
        }
      }
    }

    // Text color - complex logic with fallbacks
    const textColor = ConfigService.getReaderConfig("textColor");
    const backgroundColor = ConfigService.getReaderConfig("backgroundColor");
    const appSkin = ConfigService.getReaderConfig("appSkin");
    const isOSNight = ConfigService.getReaderConfig("isOSNight");
    const isOverwriteText = ConfigService.getReaderConfig("isOverwriteText");

    let colorValue = "";
    let colorImportant = "";

    if (textColor) {
      colorValue = textColor;
    } else if (
      backgroundColor === "rgba(44,47,49,1)" ||
      appSkin === "night" ||
      (appSkin === "system" && isOSNight === "yes")
    ) {
      colorValue = "white";
    }

    if (
      isOverwriteText === "yes" ||
      backgroundColor === "rgba(44,47,49,1)" ||
      appSkin === "night" ||
      (appSkin === "system" && isOSNight === "yes")
    ) {
      colorImportant = "!important";
    }

    if (colorValue) {
      cssRules.push(`color: ${colorValue} ${colorImportant}`.trim());
    }

    // Letter spacing - only if exists
    const letterSpacing = ConfigService.getReaderConfig("letterSpacing");
    if (letterSpacing) {
      cssRules.push(`letter-spacing: ${letterSpacing}px !important`);
    }

    // Text align - only if exists
    const textAlign = ConfigService.getReaderConfig("textAlign");
    if (textAlign) {
      cssRules.push(`text-align: ${textAlign} !important`);
    }

    // Font weight - only if bold is enabled
    if (ConfigService.getReaderConfig("isBold") === "yes") {
      cssRules.push("font-weight: bold !important");
    }

    // Force horizontal writing mode - only if vertical writing is not enabled
    if (ConfigService.getReaderConfig("textOrientation") !== "vertical") {
      cssRules.push("writing-mode: horizontal-tb !important");
    }

    // Font style - only if italic is enabled
    if (ConfigService.getReaderConfig("isItalic") === "yes") {
      cssRules.push("font-style: italic !important");
    }

    // Text shadow - only if shadow is enabled
    if (ConfigService.getReaderConfig("isShadow") === "yes") {
      cssRules.push("text-shadow: 2px 2px 2px #cccccc !important");
    }

    // Hyphenation - only if enabled
    if (ConfigService.getReaderConfig("isHyphenation") === "yes") {
      // !important 防止被书籍自身 CSS 覆盖；
      // hyphens: auto 在浏览器有词典时启用语言级连字，
      // 无词典时（Electron）仍会使用文本中的软连字符 \u00AD（CSS 规范保证）
      cssRules.push("hyphens: auto !important");
      cssRules.push("text-align: justify !important");
    }

    // Orphans and widows - only if enabled
    if (ConfigService.getReaderConfig("isOrphanWidow") === "yes") {
      cssRules.push("orphans: 1 !important");
      cssRules.push("widows: 1 !important");
    }

    if (window.textOrientation === "vertical") {
      cssRules.push("display: contents !important");
    }
    // Text indent - only if indent is enabled
    const isIndent = ConfigService.getReaderConfig("isIndent");
    if (isIndent === "yes") {
      if (!isTitle) {
        cssRules.push("text-indent: 2em !important");
      } else {
        cssRules.push("text-indent: 0em !important");
      }
    }

    // Text decoration - only if underline is enabled
    if (ConfigService.getReaderConfig("isUnderline") === "yes") {
      cssRules.push("text-decoration: underline !important");
    }

    // Padding bottom - has default value of 0
    const paraSpacing = ConfigService.getReaderConfig("paraSpacing") || 0;
    cssRules.push(`padding-bottom: ${paraSpacing}px !important`);

    // Fixed styles that are always applied
    cssRules.push("word-wrap: break-word !important");

    cssRules.push("max-width: 100% !important");
    cssRules.push("overflow: visible !important");
    cssRules.push("margin-top: 0 !important");
    cssRules.push("margin-bottom: 0 !important");

    return cssRules.join("; ") + ";";
  }

  static getComicCss(ConfigService: any) {
    const cssRules: string[] = [];

    // Full screen container styles
    cssRules.push(
      "div.fs{height:unset !important;width:100% !important;min-height:100% !important;position:relative;text-align:left;vertical-align:middle;}"
    );

    // Full screen inner div styles
    cssRules.push(
      "div.fs div{height:unset !important;min-height:100% !important;width:100% !important;margin:auto;text-align:center;vertical-align:middle;}"
    );

    // Div view container styles
    cssRules.push(
      ".div_view{height:unset !important;width:100% !important;min-height:100% !important;margin:auto;text-align:center;vertical-align:middle;}"
    );

    // Single page styles with conditional properties based on reader mode
    const readerMode = ConfigService.getReaderConfig("readerMode");
    const isScrollMode = readerMode === "scroll";

    let singlePageStyles = ".singlePage{";

    // Conditional max-width for scroll mode
    if (isScrollMode) {
      singlePageStyles += "max-width: 100% !important;";
    }

    // Conditional max-height for scroll mode
    if (isScrollMode) {
      singlePageStyles += "max-height: unset !important;";
    }

    // Height based on reader mode
    const height = isScrollMode ? "unset" : "100%";
    singlePageStyles += `height:${height}!important;`;

    // Fixed width and position
    singlePageStyles += "width:100%!important;position: unset !important;";

    singlePageStyles += "}";
    cssRules.push(singlePageStyles);

    return cssRules.join("");
  }
}
export default StyleHelper;
