import rangy from "rangy/lib/rangy-core.js";

declare var window: any;
export const addAndroidTouchEvent = (
  doc: Document,
  iframe: any,
  element: HTMLElement,
  readerMode: string,
  animation: string,
  format: string,
  render: any
) => {
  let iWin: any = iframe.contentWindow || iframe.contentDocument?.defaultView;
  let touchStartTime = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let lastTouchEnd = 0;
  const swipeThreshold = 30; // Minimum distance in pixels to be considered a swipe
  const timeThreshold = 500; // Maximum time in milliseconds to be considered a tap
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  let onTouchEnd = function (event) {
    console.info("touchend");

    let now = new Date().getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
      return;
    }
    lastTouchEnd = now;
    const touch = event.changedTouches[0];
    const touchEndTime = Date.now();
    let touchEndX = touch.screenX;
    let touchEndY = touch.screenY;

    const timeDiff = touchEndTime - touchStartTime;
    const distX = touchEndX - touchStartX;
    const distY = touchEndY - touchStartY;
    if (isDragging && animation === "mimical" && readerMode !== "scroll") {
      isDragging = false;
      render.mouseUpHandler(event);
      if (
        touch.screenX < (window.screen.width / 4) * 3 &&
        touchEndX - touchStartX < 0
      ) {
        render.next();
      } else if (
        touch.screenX > (window.screen.width / 4) * 1 &&
        touchEndX - touchStartX > 0
      ) {
        render.prev();
      }
      setTimeout(() => {
        let bookDiv = document.getElementById("book");
        if (bookDiv) {
          bookDiv.style.display = "none";
        }
      }, 400);

      return;
    }
    // Replace the scrollTo implementation with this optimized version

    if (isDragging && animation === "sliding") {
      // Clean up any existing animation
      if (window.scrollAnimationId) {
        cancelAnimationFrame(window.scrollAnimationId);
      }
      if (
        Math.abs(
          doc.body.scrollWidth - doc.body.scrollLeft - element.clientWidth
        ) < 10
      ) {
        if (selectionTimeout) {
          clearTimeout(selectionTimeout);
        }
        selectionTimeout = setTimeout(() => {
          render.next();
        }, 300); // Debounce selection events
        return;
      }
      if (doc.body.scrollLeft === 0) {
        if (selectionTimeout) {
          clearTimeout(selectionTimeout);
        }
        selectionTimeout = setTimeout(() => {
          render.prev();
        }, 300); // Debounce selection events
        return;
      }
      doc.body.style.transform = "";
      let pageWidth = element.clientWidth + gap;
      let scrollLeft = doc.body.scrollLeft;

      // Improved snapping logic
      let snapX;
      const currentPage = Math.round(scrollLeft / pageWidth);
      const dragPercentage = Math.abs(distX) / window.screen.width;
      const dragThreshold = 0.1; // Only 10% drag needed to change page

      if (distX > 0 && dragPercentage > dragThreshold) {
        // Dragged right (go to previous page)
        snapX = (currentPage - 1) * pageWidth;
      } else if (distX < 0 && dragPercentage > dragThreshold) {
        // Dragged left (go to next page)
        snapX = (currentPage + 1) * pageWidth;
      } else {
        // Stay on current page
        snapX = currentPage * pageWidth;
      }

      // Ensure we don't go out of bounds
      snapX = Math.max(0, Math.min(snapX, doc.body.scrollWidth - pageWidth));
      if (doc.body.scrollWidth - snapX < pageWidth + gap) {
        snapX = doc.body.scrollWidth;
      }

      // Use custom smooth scrolling with requestAnimationFrame instead of browser's scrollTo
      const startTime = performance.now();
      const startLeft = doc.body.scrollLeft;
      const distance = snapX - startLeft;
      const duration = 300; // milliseconds

      // Apply hardware acceleration before animation starts
      doc.body.style.willChange = "scroll-position";

      // Custom easing function for natural movement
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

      function animateScroll(currentTime) {
        const elapsedTime = currentTime - startTime;

        if (elapsedTime >= duration) {
          // Animation complete - set final position
          doc.body.scrollLeft = snapX;

          // Clean up acceleration hints
          doc.body.style.willChange = "auto";

          render.record();
          isDragging = false;
          return;
        }

        // Calculate new position using easing
        const progress = easeOutCubic(elapsedTime / duration);
        const newLeft = startLeft + distance * progress;
        // Update scroll position
        doc.body.scrollLeft = newLeft;

        // Continue animation
        window.scrollAnimationId = requestAnimationFrame(animateScroll);
      }

      // Start animation
      window.scrollAnimationId = requestAnimationFrame(animateScroll);

      return;
    }

    var selectedText = iWin.getSelection().toString();
    if (selectedText) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          event: "select-text-after-touch",
          selectedText: selectedText,
        })
      );
      return;
    }
    if (
      timeDiff < timeThreshold &&
      Math.abs(distX) < swipeThreshold &&
      Math.abs(distY) < swipeThreshold
    ) {
      var width = window.screen.width;
      var height = window.screen.height;

      var cellWidth = width / 3;
      var cellHeight = height / 3;
      var col = Math.floor(touchEndX / cellWidth);
      var row = Math.floor(touchEndY / cellHeight);
      var result = "";

      if (
        (row === 0 && (col === 0 || col === 1)) || // Top-left and Top-middle
        (row === 1 && col === 0) || // Middle-left
        (row === 2 && col === 0) || // Bottom-left
        (row === 0 && col === 1) // Middle-top
      ) {
        result = "left";
      } else if (row === 1 && col === 1) {
        result = "center";
      } else if (
        (row === 0 && col === 2) || // Top-right
        (row === 1 && col === 2) || // Middle-right
        (row === 2 && col === 2) || // Bottom-right
        (row === 2 && col === 1) // Middle-bottom
      ) {
        result = "right";
      }
      // if (
      //   col === 0 // Left column (left third of screen)
      // ) {
      //   result = "left";
      // } else if (col === 1) {
      //   // Middle column (middle third of screen)
      //   result = "center";
      // } else if (col === 2) {
      //   // Right column (right third of screen)
      //   result = "right";
      // }
      window.ReactNativeWebView.postMessage(JSON.stringify({ event: result }));
    } else if (
      Math.abs(distX) >= swipeThreshold ||
      Math.abs(distY) >= swipeThreshold
    ) {
      console.info("Swipe detected");
      window.ReactNativeWebView.postMessage(JSON.stringify({ event: "swipe" }));
      if (
        readerMode === "scroll" &&
        Math.abs(
          element.scrollHeight - element.scrollTop - element.clientHeight
        ) < 10
      ) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ event: "scroll-bottom" })
        );
      }
      if (readerMode === "scroll" && element.scrollTop === 0) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ event: "scroll-top" })
        );
      }
    }
  };
  let onTouchStart = function (event) {
    const target: any = event.target;
    if (!target) return;
    if (target.tagName === "IMG") {
      const imgSrc = target.src || target.getAttribute("xlink:href");
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ event: "view-image", imgSrc: imgSrc })
      );
    }
    if (event.touches.length > 1) {
      event.preventDefault();
    }
    const touch = event.touches[0];
    touchStartTime = Date.now();
    touchStartX = touch.screenX;
    touchStartY = touch.screenY;
  };
  let isDragging = false;
  let lastTouchX = 0;

  let onTouchMove = function (event) {
    // Skip handling if not dragging yet and still determining direction
    if (!isDragging && Math.abs(event.touches[0].screenX - touchStartX) <= 10) {
      return;
    }

    // Prevent default to stop browser scroll behavior
    event.preventDefault();

    const touch = event.touches[0];
    const touchCurrentX = touch.screenX;
    const touchCurrentY = touch.screenY;

    // Calculate distance moved
    const distX = touchCurrentX - touchStartX;
    const distY = touchCurrentY - touchStartY;

    // Only start dragging if horizontal movement is greater than vertical
    if (
      !isDragging &&
      Math.abs(distX) > Math.abs(distY) &&
      Math.abs(distX) > 10
    ) {
      isDragging = true;
      lastTouchX = touchCurrentX;
      // Apply hardware acceleration to the body
      doc.body.style.transform = "translateZ(0)";
      if (animation === "mimical" && readerMode !== "scroll") {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ event: "swipe-start" })
        );
        let bookDiv = document.getElementById("book");
        if (bookDiv) {
          bookDiv.style.display = "block";
          render.mouseDownHandler(event);
        }
      }
      return;
    }
    if (isDragging && animation === "mimical" && readerMode !== "scroll") {
      render.mouseMoveHandler(event);
    }
    // If we're in dragging mode, apply direct transform for better performance
    if (isDragging && animation === "sliding") {
      // Calculate the delta since last move event
      const deltaX = touchCurrentX - lastTouchX;

      // Use transform instead of scrollBy for smoother rendering
      const currentScrollLeft = doc.body.scrollLeft;
      doc.body.scrollLeft = currentScrollLeft - deltaX;

      // Update last position
      lastTouchX = touchCurrentX;

      // Request animation frame for smoother updates (optional)
      requestAnimationFrame(() => {
        // Additional visual feedback can be added here
      });
    }
  };
  doc.addEventListener("touchend", onTouchEnd, false);
  doc.addEventListener("touchstart", onTouchStart, false);
  doc.addEventListener("touchmove", onTouchMove, false);
  // doc.body.ontouchend = onTouchEnd;
  // doc.body.ontouchstart = onTouchStart;
  // doc.body.ontouchmove = onTouchMove;
  // iWin.ontouchend = onTouchEnd;
  // iWin.ontouchstart = onTouchStart;
  // iWin.ontouchmove = onTouchMove;
  let selectionTimeout: any = null;
  doc.body.oncontextmenu = function (event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
  };
  let scrollLeft = 0;
  doc.addEventListener(
    "selectstart",
    (event) => {
      if (readerMode === "scroll") return;
      scrollLeft = doc.body.scrollLeft;
      //prevent doc.body from scrolling
    },
    false
  );
  doc.addEventListener(
    "selectionchange",
    (event) => {
      if (scrollLeft > 0) {
        doc.body.scrollLeft = scrollLeft;
      }

      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
      }
      selectionTimeout = setTimeout(
        async () => {
          const selectedText = iWin.getSelection().toString().trim();
          if (selectedText) {
            var range = iWin.getSelection().getRangeAt(0);
            let pageSize = render.getPageSize();
            var rect = range.getBoundingClientRect();
            if (format === "PDF") {
              let clientRects = range.getClientRects();
              if (clientRects.length > 0) {
                //combine all the rects
                clientRects = Array.from(clientRects).filter((item: any) => {
                  return (
                    Math.abs(item.height - pageSize.sectionHeight) > 10 &&
                    Math.abs(item.width - pageSize.sectionWidth) > 10 &&
                    item.height > 0 &&
                    item.width > 0
                  );
                });
                let minTop = Infinity;
                let minLeft = Infinity;
                let maxBottom = -Infinity;
                let maxRight = -Infinity;

                for (let i = 0; i < clientRects.length; i++) {
                  const rect = clientRects[i];
                  minTop = Math.min(minTop, rect.top);
                  minLeft = Math.min(minLeft, rect.left);
                  maxBottom = Math.max(maxBottom, rect.bottom);
                  maxRight = Math.max(maxRight, rect.right);
                }

                // Create the combined rectangle object
                const combinedRect = {
                  top: minTop,
                  left: minLeft,
                  bottom: maxBottom,
                  right: maxRight,
                  width: maxRight - minLeft,
                  height: maxBottom - minTop,
                };
                rect = combinedRect;
              }
            }

            var position = {
              top: rect.top - element.scrollTop,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              screenWidth: window.innerWidth,
              screenHeight: window.innerHeight,
              sectionHeight: pageSize.sectionHeight,
              chapterDocIndex: 0,
              sectionWidth: pageSize.sectionWidth,
              gap: pageSize.gap,
            };
            rangy.init();
            let charRange = null;
            if (format === "PDF") {
              let target: any = event.target;
              let ownerDoc = target;
              let targetIframe = ownerDoc?.defaultView?.frameElement;
              let id = targetIframe?.getAttribute("id") || "";
              let chapterDocIndex = id
                ? parseInt(id.split("-").reverse()[0])
                : 0;
              charRange = await render.getHightlightCoords(chapterDocIndex);
              position.chapterDocIndex = chapterDocIndex;
            } else {
              charRange = await render.getHightlightCoords();
            }

            window.ReactNativeWebView.postMessage(
              JSON.stringify({
                event: "select-text",
                selectedText: selectedText,
                position: position,
                range: charRange,
              })
            );
          }
        },
        format === "PDF" ? 300 : 200
      ); // Debounce selection events
    },
    false
  );
};
export const addAppleTouchEvent = (
  doc: Document,
  iframe: any,
  element: HTMLElement,
  readerMode: string,
  animation: string,
  format: string,
  render: any
) => {
  let iWin: any = iframe.contentWindow || iframe.contentDocument?.defaultView;
  let touchStartTime = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let lastTouchEnd = 0;
  let lastSelectEnd = 0;
  const swipeThreshold = 30; // Minimum distance in pixels to be considered a swipe
  const timeThreshold = 500; // Maximum time in milliseconds to be considered a tap
  let section = Math.floor(element.clientWidth / 12);
  let gap = section % 2 === 0 ? section : section - 1;
  let onTouchEnd = async function (event) {
    let now = new Date().getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
      return;
    }
    lastTouchEnd = now;
    const touch = event.changedTouches[0];
    const touchEndTime = Date.now();
    const touchEndX = touch.screenX;
    const touchEndY = touch.screenY;
    const timeDiff = touchEndTime - touchStartTime;
    const distX = touchEndX - touchStartX;
    const distY = touchEndY - touchStartY;
    if (isDragging && animation === "mimical" && readerMode !== "scroll") {
      isDragging = false;
      render.mouseUpHandler(event);
      if (
        touchEndX < (window.screen.width / 4) * 3 &&
        touchEndX - touchStartX < 0
      ) {
        render.next();
      } else if (
        touchEndX > (window.screen.width / 4) * 1 &&
        touchEndX - touchStartX > 0
      ) {
        render.prev();
      }
      setTimeout(() => {
        let bookDiv = document.getElementById("book");
        if (bookDiv) {
          bookDiv.style.display = "none";
        }
      }, 400);

      return;
    }
    // Replace the scrollTo implementation with this optimized version
    if (isDragging && animation === "sliding") {
      // Clean up any existing animation
      if (window.scrollAnimationId) {
        cancelAnimationFrame(window.scrollAnimationId);
      }
      if (
        Math.abs(
          doc.body.scrollWidth - doc.body.scrollLeft - element.clientWidth
        ) < 10
      ) {
        if (selectionTimeout) {
          clearTimeout(selectionTimeout);
        }
        selectionTimeout = setTimeout(() => {
          render.next();
        }, 300); // Debounce selection events
        return;
      }
      if (doc.body.scrollLeft === 0) {
        if (selectionTimeout) {
          clearTimeout(selectionTimeout);
        }
        selectionTimeout = setTimeout(() => {
          render.prev();
        }, 300); // Debounce selection events
        return;
      }

      doc.body.style.transform = "";
      let pageWidth = element.clientWidth + gap;
      let scrollLeft = doc.body.scrollLeft;

      // Improved snapping logic
      let snapX;
      const currentPage = Math.round(scrollLeft / pageWidth);
      const dragPercentage = Math.abs(distX) / window.screen.width;
      const dragThreshold = 0.1; // Only 10% drag needed to change page

      if (distX > 0 && dragPercentage > dragThreshold) {
        // Dragged right (go to previous page)
        snapX = (currentPage - 1) * pageWidth;
      } else if (distX < 0 && dragPercentage > dragThreshold) {
        // Dragged left (go to next page)
        snapX = (currentPage + 1) * pageWidth;
      } else {
        // Stay on current page
        snapX = currentPage * pageWidth;
      }

      // Ensure we don't go out of bounds
      snapX = Math.max(0, Math.min(snapX, doc.body.scrollWidth - pageWidth));
      if (doc.body.scrollWidth - snapX < pageWidth + gap) {
        snapX = doc.body.scrollWidth;
      }

      // Use custom smooth scrolling with requestAnimationFrame instead of browser's scrollTo
      const startTime = performance.now();
      const startLeft = doc.body.scrollLeft;
      const distance = snapX - startLeft;
      const duration = 300; // milliseconds

      // Apply hardware acceleration before animation starts
      doc.body.style.willChange = "scroll-position";

      // Custom easing function for natural movement
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

      function animateScroll(currentTime) {
        const elapsedTime = currentTime - startTime;

        if (elapsedTime >= duration) {
          // Animation complete - set final position
          doc.body.scrollLeft = snapX;

          // Clean up acceleration hints
          doc.body.style.willChange = "auto";

          render.record();
          isDragging = false;
          return;
        }

        // Calculate new position using easing
        const progress = easeOutCubic(elapsedTime / duration);
        const newLeft = startLeft + distance * progress;
        // Update scroll position
        doc.body.scrollLeft = newLeft;

        // Continue animation
        window.scrollAnimationId = requestAnimationFrame(animateScroll);
      }

      // Start animation
      window.scrollAnimationId = requestAnimationFrame(animateScroll);

      return;
    }
    const selectedText = iWin.getSelection().toString().trim();
    if (selectedText) {
      var range = iWin.getSelection().getRangeAt(0);
      var rect = range.getBoundingClientRect();
      var pageSize = render.getPageSize();
      var position = {
        top: rect.top - element.scrollTop,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        sectionHeight: pageSize.sectionHeight,
        chapterDocIndex: 0,
        sectionWidth: pageSize.sectionWidth,
        gap: pageSize.gap,
      };
      rangy.init();
      let charRange = null;
      if (format === "PDF") {
        let target: any = event.target;
        let ownerDoc = target.ownerDocument;
        let targetIframe = ownerDoc?.defaultView?.frameElement;
        let id = targetIframe?.getAttribute("id") || "";
        let chapterDocIndex = id ? parseInt(id.split("-").reverse()[0]) : 0;
        position.chapterDocIndex = chapterDocIndex;
        charRange = await render.getHightlightCoords(chapterDocIndex);
      } else {
        charRange = await render.getHightlightCoords();
      }
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          event: "select-text",
          selectedText: selectedText,
          position: position,
          range: charRange,
        })
      );
      return;
    }
    if (
      timeDiff < timeThreshold &&
      Math.abs(distX) < swipeThreshold &&
      Math.abs(distY) < swipeThreshold
    ) {
      const width = document.documentElement.clientWidth;
      const height = document.documentElement.clientHeight;
      let normalizedX = Math.min(Math.max(touchEndX, 0), width);
      let normalizedY = Math.min(Math.max(touchEndY, 0), height);

      if (format === "PDF" && readerMode === "double") {
        let target: any = event.target;
        let ownerDoc = target.ownerDocument;
        let targetIframe = ownerDoc?.defaultView?.frameElement;
        let id = targetIframe?.getAttribute("id") || "";
        let chapterDocIndex = id ? parseInt(id.split("-").reverse()[0]) : 0;
        if (chapterDocIndex % 2 === 1) {
          normalizedX = normalizedX + width / 2;
        }
      }
      let result = "";
      // For pagination mode: keep original 3x3 grid
      const cellWidth = width / 3;
      const cellHeight = height / 3;
      const col = Math.min(Math.floor(normalizedX / cellWidth), 2);
      const row = Math.min(Math.floor(normalizedY / cellHeight), 2);

      if (
        col === 0 // Left column (left third of screen)
      ) {
        result = "left";
      } else if (col === 1) {
        // Middle column (middle third of screen)
        result = "center";
      } else if (col === 2) {
        // Right column (right third of screen)
        result = "right";
      }

      window.ReactNativeWebView.postMessage(JSON.stringify({ event: result }));
    } else if (
      Math.abs(distX) >= swipeThreshold ||
      Math.abs(distY) >= swipeThreshold
    ) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ event: "swipe" }));
      if (
        readerMode === "scroll" &&
        Math.abs(
          element.scrollHeight - element.scrollTop - element.clientHeight
        ) < 10
      ) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ event: "scroll-bottom" })
        );
      }
      if (readerMode === "scroll" && element.scrollTop === 0) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ event: "scroll-top" })
        );
      }
    }
  };
  let onTouchStart = function (event) {
    const target: any = event.target;
    if (!target) return;
    if (target.tagName === "IMG") {
      const imgSrc = target.src || target.getAttribute("xlink:href");
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ event: "view-image", imgSrc: imgSrc })
      );
    }
    if (event.touches.length > 1) {
      event.preventDefault();
    }
    const touch = event.touches[0];
    touchStartTime = Date.now();
    touchStartX = touch.screenX;
    touchStartY = touch.screenY;
  };
  let isDragging = false;
  let lastTouchX = 0;

  let onTouchMove = function (event) {
    const selectedText = iWin.getSelection().toString().trim();
    // Skip handling if not dragging yet and still determining direction
    if (
      (!isDragging && Math.abs(event.touches[0].screenX - touchStartX) <= 10) ||
      selectedText
    ) {
      return;
    }

    // Prevent default to stop browser scroll behavior
    event.preventDefault();

    const touch = event.touches[0];
    const touchCurrentX = touch.screenX;
    const touchCurrentY = touch.screenY;

    // Calculate distance moved
    const distX = touchCurrentX - touchStartX;
    const distY = touchCurrentY - touchStartY;

    // Only start dragging if horizontal movement is greater than vertical
    if (
      !isDragging &&
      Math.abs(distX) > Math.abs(distY) &&
      Math.abs(distX) > 10
    ) {
      isDragging = true;
      lastTouchX = touchCurrentX;
      // Apply hardware acceleration to the body
      // doc.body.style.transform = "translateZ(0)";
      if (animation === "mimical" && readerMode !== "scroll") {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ event: "swipe-start" })
        );
        let bookDiv = document.getElementById("book");
        if (bookDiv) {
          bookDiv.style.display = "block";
          render.mouseDownHandler(event);
        }
      }
      return;
    }
    if (isDragging && animation === "mimical" && readerMode !== "scroll") {
      render.mouseMoveHandler(event);
    }
    // If we're in dragging mode, apply direct transform for better performance
    if (isDragging && animation === "sliding") {
      // Calculate the delta since last move event
      const deltaX = touchCurrentX - lastTouchX;

      // Use transform instead of scrollBy for smoother rendering
      const currentScrollLeft = doc.body.scrollLeft;
      doc.body.scrollLeft = currentScrollLeft - deltaX;

      // Update last position
      lastTouchX = touchCurrentX;

      // Request animation frame for smoother updates (optional)
      requestAnimationFrame(() => {
        // Additional visual feedback can be added here
      });
    }
  };
  doc.addEventListener("touchend", onTouchEnd, false);
  doc.addEventListener("touchstart", onTouchStart, false);
  doc.addEventListener("touchmove", onTouchMove, false);
  // doc.body.ontouchend = onTouchEnd;
  // doc.body.ontouchstart = onTouchStart;
  // doc.body.ontouchmove = onTouchMove;
  // iWin.ontouchend = onTouchEnd;
  // iWin.ontouchstart = onTouchStart;
  // iWin.ontouchmove = onTouchMove;
  let selectionTimeout: any = null;
  doc.addEventListener("touchmove", (event) => {}, false);
  doc.body.oncontextmenu = function (event) {
    event.preventDefault();
    event.stopPropagation();

    return false;
  };
};
