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
        "font-size:0.7em;opacity:0.6;" +
        "margin-left:2px;" +
        "}"
    );
    // Text rule styles — collapse original text to zero width, show replacement via ::after
    // (no extra text nodes, keeps rangy character offsets stable)
    const textRuleFontSize = ConfigService.getReaderConfig("fontSize") || 18;
    const textRuleLineHeight = ConfigService.getReaderConfig("lineHeight") || "1.25";
    const textRuleLetterSpacing = ConfigService.getReaderConfig("letterSpacing");
    cssRules.push(
      ".kookit-text-rule-replace{" +
        "font-size:0 !important;" +
        "line-height:0 !important;" +
        "letter-spacing:0 !important;" +
        "word-spacing:0 !important;" +
        "display:inline;" +
        "vertical-align:baseline;" +
        "}"
    );
    cssRules.push(
      ".kookit-text-rule-replace::after{" +
        "content:attr(data-kookit-replacement);" +
        `font-size:${textRuleFontSize}px !important;` +
        `line-height:${textRuleLineHeight} !important;` +
        (textRuleLetterSpacing
          ? `letter-spacing:${textRuleLetterSpacing}px !important;`
          : "") +
        "color:inherit;" +
        "}"
    );
    cssRules.push(".kookit-text-rule-delete{display:none;}");
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
      "body,html,svg{margin: 0px !important; padding: 0px !important; font-size: 18px; background-color: transparent !important;}"
    );

    // Force horizontal writing mode - only if vertical writing is not enabled
    if (ConfigService.getReaderConfig("textOrientation") !== "vertical") {
      cssRules.push("body,html{writing-mode: horizontal-tb !important;}");
    }

    // Content elements with custom styles
    cssRules.push(
      `a, article, cite, div, li, p, span:not(.kookit-note):not(.kookit-note-icon):not(.kookit-highlight-text):not(.kookit-note-tooltip):not(.kookit-word-def):not(.kookit-word-tooltip):not(.kookit-text-rule-replace):not(.kookit-text-rule-delete), pre, dt, dd, table, bold, font, blockquote{${this.getCustomCss(ConfigService)}}`
    );

    // Title elements with custom styles
    cssRules.push(
      `h1, h2, h3, h4, h5, h6, title{${this.getCustomCss(ConfigService, true)}}`
    );

    // Code formatting — allow wrapping and column fragmentation
    cssRules.push(
      "code,pre{" +
        "white-space:pre-wrap !important;" +
        "word-wrap:break-word;" +
        "word-break:break-word;" +
        "overflow-wrap:anywhere;" +
        "overflow:visible !important;" +
        "overflow-x:visible !important;" +
        "overflow-y:visible !important;" +
        "max-height:none !important;" +
        "break-inside:auto !important;" +
        "page-break-inside:auto !important;" +
        "-webkit-column-break-inside:auto !important;" +
        "}"
    );

    // // Blockquote styles
    // cssRules.push(
    //   "blockquote{border-left: 4px solid #ccc; padding-left: 1em; margin: 1em 0; color: #666;}"
    // );

    // Table styles — force tables to fit within the reader width
    cssRules.push(
      "table{width:100% !important;max-width:100% !important;table-layout:fixed !important;box-sizing:border-box;border-collapse:collapse;margin:20px 0;line-height:1.6;border:1px solid #ddd;}"
    );
    cssRules.push(
      "td,th{word-break:break-word;overflow-wrap:anywhere;max-width:0;min-width:0;overflow:hidden;box-sizing:border-box;}"
    );
    cssRules.push(
      "thead th{font-weight:bold;padding:14px 12px;text-align:left;white-space:normal;border-bottom:2px solid #ccc;background-color:rgba(0,0,0,0.05);}"
    );
    cssRules.push(
      "td,th{padding:12px 14px;vertical-align:top;text-align:left;border:2px solid #e0e0e0;}"
    );

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

    // Hide aside elements
    cssRules.push(
      `aside[epub\\:type="footnote"],aside[epub\\:type="note"],aside[epub\\:type="endnote"],aside[epub\\:type="rearnote"],.hide{position: absolute; left: -9999px; top: -9999px;}`
    );
    cssRules.push(
      `aside[type="sidebar"],aside[epub\\:type="sidebar"]{ margin: 1.5em 0; padding: 1.2em 1.4em; background-color: #c7eafc; break-inside: avoid; page-break-inside: avoid; }`
    );

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
    if (isTitle) {
      if (ConfigService.getReaderConfig("fontSize")) {
        const fontSize = Math.round(
          parseInt(ConfigService.getReaderConfig("fontSize") || "18") * 1.25
        );
        cssRules.push(`font-size: ${fontSize}px`);
      } else {
        cssRules.push(`font-size: 1.25em`);
      }
    }

    // Line height - has default value
    const lineHeight = ConfigService.getReaderConfig("lineHeight") || "1.25";
    cssRules.push(`line-height: ${lineHeight}`);

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
    cssRules.push(`padding-bottom: ${paraSpacing}px `);

    // Fixed styles that are always applied
    cssRules.push("word-wrap: break-word ");

    cssRules.push("max-width: 100%");
    cssRules.push("overflow: visible");

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
