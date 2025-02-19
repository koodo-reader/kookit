function createBookElement(sectionCount) {
  let tempDiv = document.getElementById("book");
  if (tempDiv) {
    tempDiv.remove();
  }
  // Create the book div

  const bookDiv = document.createElement("div");
  bookDiv.id = "book";

  // Create the canvas element
  const canvas = document.createElement("canvas");
  canvas.id = "pageflip-canvas";

  // Create the pages div
  const pagesDiv = document.createElement("div");
  pagesDiv.id = "pages";

  // Create the section elements based on sectionCount
  for (let i = 0; i < sectionCount; i++) {
    const section = document.createElement("section");
    pagesDiv.appendChild(section);
  }

  // Append the canvas and pages div to the book div
  bookDiv.appendChild(canvas);
  bookDiv.appendChild(pagesDiv);

  // Append the book div to the body
  document.body.appendChild(bookDiv);
  let css = `
      #book {
        position: fixed;
        width: 200vw;
        height: 100vh;
        left: -100vw;
        top: 0vh;
        float: left;
        margin: 0;
        display: none;
      }

      #pages section {
        display: block;
        width: 100vw;
        height: 100vh;
        position: absolute;
        left: 100vw;
        top: 0px;
        overflow: hidden;
        margin: 0;
      }

      #pageflip-canvas {
        position: absolute;
        z-index: 100;
        margin: 0;
      }
    `;
  let style = document.createElement("style");
  style.innerHTML = css;
  document.head.appendChild(style);
}
export const addPageAnimation = (totalPage: number) => {
  // Example usage: create a book element with 3 sections
  createBookElement(totalPage);
  var WINDOW_WIDTH = window.innerWidth;
  var WINDOW_HEIGHT = window.innerHeight;

  // The canvas size equals to the book dimensions + this padding
  var CANVAS_PADDING = 0;

  // Dimensions of the whole book
  var BOOK_WIDTH = 2 * WINDOW_WIDTH - CANVAS_PADDING;
  var BOOK_HEIGHT = WINDOW_HEIGHT - CANVAS_PADDING;

  // Dimensions of one page in the book
  var PAGE_WIDTH = WINDOW_WIDTH;
  var PAGE_HEIGHT = WINDOW_HEIGHT;

  // Vertical spacing between the top edge of the book and the papers
  var PAGE_Y = (BOOK_HEIGHT - PAGE_HEIGHT) / 2;

  var page = 0;

  var canvas: any = document.getElementById("pageflip-canvas");
  if (!canvas) return;
  var context = canvas.getContext("2d");

  var mouse = { x: 0, y: 0 };

  var flips: any = [];

  var book = document.getElementById("book");
  if (!book) return;

  // List of all the page elements in the DOM
  var pages = book.getElementsByTagName("section");

  // Organize the depth of our pages and create the flip definitions
  for (var i = 0, len = pages.length; i < len; i++) {
    pages[i].style.zIndex = len - i + "";

    flips.push({
      // Current progress of the flip (left -1 to right +1)
      progress: 1,
      // The target value towards which progress is always moving
      target: 1,
      // The page DOM element related to this flip
      page: pages[i],
      // True while the page is being dragged
      dragging: false,
    });
  }

  // Resize the canvas to match the book size
  canvas.width = BOOK_WIDTH + CANVAS_PADDING * 2;
  canvas.height = BOOK_HEIGHT + CANVAS_PADDING * 2;

  // Offset the canvas so that it's padding is evenly spread around the book
  canvas.style.top = -CANVAS_PADDING + "px";
  canvas.style.left = -CANVAS_PADDING + "px";

  // Render the page flip 60 times a second
  setInterval(render, 1800 / 60);

  document.addEventListener("mousemove", mouseMoveHandler, false);
  document.addEventListener("mousedown", mouseDownHandler, false);
  document.addEventListener("mouseup", mouseUpHandler, false);

  function mouseMoveHandler(event) {
    if (!book) return;
    // Offset mouse position so that the top of the spine is 0,0
    mouse.x = event.clientX - book.offsetLeft - BOOK_WIDTH / 2;
    mouse.y = event.clientY - book.offsetTop;
  }

  function mouseDownHandler(event) {
    if (Math.abs(mouse.x) < PAGE_WIDTH) {
      if (mouse.x < 0 && page - 1 >= 0) {
        flips[page - 1].dragging = true;
      } else if (mouse.x > 0 && page + 1 < flips.length) {
        flips[page].dragging = true;
      }
    }

    // Prevents the text selection cursor from appearing when dragging
    event.preventDefault();
  }

  function mouseUpHandler(event) {
    for (var i = 0; i < flips.length; i++) {
      // If this flip was being dragged we animate to its destination
      if (flips[i].dragging) {
        // Figure out which page we should go to next depending on the flip direction
        if (mouse.x < 0) {
          flips[i].target = -1;
          page = Math.min(page + 1, flips.length);
        } else {
          flips[i].target = 1;
          page = Math.max(page - 1, 0);
        }
      }

      flips[i].dragging = false;
    }
  }

  function render() {
    context.clearRect(0, 0, canvas.width, canvas.height);

    for (var i = 0; i < flips.length; i++) {
      var flip = flips[i];

      if (flip.dragging) {
        flip.target = Math.max(Math.min(mouse.x / PAGE_WIDTH, 1), -1);
      }

      flip.progress += (flip.target - flip.progress) * 0.2;

      // If the flip is being dragged or is somewhere in the middle of the book, render it
      if (flip.dragging || Math.abs(flip.progress) < 0.997) {
        drawFlip(flip);
      }
    }
  }

  function drawFlip(flip) {
    // Strength of the fold is strongest in the middle of the book
    var strength = 1 - Math.abs(flip.progress);

    // Width of the folded paper
    var foldWidth = PAGE_WIDTH * 0.5 * (1 - flip.progress);

    // X position of the folded paper
    var foldX = PAGE_WIDTH * flip.progress + foldWidth;

    // How far the page should outdent vertically due to perspective
    var verticalOutdent = 20 * strength;

    // The maximum width of the left and right side shadows
    var paperShadowWidth =
      PAGE_WIDTH * 0.5 * Math.max(Math.min(1 - flip.progress, 0.5), 0);
    var rightShadowWidth =
      PAGE_WIDTH * 0.5 * Math.max(Math.min(strength, 0.5), 0);
    var leftShadowWidth =
      PAGE_WIDTH * 0.5 * Math.max(Math.min(strength, 0.5), 0);

    // Change page element width to match the x position of the fold
    flip.page.style.width = Math.max(foldX, 0) + "px";

    context.save();
    context.translate(CANVAS_PADDING + BOOK_WIDTH / 2, PAGE_Y + CANVAS_PADDING);

    // Draw a sharp shadow on the left side of the page
    context.strokeStyle = "rgba(0,0,0," + 0.05 * strength + ")";
    context.lineWidth = 30 * strength;
    context.beginPath();
    context.moveTo(foldX - foldWidth, -verticalOutdent * 0.5);
    context.lineTo(foldX - foldWidth, PAGE_HEIGHT + verticalOutdent * 0.5);
    context.stroke();

    // Right side drop shadow
    var rightShadowGradient = context.createLinearGradient(
      foldX,
      0,
      foldX + rightShadowWidth,
      0
    );
    rightShadowGradient.addColorStop(0, "rgba(0,0,0," + strength * 0.2 + ")");
    rightShadowGradient.addColorStop(0.8, "rgba(0,0,0,0.0)");

    context.fillStyle = rightShadowGradient;
    context.beginPath();
    context.moveTo(foldX, 0);
    context.lineTo(foldX + rightShadowWidth, 0);
    context.lineTo(foldX + rightShadowWidth, PAGE_HEIGHT);
    context.lineTo(foldX, PAGE_HEIGHT);
    context.fill();

    // Left side drop shadow
    var leftShadowGradient = context.createLinearGradient(
      foldX - foldWidth - leftShadowWidth,
      0,
      foldX - foldWidth,
      0
    );
    leftShadowGradient.addColorStop(0, "rgba(0,0,0,0.0)");
    leftShadowGradient.addColorStop(1, "rgba(0,0,0," + strength * 0.15 + ")");

    context.fillStyle = leftShadowGradient;
    context.beginPath();
    context.moveTo(foldX - foldWidth - leftShadowWidth, 0);
    context.lineTo(foldX - foldWidth, 0);
    context.lineTo(foldX - foldWidth, PAGE_HEIGHT);
    context.lineTo(foldX - foldWidth - leftShadowWidth, PAGE_HEIGHT);
    context.fill();

    // Gradient applied to the folded paper (highlights & shadows)
    var foldGradient = context.createLinearGradient(
      foldX - paperShadowWidth,
      0,
      foldX,
      0
    );
    foldGradient.addColorStop(0.35, "#fafafa");
    foldGradient.addColorStop(0.73, "#eeeeee");
    foldGradient.addColorStop(0.9, "#fafafa");
    foldGradient.addColorStop(1.0, "#e2e2e2");

    context.fillStyle = foldGradient;
    context.strokeStyle = "rgba(0,0,0,0.06)";
    context.lineWidth = 0.5;

    // Draw the folded piece of paper
    context.beginPath();
    context.moveTo(foldX, 0);
    context.lineTo(foldX, PAGE_HEIGHT);
    context.quadraticCurveTo(
      foldX,
      PAGE_HEIGHT + verticalOutdent * 2,
      foldX - foldWidth,
      PAGE_HEIGHT + verticalOutdent
    );
    context.lineTo(foldX - foldWidth, -verticalOutdent);
    context.quadraticCurveTo(foldX, -verticalOutdent * 2, foldX, 0);

    context.fill();
    context.stroke();

    context.restore();
  }
  return {
    flipToNextPage: () => {
      console.log("flipToNextPage");
      if (page + 1 < flips.length) {
        flips[page].target = -1;
        page = Math.min(page + 1, flips.length);
      }
    },
    flipToPrevPage: () => {
      console.log("flipToPrevPage");
      if (page - 1 >= 0) {
        flips[page - 1].target = 1;
        page = Math.max(page - 1, 0);
      }
    },
  };
  // window.flipToNextPage = () => {
  //   if (page + 1 < flips.length) {
  //     flips[page].target = -1;
  //     page = Math.min(page + 1, flips.length);
  //   }
  // };
  // window.flipToPreviousPage = () => {
  //   if (page - 1 >= 0) {
  //     flips[page - 1].target = 1;
  //     page = Math.max(page - 1, 0);
  //   }
  // };
};
