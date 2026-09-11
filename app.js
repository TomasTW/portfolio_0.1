/* ==========================================================================
   PORTFOLIO INTERACTIVE CORE ENGINE (app.js)
   ========================================================================== */

/* ==========================================================================
   -1. IN-APP BROWSER / WEBVIEW DETECTION
   Detects LinkedIn, Facebook, Instagram, LINE, 104.com.tw and other common
   in-app browsers that embed a limited WebView instead of a full browser.
   ========================================================================== */
(function detectWebView() {
  const ua = navigator.userAgent || '';
  const isWebView = /LinkedIn|LIFF|FBAV|FBAN|Instagram|Line\/|Twitter|MicroMessenger|104app|Bytedance|TikTok|Snapchat|Pinterest|WeChat/i.test(ua)
    || ((/iPhone|iPad|iPod/.test(ua)) && !(/Safari/.test(ua)) && /AppleWebKit/.test(ua))
    || (/wv\)/.test(ua)); // Android WebView marker
  window.isWebView = isWebView;
  if (isWebView) {
    document.documentElement.classList.add('is-webview');
    document.body && document.body.classList.add('is-webview');
    // Defer body class if body isn't available yet
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('is-webview');
      }, { once: true });
    }
  }
})();

/* ==========================================================================
   0. HERO SCROLL-SCRUBBED FRAME ANIMATION
   Uses hero_section.svg inlined in the HTML.
   Technique: CSS animation-play-state:paused + negative animation-delay
   sets the exact frozen frame. Both are applied together on every scroll
   tick so the browser recomputes the frame — reliable across all browsers.
   ========================================================================== */
// --- Dynamic Viewport Height Engine (tracks visualViewport and innerHeight) ---
function updateStableVh() {
  const vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
  document.documentElement.style.setProperty('--stable-vh', `${vh}px`);
}
updateStableVh();
window.addEventListener('orientationchange', () => {
  setTimeout(updateStableVh, 150);
});
window.addEventListener('resize', updateStableVh);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateStableVh);
}

function getViewportHeight() {
  return parseFloat(document.documentElement.style.getPropertyValue('--stable-vh')) || window.innerHeight;
}

(function () {
  const container = document.querySelector('.hero-canvas-sticky');
  if (!container) return;

  function initHeroScroll(svgEl) {
    if (!svgEl) return;
    svgEl.id = 'hero-svg';

    const DURATION_S = 2.982705; // matches the 3s animation duration in hero_section.svg
    const section = document.getElementById('hero');

    // Ensure SVG uses xMidYMid meet so text is never cropped during initial/main animation
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // All animated elements in hero_section.svg
    const targets = Array.from(svgEl.querySelectorAll(
      '#Union, #Vector, #Vector_2, #Vector_3, #Vector_4, #Vector_5, #Vector_6, ' +
      '#Vector_7, #Vector_8, #Vector_9, #Vector_10, #Vector_11, #Vector_12, #logo'
    ));
    if (!targets.length) return;

    // Seek to a specific second in the animation.
    // Setting BOTH play-state and delay together forces the browser to
    // recalculate the frozen frame per the CSS spec.
    function seekTo(seconds) {
      const delay = `-${seconds.toFixed(3)}s`;
      targets.forEach(el => {
        el.style.animationPlayState = 'paused';
        el.style.animationDelay = delay;
      });
    }

    // Dynamically anchor hero_graphic.svg exactly 16px below the bottom of "I'm Tomas Chen"
    function updateHeroIndicatorPosition() {
      const indicator = document.getElementById('hero-scroll-indicator');
      if (!indicator || !container) return;

      const textEl = svgEl.querySelector('#Union') || svgEl.querySelector('#Vector');
      if (!textEl) return;

      const textRect = textEl.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      if (textRect.height > 0 && containerRect.height > 0) {
        // Top loop of hero_graphic.svg starts at Y = 40px in 400px viewBox (10% of box height)
        const indicatorHeight = indicator.offsetHeight || 200;
        const topLoopOffset = indicatorHeight * 0.10;
        const gap = 16; // 16px compact gap between bottom of letters and top of yellow loop

        const topPx = (textRect.bottom - containerRect.top) + gap - topLoopOffset;
        indicator.style.top = `${topPx.toFixed(2)}px`;
        indicator.style.transform = 'translateX(-50%)';
      }
    }

    let rafId = null;

    function onScroll(immediate) {
      function doUpdate() {
        rafId = null;
        if (!section) return;

        const sectionTop = section.getBoundingClientRect().top + window.scrollY;
        const sectionHeight = section.offsetHeight - getViewportHeight();
        const scrolled = Math.max(0, window.scrollY - sectionTop);
        const progress = sectionHeight > 0 ? Math.min(1, scrolled / sectionHeight) : 0;

        // Clamp to DURATION_S - 0.001s to prevent -3.0s % 3.0s wrap-around back to frame 0
        const seekTime = Math.min(DURATION_S - 0.001, progress * DURATION_S);
        seekTo(seekTime);
        if (window.heroBubbleInstance) {
          window.heroBubbleInstance.setScrollProgress(progress);
        }

        // Fade out hero scroll indicator graphic smoothly on scroll
        const indicator = document.getElementById('hero-scroll-indicator');
        if (indicator) {
          if (progress > 0.005) {
            const fadeOut = Math.max(0, 1 - (progress / 0.06));
            indicator.style.opacity = fadeOut.toFixed(3);
            indicator.style.pointerEvents = 'none';
          } else {
            indicator.style.opacity = '1';
            updateHeroIndicatorPosition();
          }
        }

        // Ensure hero canvas remains visible as continuous dark background (#202020) for About, Works, and Contact
        container.style.opacity = '1';
        container.style.visibility = 'visible';
        container.style.pointerEvents = progress >= 1.0 ? 'none' : 'auto';

        // Solid background fallback ensures black area NEVER disappears on reload or rapid scrub
        if (progress >= 0.99) {
          container.classList.add('is-dark');
        } else {
          container.classList.remove('is-dark');
        }

        // Explicitly hide text letters at the end of hero to ensure zero text bleed-through into subsequent sections
        const heroTextGroup = svgEl.querySelector('#I___m_Tomas_Chen');
        const heroUnion = svgEl.querySelector('#Union');
        if (progress >= 0.98) {
          if (heroTextGroup) heroTextGroup.style.opacity = '0';
          if (heroUnion) heroUnion.style.opacity = '0';
        } else {
          if (heroTextGroup) heroTextGroup.style.opacity = '';
          if (heroUnion) heroUnion.style.opacity = '';
        }

        // Smooth end scene expansion: scale SVG from 1.0 to cover full sticky area during progress 0.65 -> 1.0
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        if (containerWidth > 0 && containerHeight > 0) {
          const nativeAspect = 1920 / 1080;
          const containerAspect = containerWidth / containerHeight;
          let maxScale = 1.0;
          if (containerAspect < nativeAspect) {
            maxScale = (containerHeight / (containerWidth / nativeAspect)) * 1.08;
          } else {
            maxScale = (containerWidth / (containerHeight * nativeAspect)) * 1.08;
          }

          let scale = 1.0;
          if (progress > 0.65) {
            const t = Math.min(1, (progress - 0.65) / 0.35);
            const easeT = t * t * (3 - 2 * t); // smoothstep interpolation
            scale = 1.0 + (maxScale - 1.0) * easeT;
          }

          svgEl.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(4)})`;
        }
      }

      if (immediate) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        doUpdate();
      } else {
        if (rafId) return;
        rafId = requestAnimationFrame(doUpdate);
      }
    }

    // Freeze at frame 0 only if user is at the very top of the page on load
    if (window.scrollY === 0) {
      seekTo(0);
      if (window.heroBubbleInstance) {
        window.heroBubbleInstance.setScrollProgress(0);
      }
      updateHeroIndicatorPosition();
    } else {
      onScroll(true);
    }

    window.addEventListener('scroll', () => onScroll(false), { passive: true });
    window.addEventListener('resize', () => {
      updateHeroIndicatorPosition();
      onScroll(false);
    }, { passive: true });
    window.addEventListener('load', () => onScroll(true));
    window.addEventListener('pageshow', () => onScroll(true));

    // Initial sync + multi-frame checks to catch async browser scroll restoration on reload
    onScroll(true);
    requestAnimationFrame(() => {
      onScroll(true);
      requestAnimationFrame(() => {
        onScroll(true);
      });
    });
  }

  // SVG is inlined in index.html — works on file:// with no fetch needed
  const inlinedSvg = container.querySelector('svg');
  if (inlinedSvg) {
    initHeroScroll(inlinedSvg);
    return;
  }

  // Fallback: fetch for HTTP-served deployments
  fetch('hero_section.svg')
    .then(r => r.text())
    .then(text => {
      container.insertAdjacentHTML('afterbegin', text);
      initHeroScroll(container.querySelector('svg'));
    })
    .catch(err => console.error('[Hero] SVG failed to load:', err));
})();







document.addEventListener('DOMContentLoaded', () => {


  // ==========================================================================
  // 2. TOGGLE LOGO CURSOR EFFECT
  // ==========================================================================
  const cursorLogo = document.createElement('div');
  cursorLogo.className = 'cursor-logo';
  cursorLogo.innerHTML = `
    <svg class="cursor-logo-svg" viewBox="0 0 72 82" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.5 62.9824C10.5 66.7862 9.5 76.0834 7.5 82H0C5 60.0241 15 15.3117 15 12.2689C15 9.22612 13.5 9.73325 6 16.0722L0 11.0009C9 2.12607 24 -4.2129 42 3.39391C57.0002 9.73299 69 2.12598 72 0.858138C70.5 3.39381 60.1367 11.3849 52.5 13.5365C43.5 16.0722 46.5 24.9471 48 33.8219C49.5 42.6968 51.4917 52.1403 43.5 56.6432C34.5 61.7144 26.341 60.0912 19.5 62.9824Z" fill="currentColor" />
    </svg>
  `;
  document.body.appendChild(cursorLogo);

  let isLogoCursorActive = false;
  const titleDividerLogo = document.querySelector('.title-divider');

  if (titleDividerLogo) {
    titleDividerLogo.addEventListener('mouseenter', () => {
      if (window.innerWidth <= 1440) return;
      isLogoCursorActive = !isLogoCursorActive;
      if (isLogoCursorActive) {
        document.body.classList.add('use-logo-cursor');
      } else {
        document.body.classList.remove('use-logo-cursor');
      }
    });
  }

  document.addEventListener('mousemove', (e) => {
    if (window.innerWidth <= 1024) {
      if (isLogoCursorActive) {
        isLogoCursorActive = false;
        document.body.classList.remove('use-logo-cursor');
      }
      return;
    }
    if (isLogoCursorActive) {
      cursorLogo.style.setProperty('--x', `${e.clientX}px`);
      cursorLogo.style.setProperty('--y', `${e.clientY}px`);
    }
  });

  document.addEventListener('mouseleave', () => {
    if (window.innerWidth > 1024) {
      document.body.classList.add('cursor-out');
    }
  });

  document.addEventListener('mouseenter', () => {
    if (window.innerWidth > 1024) {
      document.body.classList.remove('cursor-out');
    }
  });









  // ==========================================================================
  // 5. TYPIST SUBHEADING ANIMATION
  // ==========================================================================
  const typistText = document.getElementById('typist-text');
  const subheadings = ["a Visual Creator", "a Graphic Designer", "a UI/UX Designer"];
  let wordIndex = 0;
  let charIndex = 0;
  let isDeleting = false;

  function typeEffect() {
    if (!typistText) return;
    const currentWord = subheadings[wordIndex];

    if (isDeleting) {
      typistText.textContent = currentWord.substring(0, charIndex - 1);
      charIndex--;
    } else {
      typistText.textContent = currentWord.substring(0, charIndex + 1);
      charIndex++;
    }

    let delay = isDeleting ? 40 : 80;

    if (!isDeleting && charIndex === currentWord.length) {
      delay = 2000; // Pause at full word
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      wordIndex = (wordIndex + 1) % subheadings.length;
      delay = 500; // Brief pause before typing next word
    }

    setTimeout(typeEffect, delay);
  }
  typeEffect();





  // ==========================================================================
  // 7. SCROLL REVEAL — staggered IntersectionObserver
  // ==========================================================================
  const revealElements = document.querySelectorAll('.reveal-up, .reveal-right, .about-content, .works-card, .contact-box');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const el = entry.target;
      if (entry.isIntersecting) {
        const delay = parseInt(el.getAttribute('data-delay') || '0', 10);
        if (el.revealTimeout) clearTimeout(el.revealTimeout);
        el.revealTimeout = setTimeout(() => {
          el.classList.add('is-visible');
        }, delay);
      } else {
        if (el.revealTimeout) clearTimeout(el.revealTimeout);
        el.classList.remove('is-visible');
      }
    });
  }, {
    threshold: 0.12,       // trigger when 12% visible
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));


  // ==========================================================================
  // 8. HERO VISUAL PARALLAX — smooth depth as user scrolls
  // ==========================================================================
  const heroVisual = document.getElementById('hero-visual');

  function updateParallax() {
    if (!heroVisual) return;
    // Only apply after reveal has fired to avoid fighting the slide-in
    if (!heroVisual.classList.contains('is-visible')) return;

    const scrollY = window.scrollY;
    // Move card upward at 25% of scroll speed for gentle parallax
    const offset = -(scrollY * 0.25);
    heroVisual.style.setProperty('--parallax-y', `${offset}px`);
  }

  window.addEventListener('scroll', updateParallax, { passive: true });





  // ==========================================================================
  // 10. COPY EMAIL TO CLIPBOARD WITH PREMIUM TOAST
  // ==========================================================================
  const copyEmailBtn = document.getElementById('copy-email-btn');
  if (copyEmailBtn) {
    copyEmailBtn.addEventListener('click', () => {
      const email = 'tomaschen1994@gmail.com';
      navigator.clipboard.writeText(email).then(() => {
        showToast('📬 Email copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    });
  }

  function showToast(message) {
    let toast = document.getElementById('custom-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'custom-toast';
      toast.className = 'glass-panel custom-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;

    // Force browser reflow to reset transition triggers
    toast.offsetHeight;

    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }



  // --- Works Desktop Pinned Scroll Showcase (Continuous Horizontal Multi-Project Track) ---
  (function initWorksDesktopPinnedScroll() {
    const pinnedSection = document.querySelector('.works-desktop-pinned');
    const stickyFrame = document.querySelector('.works-sticky-frame');
    const trackEl = document.getElementById('works-track');
    const card = document.querySelector('.work-card');
    const graphicWrapEl = document.querySelector('.work-graphic-wrap');

    if (!pinnedSection || !trackEl || !card) return;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function mapRange(val, inMin, inMax, outMin, outMax) {
      const t = Math.max(0, Math.min(1, (val - inMin) / (inMax - inMin)));
      return outMin + t * (outMax - outMin);
    }

    function setFullyVisible() {
      if (stickyFrame) {
        stickyFrame.style.setProperty('--works-hand-opacity', '1');
        stickyFrame.style.setProperty('--works-hand-rotate', '0deg');
      }
      card.style.setProperty('--works-hand-opacity', '1');
      card.style.setProperty('--works-hand-rotate', '0deg');
      card.style.setProperty('--works-track-opacity', '1');
      card.style.setProperty('--works-enter-x', '0vw');
      card.style.setProperty('--works-track-x', '0px');
      const allItems = trackEl.querySelectorAll('.work-project-item');
      allItems.forEach(item => item.style.setProperty('--item-y', '0px'));
    }

    function getMaxScroll() {
      const items = trackEl.querySelectorAll('.work-project-item');
      if (items.length < 2) return 0;
      return items[items.length - 1].offsetLeft - items[0].offsetLeft;
    }

    let rafId = null;

    function update() {
      rafId = null;
      if (window.innerWidth <= 1024) {
        setFullyVisible();
        const allItems = trackEl.querySelectorAll('.work-project-item');
        allItems.forEach(item => item.style.removeProperty('--item-y'));
        return;
      }

      const rect = pinnedSection.getBoundingClientRect();
      const pinnedDistance = pinnedSection.offsetHeight - window.innerHeight;
      if (pinnedDistance <= 0) return;

      const scrolledInPin = -rect.top;
      const p = Math.max(0, Math.min(1, scrolledInPin / pinnedDistance));

      function getTitleAimAngle() {
        const firstTitle = trackEl.querySelector('.work-title');
        if (!firstTitle || !graphicWrapEl) return 20;
        const titleRect = firstTitle.getBoundingClientRect();
        const handRect = graphicWrapEl.getBoundingClientRect();

        const handCenterX = handRect.left + handRect.width * 0.5;
        const handCenterY = handRect.top + handRect.height * 0.5;
        const titleTargetX = titleRect.left + Math.min(titleRect.width * 0.4, 250);
        const titleTargetY = titleRect.top + titleRect.height * 0.5;

        const deltaX = handCenterX - titleTargetX;
        const deltaY = handCenterY - titleTargetY;
        if (deltaX <= 0) return 20;
        const deg = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        return Math.max(12, Math.min(40, deg));
      }

      function getImageAimAngle() {
        const firstImgWrap = trackEl.querySelector('.work-img-wrap');
        if (!firstImgWrap || !graphicWrapEl) return 25;
        const imgRect = firstImgWrap.getBoundingClientRect();
        const handRect = graphicWrapEl.getBoundingClientRect();

        const handCenterX = handRect.left + handRect.width * 0.5;
        const handCenterY = handRect.top + handRect.height * 0.5;
        const imageTargetX = imgRect.left + imgRect.width * 0.5;
        const imageTargetY = imgRect.top + imgRect.height * 0.5;

        const deltaX = handCenterX - imageTargetX;
        const deltaY = handCenterY - imageTargetY;
        if (deltaX <= 0) return 25;
        const deg = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        return Math.max(15, Math.min(38, deg));
      }

      const titleAngle = getTitleAimAngle();
      const imageAngle = getImageAimAngle();

      // 1. Hand SVG: Fades in early (0.00→0.08), stays visible, fades out last (0.88→0.98)
      const handOpacity = p < 0.08
        ? easeInOut(mapRange(p, 0.00, 0.08, 0, 1))
        : p < 0.88
          ? 1
          : p < 0.98
            ? 1 - easeInOut(mapRange(p, 0.88, 0.98, 0, 1))
            : 0;

      // 1b. Hand Rotation: (0.02→0.16), standardized matching About & Contact
      let handRotate = 0;
      if (p < 0.02) {
        handRotate = titleAngle;
      } else if (p < 0.16) {
        const enterT = easeInOut(mapRange(p, 0.02, 0.16, 0, 1));
        handRotate = titleAngle * (1 - enterT) + imageAngle * enterT;
      } else if (p > 0.78) {
        const exitT = easeInOut(mapRange(p, 0.78, 0.94, 0, 1));
        handRotate = imageAngle - (imageAngle + 25) * exitT;
      } else {
        handRotate = imageAngle;
      }

      // 2. Track Entrance & Exit
      const trackOpacity = p < 0.06
        ? 0
        : p < 0.16
          ? easeInOut(mapRange(p, 0.06, 0.16, 0, 1))
          : p < 0.82
            ? 1
            : p < 0.94
              ? 1 - easeInOut(mapRange(p, 0.82, 0.94, 0, 1))
              : 0;

      const enterXvw = 0; // In-place entrance to prevent left clipping of title

      // 3. Magnetic Multi-Project Scroll (0.16 → 0.80) with Dwell Plateau on each project
      const items = Array.from(trackEl.querySelectorAll('.work-project-item'));
      const numItems = items.length;
      let trackX = 0;

      // Vertical slide offset for incoming projects (entering smooth from top to resting position)
      // Positions incoming project so its bottom bullet text sits above the container vertical midpoint (~1/2)
      const cardHeight = card.offsetHeight || (window.innerHeight - 272);
      const Y_SLIDE = cardHeight * 0.54;

      if (numItems > 1) {
        const itemOffsets = items.map(item => item.offsetLeft - items[0].offsetLeft);
        const maxScroll = itemOffsets[numItems - 1];

        const browseP = Math.max(0, Math.min(1, (p - 0.16) / (0.80 - 0.16)));
        const numTransitions = numItems - 1; // 3 transitions for 4 projects
        const segmentProgress = browseP * numTransitions;
        const currentIdx = Math.min(Math.floor(segmentProgress), numTransitions - 1);
        const u = segmentProgress - currentIdx; // progress within this transition [0, 1]

        // 25% magnetic dwell plateau at the start of each project position
        const DWELL_RATIO = 0.25;
        let t = 0;
        if (u > DWELL_RATIO) {
          const moveProgress = (u - DWELL_RATIO) / (1 - DWELL_RATIO);
          t = easeInOut(moveProgress);
        }

        const startX = -itemOffsets[currentIdx];
        const endX = -itemOffsets[currentIdx + 1];
        trackX = startX + (endX - startX) * t;

        // If at or past browsing window, lock cleanly at final project offset
        if (browseP >= 1) {
          trackX = -maxScroll;
        }

        // Calculate smooth slide-down from top for each incoming project
        items.forEach((item, k) => {
          if (k === 0) {
            // First project is already in resting position
            item.style.setProperty('--item-y', '0px');
            return;
          }

          if (browseP >= 1 || segmentProgress >= k) {
            // Reached or passed this project: resting cleanly in original position
            item.style.setProperty('--item-y', '0px');
          } else if (segmentProgress < k - 1) {
            // Project is waiting in the future on the right: starts at the top
            item.style.setProperty('--item-y', `${(-Y_SLIDE).toFixed(2)}px`);
          } else {
            // Currently transitioning into this project (k - 1 <= segmentProgress < k)
            const segU = segmentProgress - (k - 1);
            let slideT = 0;
            if (segU > DWELL_RATIO) {
              const moveProgress = (segU - DWELL_RATIO) / (1 - DWELL_RATIO);
              // Quadratic ease-out matching the curve in user diagram:
              // starts descending rapidly, then smoothly glides flat into resting position
              slideT = 1 - Math.pow(1 - moveProgress, 2);
            }
            const itemY = -Y_SLIDE * (1 - slideT);
            item.style.setProperty('--item-y', `${itemY.toFixed(2)}px`);
          }
        });
      }

      const handOpacityStr = handOpacity.toFixed(4);
      const handRotateStr = `${handRotate.toFixed(2)}deg`;
      if (stickyFrame) {
        stickyFrame.style.setProperty('--works-hand-opacity', handOpacityStr);
        stickyFrame.style.setProperty('--works-hand-rotate', handRotateStr);
      }
      card.style.setProperty('--works-hand-opacity', handOpacityStr);
      card.style.setProperty('--works-hand-rotate', handRotateStr);
      card.style.setProperty('--works-track-opacity', trackOpacity.toFixed(4));
      card.style.setProperty('--works-enter-x', `${enterXvw.toFixed(2)}vw`);
      card.style.setProperty('--works-track-x', `${trackX.toFixed(2)}px`);
    }

    function onScroll() {
      if (!rafId) rafId = requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  })();

  // --- Works Modal Controls (Desktop & Mobile, <template>-backed) ---
  (function initWorksMobileModals() {
    const modalContainer = document.getElementById('modal-container') || document.body;
    let activeModal = null;
    let activeModalResizeObserver = null;
    let lastActiveModalTrigger = null;
    let removeModalTimer = null;

    function updateModalState() {
      const openModals = document.querySelectorAll('.work-modal.open, .project-modal.open');
      const desktopNavbar = document.querySelector('.desktop-navbar');
      const mobileNavbar = document.querySelector('.mobile-navbar');
      if (openModals.length > 0) {
        document.body.classList.add('modal-is-open');
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        if (mobileNavbar && mobileNavbar.classList.contains('open')) {
          mobileNavbar.classList.remove('open');
          mobileNavbar.classList.remove('closing');
        }
        if (desktopNavbar) {
          desktopNavbar.classList.remove('visible');
        }
      } else {
        document.body.classList.remove('modal-is-open');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    }

    function updateSvgProgress(modal) {
      if (!modal) return;
      const scrollArea = modal.querySelector('.work-modal-scroll-area');
      const trackPath = modal.querySelector('.work-modal-track-path');
      const fillPath = modal.querySelector('.work-modal-fill-path');
      const inner = modal.querySelector('.work-modal-inner');

      if (trackPath && fillPath && inner && scrollArea) {
        const width = inner.clientWidth || 960;
        if (width > 0) {
          const cx = width / 2;
          const radius = 22; // Hugs 44px close button + 1px border perimeter
          const pathD = `M 0,44 L ${cx - radius},44 A ${radius} ${radius} 0 0 0 ${cx + radius},44 L ${width},44`;

          if (trackPath.getAttribute('d') !== pathD) {
            trackPath.setAttribute('d', pathD);
            fillPath.setAttribute('d', pathD);
          }

          const totalLength = fillPath.getTotalLength();
          fillPath.style.strokeDasharray = `${totalLength}`;

          const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
          const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollArea.scrollTop / maxScroll)) : 1;
          fillPath.style.strokeDashoffset = `${totalLength * (1 - progress)}`;
        }
      }

      // Legacy bar fallback
      const progressBar = modal.querySelector('.work-modal-progress-bar');
      if (scrollArea && progressBar) {
        const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
        const progress = maxScroll > 0 ? (scrollArea.scrollTop / maxScroll) * 100 : 100;
        progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
      }
    }

    function updateStickyBorderPosition(modal) {
      if (!modal) return;
      const titleWrapper = modal.querySelector('.work-modal-title-wrapper');
      const headerBorder = modal.querySelector('.work-modal-header-border');
      if (titleWrapper && headerBorder) {
        const topOffset = window.innerWidth <= 768 ? 0 : (window.innerWidth <= 900 ? -24 : -40);
        const titleBottom = titleWrapper.offsetHeight + topOffset;
        headerBorder.style.top = `${titleBottom}px`;
      }
    }

    function initModalVideo(modal) {
      const appVideoWrapper = modal.querySelector('#app-video-wrapper');
      const appDemoVideo = modal.querySelector('#app-demo-video');
      const appTimelineTrack = modal.querySelector('#app-video-timeline-track');
      const appTimelineProgress = modal.querySelector('#app-video-timeline-progress');
      const appTimelineHandle = modal.querySelector('#app-video-timeline-handle');
      const appVideoControls = modal.querySelector('#app-video-controls');

      if (appVideoWrapper && appDemoVideo) {
        let isDraggingTimeline = false;

        if (appVideoControls) {
          appVideoControls.addEventListener('click', (e) => {
            e.stopPropagation();
          });
        }

        appVideoWrapper.addEventListener('click', (e) => {
          if (e.target.closest('#app-video-controls') || isDraggingTimeline) return;
          if (appDemoVideo.paused) {
            appDemoVideo.play().then(() => {
              appVideoWrapper.classList.add('is-playing');
            }).catch(() => { });
          } else {
            appDemoVideo.pause();
            appVideoWrapper.classList.remove('is-playing');
          }
        });

        appDemoVideo.addEventListener('play', () => {
          appVideoWrapper.classList.add('is-playing');
        });

        appDemoVideo.addEventListener('pause', () => {
          appVideoWrapper.classList.remove('is-playing');
        });

        appDemoVideo.addEventListener('ended', () => {
          appVideoWrapper.classList.remove('is-playing');
        });

        const updateTimelineDisplay = (percent) => {
          const clampedPercent = Math.max(0, Math.min(100, percent));
          if (appTimelineProgress) appTimelineProgress.style.width = `${clampedPercent}%`;
          if (appTimelineHandle) appTimelineHandle.style.left = `${clampedPercent}%`;
        };

        const seekFromEvent = (e) => {
          if (!appTimelineTrack || !appDemoVideo.duration) return;
          const rect = appTimelineTrack.getBoundingClientRect();
          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
          const fraction = offsetX / rect.width;
          appDemoVideo.currentTime = fraction * appDemoVideo.duration;
          updateTimelineDisplay(fraction * 100);
        };

        if (appTimelineTrack) {
          appTimelineTrack.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            isDraggingTimeline = true;
            appTimelineTrack.classList.add('is-dragging');
            appVideoWrapper.classList.add('is-dragging');
            seekFromEvent(e);
          });

          window.addEventListener('mousemove', (e) => {
            if (isDraggingTimeline) {
              e.preventDefault();
              seekFromEvent(e);
            }
          });

          window.addEventListener('mouseup', () => {
            if (isDraggingTimeline) {
              isDraggingTimeline = false;
              appTimelineTrack.classList.remove('is-dragging');
              appVideoWrapper.classList.remove('is-dragging');
            }
          });

          appTimelineTrack.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            isDraggingTimeline = true;
            appTimelineTrack.classList.add('is-dragging');
            appVideoWrapper.classList.add('is-dragging');
            seekFromEvent(e);
          }, { passive: false });

          window.addEventListener('touchmove', (e) => {
            if (isDraggingTimeline) {
              seekFromEvent(e);
            }
          }, { passive: false });

          window.addEventListener('touchend', () => {
            if (isDraggingTimeline) {
              isDraggingTimeline = false;
              appTimelineTrack.classList.remove('is-dragging');
              appVideoWrapper.classList.remove('is-dragging');
            }
          });
        }

        appDemoVideo.addEventListener('timeupdate', () => {
          if (!isDraggingTimeline && appDemoVideo.duration) {
            const percent = (appDemoVideo.currentTime / appDemoVideo.duration) * 100;
            updateTimelineDisplay(percent);
          }
        });
      }
    }

    function setupModalListeners(modal) {
      const scrollArea = modal.querySelector('.work-modal-scroll-area');
      if (scrollArea) {
        scrollArea.addEventListener('scroll', () => {
          updateSvgProgress(modal);
        }, { passive: true });
      }

      const inner = modal.querySelector('.work-modal-inner');
      if (inner && window.ResizeObserver) {
        if (activeModalResizeObserver) {
          activeModalResizeObserver.disconnect();
        }
        activeModalResizeObserver = new ResizeObserver(() => {
          updateSvgProgress(modal);
          updateStickyBorderPosition(modal);
        });
        activeModalResizeObserver.observe(inner);
      }

      const closeBtns = modal.querySelectorAll('.work-modal-close, .modal-close, .modal-close-btn');
      closeBtns.forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeModal(modal);
        });
      });

      // Close on clicking backdrop
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal(modal);
        }
      });

      // Accessible Tab focus trap within open modal
      modal.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          const focusable = modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
          if (focusable.length > 0) {
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
              if (document.activeElement === first || !modal.contains(document.activeElement)) {
                last.focus();
                e.preventDefault();
              }
            } else {
              if (document.activeElement === last) {
                first.focus();
                e.preventDefault();
              }
            }
          }
        }
      });

      // Accessible media triggers inside modal
      const modalMedia = modal.querySelectorAll('.work-modal-scroll-area img, .work-modal-scroll-area .app-video-wrapper');
      modalMedia.forEach(el => {
        if (!el.closest('.work-modal-close') && !el.hasAttribute('tabindex')) {
          el.setAttribute('tabindex', '0');
          el.setAttribute('role', 'button');
          el.setAttribute('aria-haspopup', 'dialog');
          if (el.tagName === 'IMG') {
            const altText = el.getAttribute('alt') || 'Project image';
            if (!el.getAttribute('aria-label')) {
              el.setAttribute('aria-label', `View ${altText} in full screen preview`);
            }
          } else if (el.classList.contains('app-video-wrapper')) {
            if (!el.getAttribute('aria-label')) {
              el.setAttribute('aria-label', 'View video in full screen preview');
            }
          }
        }
      });

      // Keyboard trigger (Enter or Space) to open media in lightbox
      modal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const mediaEl = e.target && (e.target.matches('.work-modal-scroll-area img, .work-modal-scroll-area .app-video-wrapper') ? e.target : e.target.closest('.work-modal-scroll-area img, .work-modal-scroll-area .app-video-wrapper'));
          if (mediaEl && !mediaEl.closest('.work-modal-close')) {
            e.preventDefault();
            mediaEl.click();
          }
        }
      });

      // Forward backdrop wheel events into modal scroll area (desktop only)
      if (window.matchMedia('(min-width: 901px)').matches) {
        modal.addEventListener('wheel', (e) => {
          if (!e.target.closest('.work-modal-inner')) {
            if (scrollArea) {
              scrollArea.scrollTop += e.deltaY;
              e.preventDefault();
            }
          }
        }, { passive: false });
      }

      // Initialize video player if present
      initModalVideo(modal);
    }

    const openModal = (targetModal) => {
      if (targetModal) {
        if (removeModalTimer) {
          clearTimeout(removeModalTimer);
          removeModalTimer = null;
        }

        lastActiveModalTrigger = document.activeElement;
        activeModal = targetModal;

        // Force browser layout flush so transition runs smoothly
        void targetModal.offsetWidth;

        targetModal.classList.add('open');
        targetModal.setAttribute('aria-hidden', 'false');

        const modalId = targetModal.id;
        document.querySelectorAll(`[data-modal="${modalId}"]`).forEach(trig => {
          trig.setAttribute('aria-expanded', 'true');
        });

        const scrollArea = targetModal.querySelector('.work-modal-scroll-area');
        if (scrollArea) {
          scrollArea.scrollTop = 0;
        }
        updateModalState();
        updateSvgProgress(targetModal);
        updateStickyBorderPosition(targetModal);
        requestAnimationFrame(() => {
          updateSvgProgress(targetModal);
          updateStickyBorderPosition(targetModal);
        });
        setTimeout(() => {
          updateSvgProgress(targetModal);
          updateStickyBorderPosition(targetModal);
          const closeBtn = targetModal.querySelector('.work-modal-close, .modal-close');
          if (closeBtn) closeBtn.focus();
        }, 50);
      }
    };

    const openModalById = (modalId) => {
      if (!modalId) return;

      // If another modal is already open, close it first
      if (activeModal && activeModal.id !== modalId) {
        closeModal(activeModal, true); // immediate close
      }

      let targetModal = document.getElementById(modalId);
      if (!targetModal) {
        const tpl = document.getElementById('tpl-' + modalId);
        if (tpl) {
          const clone = tpl.content.cloneNode(true);
          modalContainer.appendChild(clone);
          targetModal = document.getElementById(modalId);
          if (targetModal) {
            setupModalListeners(targetModal);
          }
        }
      }

      if (targetModal) {
        openModal(targetModal);
      }
    };

    const closeModal = (modal, immediate = false) => {
      const targetModal = modal || activeModal;
      if (targetModal) {
        targetModal.classList.remove('open');
        targetModal.setAttribute('aria-hidden', 'true');

        const modalId = targetModal.id;
        document.querySelectorAll(`[data-modal="${modalId}"]`).forEach(trig => {
          trig.setAttribute('aria-expanded', 'false');
        });

        const videos = targetModal.querySelectorAll('video');
        videos.forEach(v => {
          try { v.pause(); } catch (e) { }
        });
        const videoWrappers = targetModal.querySelectorAll('.app-video-wrapper');
        videoWrappers.forEach(vw => vw.classList.remove('is-playing'));
        updateModalState();

        if (lastActiveModalTrigger && typeof lastActiveModalTrigger.focus === 'function') {
          lastActiveModalTrigger.focus();
          lastActiveModalTrigger = null;
        }

        const cleanup = () => {
          if (activeModalResizeObserver) {
            activeModalResizeObserver.disconnect();
            activeModalResizeObserver = null;
          }
          if (targetModal.parentNode) {
            targetModal.parentNode.removeChild(targetModal);
          }
          if (activeModal === targetModal) {
            activeModal = null;
          }
          removeModalTimer = null;
        };

        if (immediate) {
          cleanup();
        } else {
          // Wait for CSS fade-out transition (350ms) before releasing DOM nodes
          if (removeModalTimer) clearTimeout(removeModalTimer);
          removeModalTimer = setTimeout(cleanup, 360);
        }
      }
    };

    // Global modal trigger delegation (only clicking active image or mobile list item opens modal)
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('.work-img-slide.active, .works-list-item, .work-img-wrap');
      if (trigger && !e.target.closest('.work-modal')) {
        const modalId = trigger.getAttribute('data-modal') || (trigger.closest('[data-modal]') ? trigger.closest('[data-modal]').getAttribute('data-modal') : 'modal-nzxt');
        if (modalId) {
          e.preventDefault();
          openModalById(modalId);
        }
      }
    });

    // Keyboard trigger (Enter or Space) on works-list-item or work-img-wrap
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && (e.target.matches('.works-list-item, .work-img-wrap') || e.target.closest('.works-list-item, .work-img-wrap'))) {
        const trigger = e.target.matches('.works-list-item, .work-img-wrap') ? e.target : e.target.closest('.works-list-item, .work-img-wrap');
        if (trigger && !e.target.closest('.work-modal')) {
          e.preventDefault();
          trigger.click();
        }
      }
    });

    window.addEventListener('resize', () => {
      if (activeModal) {
        updateSvgProgress(activeModal);
        updateStickyBorderPosition(activeModal);
      }
    }, { passive: true });

    // Close on Escape key press
    window.addEventListener('keydown', (e) => {
      // If lightbox is open, let the lightbox handle Escape to return to modal
      if (document.body.classList.contains('lightbox-is-open') || document.querySelector('.image-lightbox.is-open')) {
        return;
      }
      if (e.key === 'Escape' && activeModal && activeModal.classList.contains('open')) {
        closeModal(activeModal);
      }
    });
  })();

  // --- Tablet Works Section: Reveal & Scroll-Scrub Animation ---
  (function initTabletWorksScroll() {
    const worksSection = document.getElementById('works');
    const worksList = document.querySelector('.works-mobile-list');
    if (!worksSection || !worksList) return;

    function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function mapRange(val, inMin, inMax, outMin, outMax) {
      const t = Math.max(0, Math.min(1, (val - inMin) / (inMax - inMin)));
      return outMin + t * (outMax - outMin);
    }

    let rafId = null;

    function update() {
      rafId = null;
      const slideItems = Array.from(worksList.querySelectorAll('.works-list-item'));
      const handEl = worksList.querySelector('.works-list-hand');
      if (window.innerWidth > 1024) {
        worksList.style.removeProperty('--works-list-x');
        worksList.style.removeProperty('--works-list-opacity');
        worksList.style.removeProperty('--works-hand-opacity');
        slideItems.forEach(item => {
          item.style.removeProperty('--item-x');
          item.style.removeProperty('--item-opacity');
        });
        if (handEl) {
          handEl.style.removeProperty('--item-opacity');
        }
        return;
      }

      const rect = worksSection.getBoundingClientRect();
      const scrollHeight = worksSection.offsetHeight - window.innerHeight;
      const scrolled = Math.max(0, -rect.top);
      const p = scrollHeight > 0 ? Math.min(1, scrolled / scrollHeight) : 0;

      // Staggered cascade for work list items only (slide in/out):
      // Enter Phase: 0.06 -> 0.40 (staggered from left -100vw -> 0vw) — widened for less sensitivity
      // Magnetic Pin / Hold: 0.40 -> 0.58 (held at 0vw, opacity 1)
      // Exit Phase: 0.58 -> 0.94 (staggered to right 0vw -> +100vw)
      slideItems.forEach((item, i) => {
        const enterStart = 0.06 + i * 0.04;
        const enterEnd = enterStart + 0.20;
        const exitStart = 0.60 + i * 0.04;
        const exitEnd = exitStart + 0.20;

        let xVw = 0;
        let opacity = 1;

        if (p < enterStart) {
          xVw = -100;
          opacity = 0;
        } else if (p < enterEnd) {
          const t = easeInOut(mapRange(p, enterStart, enterEnd, 0, 1));
          xVw = -100 * (1 - t);
          opacity = t;
        } else if (p < exitStart) {
          xVw = 0;
          opacity = 1;
        } else if (p < exitEnd) {
          const t = easeInOut(mapRange(p, exitStart, exitEnd, 0, 1));
          xVw = 100 * t;
          opacity = 1 - t;
        } else {
          xVw = 100;
          opacity = 0;
        }

        item.style.setProperty('--item-x', `${xVw.toFixed(2)}vw`);
        item.style.setProperty('--item-opacity', opacity.toFixed(4));
      });

      // Hand SVG: fade in/out — widened ranges for less sensitivity
      // Enter: 0.08 -> 0.32 (fade in), Hold: 0.32 -> 0.62, Exit: 0.62 -> 0.92 (fade out)
      if (handEl) {
        let handOpacity = 1;
        if (p < 0.08) {
          handOpacity = 0;
        } else if (p < 0.32) {
          handOpacity = easeInOut(mapRange(p, 0.08, 0.32, 0, 1));
        } else if (p < 0.62) {
          handOpacity = 1;
        } else if (p < 0.92) {
          handOpacity = 1 - easeInOut(mapRange(p, 0.62, 0.92, 0, 1));
        } else {
          handOpacity = 0;
        }
        handEl.style.setProperty('--item-opacity', handOpacity.toFixed(4));
      }

      worksList.style.setProperty('--works-list-opacity', '1');
      worksList.style.setProperty('--works-hand-opacity', '1');
    }

    function onScroll() {
      if (!rafId) rafId = requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  })();

  // --- About Section: Reveal Animation (desktop/tablet scroll-scrub / mobile fade-up) ---
  (function initAboutScrollReveal() {
    const section = document.getElementById('about');
    const card = document.querySelector('.about-card');
    if (!section || !card) return;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function mapRange(val, inMin, inMax, outMin, outMax) {
      const t = Math.max(0, Math.min(1, (val - inMin) / (inMax - inMin)));
      return outMin + t * (outMax - outMin);
    }

    // ── Shared: fully-visible state writer ───────────────────────────────────
    function setFullyVisible() {
      card.style.setProperty('--about-layer-opacity', '1');
      card.style.setProperty('--about-hand-opacity', '1');
      card.style.setProperty('--about-icons-opacity', '1');
      card.style.setProperty('--about-header-x', '0vw');
      card.style.setProperty('--about-header-opacity', '1');
      card.style.setProperty('--about-footer-x', '0vw');
      card.style.setProperty('--about-footer-opacity', '1');
    }

    // ── DESKTOP, TABLET & MOBILE: scroll-scrubbed cinematic reveal ───────────
    function initDesktopReveal() {
      let rafId = null;

      function update() {
        rafId = null;

        const isMobileOrTablet = window.innerWidth <= 1024;
        let p = 0;
        if (isMobileOrTablet) {
          const rect = section.getBoundingClientRect();
          const scrollHeight = section.offsetHeight - getViewportHeight();
          const scrolled = Math.max(0, -rect.top);
          p = scrollHeight > 0 ? Math.min(1, scrolled / scrollHeight) : 0;
        } else {
          const sectionTop = section.getBoundingClientRect().top + window.scrollY;
          const scrollHeight = section.offsetHeight - getViewportHeight();
          const scrolled = Math.max(0, window.scrollY - sectionTop);
          p = scrollHeight > 0 ? Math.min(1, scrolled / scrollHeight) : 0;
        }

        // Hand SVG: Enters, Holds, Exits — mobile ranges widened for less sensitivity
        const handOpacity = isMobileOrTablet
          ? (p < 0.08 ? 0 : (p < 0.32 ? easeInOut(mapRange(p, 0.08, 0.32, 0, 1)) : (p > 0.66 ? 1 - easeInOut(mapRange(p, 0.66, 0.92, 0, 1)) : 1)))
          : (p < 0.10 ? easeInOut(mapRange(p, 0, 0.10, 0, 1)) : (p > 0.88 ? 1 - easeInOut(mapRange(p, 0.88, 0.98, 0, 1)) : 1));

        // Tool Icons: Enters, Holds, Exits — mobile ranges widened
        const iconsOpacity = isMobileOrTablet
          ? (p < 0.10 ? 0 : (p < 0.32 ? easeInOut(mapRange(p, 0.10, 0.32, 0, 1)) : (p > 0.66 ? 1 - easeInOut(mapRange(p, 0.66, 0.92, 0, 1)) : 1)))
          : (p < 0.02 ? 0 : (p < 0.15 ? easeInOut(mapRange(p, 0.02, 0.15, 0, 1)) : (p > 0.85 ? 1 - easeInOut(mapRange(p, 0.85, 0.98, 0, 1)) : 1)));

        // Header: slides in/out — mobile ranges widened
        const headerXvw = isMobileOrTablet
          ? (p < 0.06 ? -100 : (p < 0.30 ? -100 + easeInOut(mapRange(p, 0.06, 0.30, 0, 1)) * 100 : (p < 0.66 ? 0 : -(easeInOut(mapRange(p, 0.66, 0.94, 0, 1)) * 100))))
          : (p < 0.02 ? -110 : (p < 0.15 ? -110 + easeInOut(mapRange(p, 0.02, 0.15, 0, 1)) * 110 : (p < 0.85 ? 0 : -(easeInOut(mapRange(p, 0.85, 1.0, 0, 1)) * 110))));

        const headerOpacity = isMobileOrTablet
          ? (p < 0.06 ? 0 : (p < 0.30 ? easeInOut(mapRange(p, 0.06, 0.30, 0, 1)) : (p < 0.66 ? 1 : 1 - easeInOut(mapRange(p, 0.66, 0.94, 0, 1)))))
          : (p < 0.02 ? 0 : (p < 0.15 ? easeInOut(mapRange(p, 0.02, 0.15, 0, 1)) : (p < 0.85 ? 1 : 1 - easeInOut(mapRange(p, 0.85, 1.0, 0, 1)))));

        // Footer: slides in/out — mobile ranges widened
        const footerXvw = isMobileOrTablet
          ? (p < 0.06 ? 100 : (p < 0.30 ? 100 - easeInOut(mapRange(p, 0.06, 0.30, 0, 1)) * 100 : (p < 0.66 ? 0 : +(easeInOut(mapRange(p, 0.66, 0.94, 0, 1)) * 100))))
          : (p < 0.02 ? 110 : (p < 0.15 ? 110 - easeInOut(mapRange(p, 0.02, 0.15, 0, 1)) * 110 : (p < 0.85 ? 0 : +(easeInOut(mapRange(p, 0.85, 1.0, 0, 1)) * 110))));

        const footerOpacity = isMobileOrTablet
          ? (p < 0.06 ? 0 : (p < 0.30 ? easeInOut(mapRange(p, 0.06, 0.30, 0, 1)) : (p < 0.66 ? 1 : 1 - easeInOut(mapRange(p, 0.66, 0.94, 0, 1)))))
          : (p < 0.02 ? 0 : (p < 0.15 ? easeInOut(mapRange(p, 0.02, 0.15, 0, 1)) : (p < 0.85 ? 1 : 1 - easeInOut(mapRange(p, 0.85, 1.0, 0, 1)))));


        // ── Desktop Hand Rotation (Starts pointing to skills/tools, then rotates down to point right) ──
        function getAboutStartAngle() {
          const toolsSidebar = document.querySelector('.about-tools-sidebar');
          const firstHand = document.querySelector('.about-hand-graphic');
          if (!toolsSidebar || !firstHand) return -112;
          const handRect = firstHand.getBoundingClientRect();
          const handCenterX = handRect.left + handRect.width / 2;
          const handCenterY = handRect.top + handRect.height / 2;
          const toolsRect = toolsSidebar.getBoundingClientRect();
          const toolsCenterX = toolsRect.left + toolsRect.width / 2;
          const toolsCenterY = toolsRect.top + toolsRect.height / 2;
          const dx = toolsCenterX - handCenterX;
          const dy = toolsCenterY - handCenterY;
          if (dx <= 0) return -112;
          const deg = Math.atan2(dy, dx) * (180 / Math.PI) - 90;
          return deg;
        }

        const startAngle = getAboutStartAngle();
        const activeAngle = -90;

        let handRotate = activeAngle;
        if (!isMobileOrTablet) {
          if (p < 0.02) {
            handRotate = startAngle;
          } else if (p < 0.16) {
            const enterT = easeInOut(mapRange(p, 0.02, 0.16, 0, 1));
            handRotate = startAngle * (1 - enterT) + activeAngle * enterT;
          } else if (p > 0.85) {
            const exitT = easeInOut(mapRange(p, 0.85, 0.98, 0, 1));
            handRotate = activeAngle + 15 * exitT;
          } else {
            handRotate = activeAngle;
          }
        }

        card.style.setProperty('--about-layer-opacity', handOpacity.toFixed(4));
        card.style.setProperty('--about-hand-opacity', handOpacity.toFixed(4));
        card.style.setProperty('--about-hand-rotate', `${handRotate.toFixed(2)}deg`);
        card.style.setProperty('--about-icons-opacity', iconsOpacity.toFixed(4));
        card.style.setProperty('--about-header-x', `${headerXvw.toFixed(2)}vw`);
        card.style.setProperty('--about-header-opacity', headerOpacity.toFixed(4));
        card.style.setProperty('--about-footer-x', `${footerXvw.toFixed(2)}vw`);
        card.style.setProperty('--about-footer-opacity', headerOpacity.toFixed(4));
      }

      function onScroll() {
        if (!rafId) rafId = requestAnimationFrame(update);
      }

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      update();
    }

    // ── Run scroll-scrubbed cinematic reveal on all viewports (desktop, tablet, mobile) ──
    initDesktopReveal();
  })();

  // --- Contact Section: Reveal Animation (desktop scroll-scrub / mobile set visible) ---
  (function initContactScrollReveal() {
    const section = document.getElementById('contact');
    const card = document.querySelector('.contact-box');
    if (!section || !card) return;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function mapRange(val, inMin, inMax, outMin, outMax) {
      const t = Math.max(0, Math.min(1, (val - inMin) / (inMax - inMin)));
      return outMin + t * (outMax - outMin);
    }

    function setFullyVisible() {
      card.style.setProperty('--contact-head-opacity', '1');
      card.style.setProperty('--contact-head-rotate', '0deg');
      card.style.setProperty('--contact-location-opacity', '1');
      card.style.setProperty('--contact-headline-x', '0vw');
      card.style.setProperty('--contact-headline-opacity', '1');
      card.style.setProperty('--contact-icons-x', '0vw');
      card.style.setProperty('--contact-icons-opacity', '1');
    }

    let rafId = null;

    function update() {
      rafId = null;

      const isMobileOrTablet = window.innerWidth <= 1024;
      let p = 0;

      if (isMobileOrTablet) {
        const rect = section.getBoundingClientRect();
        const scrollHeight = section.offsetHeight - getViewportHeight();
        const scrolled = Math.max(0, -rect.top);
        p = scrollHeight > 0 ? Math.min(1, scrolled / scrollHeight) : 0;
      } else {
        const sectionTop = section.getBoundingClientRect().top + window.scrollY;
        const scrollHeight = section.offsetHeight - getViewportHeight();
        const scrolled = Math.max(0, window.scrollY - sectionTop);
        p = scrollHeight > 0 ? Math.min(1, scrolled / scrollHeight) : 0;
      }

      // 1. Head SVG: Fades in & rotates — mobile ranges widened for less sensitivity
      const headOpacity = isMobileOrTablet
        ? (p < 0.06 ? 0 : (p < 0.32 ? easeInOut(mapRange(p, 0.06, 0.32, 0, 1)) : 1))
        : (p < 0.10 ? easeInOut(mapRange(p, 0.00, 0.10, 0, 1)) : 1);

      const headRotateDeg = isMobileOrTablet
        ? (p < 0.06 ? -30 : (p < 0.32 ? -30 + easeInOut(mapRange(p, 0.06, 0.32, 0, 1)) * 30 : 0))
        : (p < 0.02 ? -30 : (p < 0.16 ? -30 + easeInOut(mapRange(p, 0.02, 0.16, 0, 1)) * 30 : 0));

      // 2. Location text: Fades in — mobile range widened
      const locationOpacity = isMobileOrTablet
        ? (p < 0.08 ? 0 : (p < 0.32 ? easeInOut(mapRange(p, 0.08, 0.32, 0, 1)) : 1))
        : (p < 0.04 ? 0 : (p < 0.15 ? easeInOut(mapRange(p, 0.04, 0.15, 0, 1)) : 1));

      // 3. "Get in touch": Slides in from left — mobile range widened
      const headlineXvw = isMobileOrTablet
        ? (p < 0.06 ? -100 : (p < 0.32 ? -100 + easeInOut(mapRange(p, 0.06, 0.32, 0, 1)) * 100 : 0))
        : (p < 0.02 ? -110 : (p < 0.15 ? -110 + easeInOut(mapRange(p, 0.02, 0.15, 0, 1)) * 110 : 0));

      const headlineOpacity = isMobileOrTablet
        ? (p < 0.06 ? 0 : (p < 0.32 ? easeInOut(mapRange(p, 0.06, 0.32, 0, 1)) : 1))
        : (p < 0.02 ? 0 : (p < 0.15 ? easeInOut(mapRange(p, 0.02, 0.15, 0, 1)) : 1));

      // 4. Icons list: Slides in from right — mobile range widened
      const iconsXvw = isMobileOrTablet
        ? (p < 0.08 ? 100 : (p < 0.35 ? 100 - easeInOut(mapRange(p, 0.08, 0.35, 0, 1)) * 100 : 0))
        : (p < 0.04 ? 110 : (p < 0.18 ? 110 - easeInOut(mapRange(p, 0.04, 0.18, 0, 1)) * 110 : 0));

      const iconsOpacity = isMobileOrTablet
        ? (p < 0.08 ? 0 : (p < 0.35 ? easeInOut(mapRange(p, 0.08, 0.35, 0, 1)) : 1))
        : (p < 0.04 ? 0 : (p < 0.18 ? easeInOut(mapRange(p, 0.04, 0.18, 0, 1)) : 1));

      card.style.setProperty('--contact-head-opacity', headOpacity.toFixed(4));
      card.style.setProperty('--contact-head-rotate', `${headRotateDeg.toFixed(2)}deg`);
      card.style.setProperty('--contact-location-opacity', locationOpacity.toFixed(4));
      card.style.setProperty('--contact-headline-x', `${headlineXvw.toFixed(2)}vw`);
      card.style.setProperty('--contact-headline-opacity', headlineOpacity.toFixed(4));
      card.style.setProperty('--contact-icons-x', `${iconsXvw.toFixed(2)}vw`);
      card.style.setProperty('--contact-icons-opacity', iconsOpacity.toFixed(4));
    }

    function onScroll() {
      if (!rafId) rafId = requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  })();

  // --- Mobile Floating Navigation Menu & Desktop Fixed Navbar ---
  (function initGlobalNavigation() {
    const mobileNavbar = document.querySelector('.mobile-navbar');
    const desktopNavbar = document.querySelector('.desktop-navbar');
    const toggleBtn = document.querySelector('.mobile-nav-toggle');
    const closeBtn = document.querySelector('.mobile-dropdown-close');
    const logoBtn = document.querySelector('.mobile-nav-logo');
    const heroSection = document.getElementById('hero');
    const aboutSection = document.getElementById('about');
    const worksSection = document.getElementById('works');
    const contactSection = document.getElementById('contact');

    function getSectionTargetY(targetId) {
      if (!targetId || targetId === '#hero') return 0;
      const targetSection = document.querySelector(targetId);
      if (!targetSection) return 0;
      const sectionTop = targetSection.getBoundingClientRect().top + window.scrollY;
      const scrollHeight = targetSection.offsetHeight - window.innerHeight;
      if (scrollHeight <= 0) return sectionTop;
      const isMobileOrTablet = window.innerWidth <= 1024;
      if (targetId === '#works') {
        return sectionTop + (isMobileOrTablet ? 0.5 : 0.16) * scrollHeight;
      }
      return sectionTop + 0.5 * scrollHeight;
    }

    function closeMobileMenu() {
      if (!mobileNavbar || !mobileNavbar.classList.contains('open') || mobileNavbar.classList.contains('closing')) return;
      mobileNavbar.classList.add('closing');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
      const drawer = document.getElementById('mobile-open-state');
      if (drawer) drawer.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        mobileNavbar.classList.remove('open');
        mobileNavbar.classList.remove('closing');
        if (toggleBtn) toggleBtn.focus();
      }, 320);
    }

    if (mobileNavbar && toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (mobileNavbar.classList.contains('open')) {
          closeMobileMenu();
        } else {
          mobileNavbar.classList.remove('closing');
          mobileNavbar.classList.add('open');
          toggleBtn.setAttribute('aria-expanded', 'true');
          const drawer = document.getElementById('mobile-open-state');
          if (drawer) drawer.setAttribute('aria-hidden', 'false');
          if (closeBtn) {
            setTimeout(() => closeBtn.focus(), 50);
          }
        }
      });
    }

    if (mobileNavbar && closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMobileMenu();
      });
    }

    // Escape and Tab focus management for mobile menu
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNavbar && mobileNavbar.classList.contains('open')) {
        closeMobileMenu();
      }
    });

    if (mobileNavbar) {
      mobileNavbar.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && mobileNavbar.classList.contains('open')) {
          const focusable = mobileNavbar.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
          if (focusable.length > 0) {
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
              if (document.activeElement === first || !mobileNavbar.contains(document.activeElement)) {
                last.focus();
                e.preventDefault();
              }
            } else {
              if (document.activeElement === last) {
                first.focus();
                e.preventDefault();
              }
            }
          }
        }
      });
    }

    // Logo click smooth scrolls to previous section (Contact -> Works -> About -> Hero)
    if (logoBtn) {
      logoBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          logoBtn.click();
        }
      });
      logoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const currentY = window.scrollY;
        let prevTargetY = 0;

        const contactTop = contactSection ? (contactSection.getBoundingClientRect().top + currentY) : Infinity;
        const worksTop = worksSection ? (worksSection.getBoundingClientRect().top + currentY) : Infinity;
        const aboutTop = aboutSection ? (aboutSection.getBoundingClientRect().top + currentY) : Infinity;

        if (currentY >= contactTop - 120) {
          prevTargetY = getSectionTargetY('#works');
        } else if (currentY >= worksTop - 120) {
          prevTargetY = getSectionTargetY('#about');
        } else if (currentY >= aboutTop - 120) {
          prevTargetY = 0;
        } else {
          prevTargetY = 0;
        }

        window.scrollTo({ top: prevTargetY, behavior: 'smooth' });
        closeMobileMenu();
      });
    }

    // Close mobile dropdown when clicking outside it
    document.addEventListener('click', (e) => {
      if (mobileNavbar && mobileNavbar.classList.contains('open')) {
        if (!mobileNavbar.contains(e.target)) {
          closeMobileMenu();
        }
      }
    });

    // Bind smooth scrolling for all nav links (mobile dropdown, desktop bar)
    const navLinks = document.querySelectorAll('.mobile-dropdown-link, .desktop-nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        if (mobileNavbar && mobileNavbar.classList.contains('open')) {
          closeMobileMenu();
        }
        e.preventDefault();
        const targetId = link.getAttribute('href');
        if (targetId === '#about' || targetId === '#works' || targetId === '#contact' || targetId === '#hero') {
          const targetY = getSectionTargetY(targetId);
          window.scrollTo({ top: targetY, behavior: 'smooth' });
        } else {
          const targetElement = document.querySelector(targetId);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' });
          }
        }
        // Close mobile menu if it's a mobile link
        if (link.classList.contains('mobile-dropdown-link') && mobileNavbar) {
          mobileNavbar.classList.remove('open');
        }
      });
    });

    // Dynamic active state highlighting and navbar visibility trigger
    const mobileLinks = document.querySelectorAll('.mobile-dropdown-link');
    const desktopLinks = document.querySelectorAll('.desktop-nav-link');
    const sections = document.querySelectorAll('section[id]');

    function handleScrollUpdates() {
      const scrollY = window.scrollY;
      let pastHero = false;
      if (heroSection) {
        const heroSectionTop = heroSection.getBoundingClientRect().top + window.scrollY;
        const heroScrollHeight = heroSection.offsetHeight - window.innerHeight;
        // Hero animation reaches 100% (black logo covers frame) when scrolled >= heroScrollHeight
        const heroProgress = heroScrollHeight > 0 ? (scrollY - heroSectionTop) / heroScrollHeight : 0;
        pastHero = heroProgress >= 0.999;
      } else {
        const threshold = aboutSection ? aboutSection.offsetTop - 100 : 0;
        pastHero = scrollY >= threshold;
      }

      // --- Mobile navbar visibility ---
      if (mobileNavbar) {
        if (pastHero) {
          mobileNavbar.classList.add('visible');
        } else {
          mobileNavbar.classList.remove('visible');
          mobileNavbar.classList.remove('open');
        }
      }

      // --- Desktop navbar visibility ---
      // Only show when in About, Works, or Contact sections (past hero, before end of contact)
      const endY = contactSection
        ? contactSection.offsetTop + contactSection.offsetHeight
        : document.body.scrollHeight;
      const inTargetSections = pastHero && scrollY < endY;

      if (desktopNavbar) {
        if (document.body.classList.contains('modal-is-open')) {
          desktopNavbar.classList.remove('visible');
        } else if (inTargetSections) {
          desktopNavbar.classList.remove('no-transition');
          desktopNavbar.classList.add('visible');
        } else {
          if (!pastHero) {
            // Immediately hide when returning to hero to eliminate afterimage
            desktopNavbar.classList.add('no-transition');
          } else {
            desktopNavbar.classList.remove('no-transition');
          }
          desktopNavbar.classList.remove('visible');
        }
      }

      // --- Canvas UI WebGL background visibility (About, Works, Contact black area) ---
      if (window.canvasUIInstance) {
        // immediate = true when exiting to avoid afterimage over hero clouds
        window.canvasUIInstance.setVisible(inTargetSections, !inTargetSections);
      }

      // --- Solid continuous dark background fallback for sticky container ---
      const stickyHeroContainer = document.querySelector('.hero-canvas-sticky');
      if (stickyHeroContainer) {
        if (pastHero) {
          stickyHeroContainer.classList.add('is-dark');
        } else {
          stickyHeroContainer.classList.remove('is-dark');
        }
      }

      // --- Active section highlighting ---
      let currentSectionId = '';
      const scrollPosition = scrollY + window.innerHeight / 2;

      sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
          currentSectionId = section.getAttribute('id');
        }
      });

      // Update mobile links active class
      mobileLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${currentSectionId}`);
      });

      // Update desktop links active class
      desktopLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${currentSectionId}`);
      });
    }

    window.addEventListener('scroll', handleScrollUpdates, { passive: true });
    window.addEventListener('load', handleScrollUpdates);
    window.addEventListener('pageshow', handleScrollUpdates);
    handleScrollUpdates();
    requestAnimationFrame(() => {
      handleScrollUpdates();
      requestAnimationFrame(() => {
        handleScrollUpdates();
      });
    });
  })();

  // --- Behance-style Fullscreen Image & Video Lightbox & Zoom Viewer ---
  (function initImageLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    if (!lightbox) return;

    const imgEl = document.getElementById('image-lightbox-img');
    const videoEl = document.getElementById('image-lightbox-video');
    const container = document.getElementById('image-lightbox-container');
    const stage = document.getElementById('image-lightbox-stage');
    const backdrop = lightbox.querySelector('.image-lightbox-backdrop');
    const closeBtn = document.getElementById('lightbox-close');
    const prevBtn = document.getElementById('lightbox-prev');
    const nextBtn = document.getElementById('lightbox-next');
    const currIdxEl = document.getElementById('lightbox-curr-idx');
    const totalCountEl = document.getElementById('lightbox-total-count');

    let currentGallery = [];
    let currentIndex = 0;
    let isZoomed = false;
    let panX = 0;
    let panY = 0;
    let startX = 0;
    let startY = 0;
    let isDragging = false;

    function getModalMedia(modal) {
      if (!modal) return [];
      const elements = Array.from(modal.querySelectorAll('.work-modal-scroll-area img, .work-modal-scroll-area .app-video-wrapper'));
      const mediaList = [];
      elements.forEach(el => {
        if (el.tagName === 'IMG') {
          if (el.src && !el.closest('.work-modal-close') && !el.closest('.app-video-wrapper')) {
            mediaList.push({ type: 'image', element: el, src: el.currentSrc || el.src, alt: el.alt || 'Preview' });
          }
        } else if (el.classList.contains('app-video-wrapper')) {
          const vid = el.querySelector('video');
          if (vid && vid.src) {
            mediaList.push({ type: 'video', element: el, src: vid.src, videoElement: vid });
          }
        }
      });
      return mediaList;
    }

    let lastActiveLightboxTrigger = null;

    function openLightbox(mediaList, index) {
      if (!mediaList || mediaList.length === 0) return;
      currentIndex = Math.max(0, Math.min(index, mediaList.length - 1));
      currentGallery = mediaList;
      lastActiveLightboxTrigger = (mediaList[currentIndex] && mediaList[currentIndex].element)
        ? mediaList[currentIndex].element
        : document.activeElement;
      showMedia(currentIndex);
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-is-open');
      document.addEventListener('keydown', onKeyDown);
      setTimeout(() => {
        if (closeBtn) closeBtn.focus();
        else lightbox.focus();
      }, 50);
    }

    function closeLightbox() {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('lightbox-is-open');
      if (videoEl) {
        videoEl.pause();
        videoEl.src = '';
      }
      resetZoom();
      document.removeEventListener('keydown', onKeyDown);

      // Restore position in modal to the media where the user last stopped
      const targetElement = (currentGallery && currentGallery[currentIndex] && currentGallery[currentIndex].element)
        ? currentGallery[currentIndex].element
        : lastActiveLightboxTrigger;

      if (targetElement) {
        try {
          targetElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (err) { }

        if (typeof targetElement.focus === 'function') {
          targetElement.focus({ preventScroll: true });
        }
      }
      lastActiveLightboxTrigger = null;
    }

    function showMedia(idx) {
      if (!currentGallery[idx]) return;
      currentIndex = idx;
      resetZoom();
      const item = currentGallery[idx];

      if (item.type === 'video') {
        lightbox.classList.add('has-video');
        if (videoEl) {
          videoEl.src = item.src;
          videoEl.play().catch(() => { });
        }
      } else {
        lightbox.classList.remove('has-video');
        if (videoEl) {
          videoEl.pause();
          videoEl.src = '';
        }
        imgEl.src = item.src;
        imgEl.alt = item.alt;
      }

      const pad2 = (n) => String(n).padStart(2, '0');
      if (currIdxEl) currIdxEl.textContent = pad2(currentIndex + 1);
      if (totalCountEl) totalCountEl.textContent = pad2(currentGallery.length);
      if (prevBtn) prevBtn.style.display = currentGallery.length > 1 ? 'flex' : 'none';
      if (nextBtn) nextBtn.style.display = currentGallery.length > 1 ? 'flex' : 'none';
    }

    function prevMedia() {
      if (currentGallery.length <= 1) return;
      const nextIdx = (currentIndex - 1 + currentGallery.length) % currentGallery.length;
      showMedia(nextIdx);
    }

    function nextMedia() {
      if (currentGallery.length <= 1) return;
      const nextIdx = (currentIndex + 1) % currentGallery.length;
      showMedia(nextIdx);
    }

    let currentScale = 1.0;
    let touchStartDist = 0;
    let touchStartScale = 1.0;
    let touchStartX = 0;
    let touchStartY = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let isTouchGesturing = false;
    let touchMoved = false;

    function resetZoom() {
      currentScale = 1.0;
      panX = 0;
      panY = 0;
      isDragging = false;
      isTouchGesturing = false;
      lightbox.classList.remove('is-zoomed');
      lightbox.classList.remove('is-shrunk');
      lightbox.classList.remove('is-dragging');
      lightbox.classList.remove('is-gesturing');
      if (stage) {
        stage.style.transform = '';
      }
    }

    function updateTransform() {
      if (!stage) return;
      if (currentScale > 1.02) {
        lightbox.classList.add('is-zoomed');
      } else {
        lightbox.classList.remove('is-zoomed');
      }
      lightbox.classList.remove('is-shrunk');
      stage.style.transform = `translate3d(${panX.toFixed(2)}px, ${panY.toFixed(2)}px, 0) scale(${currentScale.toFixed(4)})`;
    }

    function clampPan() {
      if (currentScale <= 1.02) {
        panX = 0;
        panY = 0;
        return;
      }
      const imgW = imgEl ? (imgEl.offsetWidth || 0) : (stage ? stage.offsetWidth : 0);
      const imgH = imgEl ? (imgEl.offsetHeight || 0) : (stage ? stage.offsetHeight : 0);
      const scaledW = imgW * currentScale;
      const scaledH = imgH * currentScale;
      const containerW = container ? container.clientWidth : window.innerWidth;
      const containerH = container ? container.clientHeight : window.innerHeight;

      // Generous buffer (64px) allows dragging edges completely away from screen margins and bottom pill
      const bufferX = 64;
      const bufferY = 64;
      const maxPanX = Math.max(bufferX, Math.abs(scaledW - containerW) / 2 + bufferX);
      const maxPanY = Math.max(bufferY, Math.abs(scaledH - containerH) / 2 + bufferY);

      panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
      panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
    }

    function toggleZoom(focalX, focalY) {
      if (lightbox.classList.contains('has-video')) return;
      if (currentScale > 1.05) {
        resetZoom();
      } else {
        currentScale = 1.5;
        panX = 0;
        panY = 0;
        updateTransform();
      }
    }

    // --- Desktop Mouse Drag / Pan & Double-Click ---
    container.addEventListener('mousedown', (e) => {
      if (e.target === closeBtn || e.target.closest('#lightbox-close') ||
        e.target === prevBtn || e.target.closest('#lightbox-prev') ||
        e.target === nextBtn || e.target.closest('#lightbox-next') ||
        e.target === videoEl || e.target.closest('video')) {
        return;
      }
      if (currentScale <= 1.02) return;
      isDragging = true;
      lightbox.classList.add('is-dragging');
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging || currentScale <= 1.02) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      clampPan();
      updateTransform();
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        lightbox.classList.remove('is-dragging');
        clampPan();
        updateTransform();
      }
    });

    container.addEventListener('dblclick', (e) => {
      if (e.target === imgEl) {
        toggleZoom(e.clientX, e.clientY);
      }
    });

    // --- Trackpad Pinch & Mouse Wheel Zoom (min 1.0x to max 1.5x) ---
    container.addEventListener('wheel', (e) => {
      if (lightbox.classList.contains('has-video')) return;
      e.preventDefault();
      const zoomFactor = e.ctrlKey ? (1 - e.deltaY * 0.015) : (e.deltaY < 0 ? 1.15 : 0.87);
      currentScale = Math.max(1.0, Math.min(1.5, currentScale * zoomFactor));
      if (currentScale <= 1.02) {
        resetZoom();
      } else {
        clampPan();
        updateTransform();
      }
    }, { passive: false });

    // --- Multi-Touch Gestures (Pinch-to-zoom max 1.5x, min 1.0x, Pan) + Swipe-to-Navigate ---
    let swipeOffsetX = 0; // tracks horizontal swipe drag for visual feedback
    let isSwipeTracking = false; // true when tracking a potential swipe (not zoomed, single finger)

    container.addEventListener('touchstart', (e) => {
      if (e.target === closeBtn || e.target.closest('#lightbox-close') ||
        e.target === prevBtn || e.target.closest('#lightbox-prev') ||
        e.target === nextBtn || e.target.closest('#lightbox-next') ||
        e.target === videoEl || e.target.closest('video')) {
        return;
      }
      if (lightbox.classList.contains('has-video')) return;

      if (e.touches.length === 2) {
        isSwipeTracking = false;
        isTouchGesturing = true;
        lightbox.classList.add('is-gesturing');
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartScale = currentScale;
        lastTouchX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        lastTouchY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        touchMoved = true;
        e.preventDefault();
      } else if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        touchMoved = false;
        swipeOffsetX = 0;

        if (currentScale > 1.02) {
          isSwipeTracking = false;
          isTouchGesturing = true;
          lightbox.classList.add('is-gesturing');
          e.preventDefault();
        } else {
          // Start tracking for a potential horizontal swipe
          isSwipeTracking = true;
          if (stage) stage.classList.add('swiping');
        }
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      // Swipe tracking mode (not zoomed, single finger)
      if (isSwipeTracking && e.touches.length === 1 && currentScale <= 1.02) {
        const curX = e.touches[0].clientX;
        const curY = e.touches[0].clientY;
        const deltaX = curX - touchStartX;
        const deltaY = curY - touchStartY;
        const absDX = Math.abs(deltaX);
        const absDY = Math.abs(deltaY);

        if (absDX > 8 || absDY > 8) touchMoved = true;

        // If dominantly horizontal, show drag feedback
        if (absDX > 10 && absDX > absDY * 1.2) {
          swipeOffsetX = deltaX;
          if (stage) {
            stage.style.transform = `translate3d(${swipeOffsetX.toFixed(1)}px, 0, 0)`;
          }
          e.preventDefault(); // prevent vertical scroll during horizontal swipe
        }
        return;
      }

      if (!isTouchGesturing && currentScale <= 1.02) {
        if (e.touches.length === 1) {
          const moveDist = Math.hypot(e.touches[0].clientX - touchStartX, e.touches[0].clientY - touchStartY);
          if (moveDist > 8) touchMoved = true;
        }
        return;
      }
      if (lightbox.classList.contains('has-video')) return;

      if (e.touches.length === 2) {
        touchMoved = true;
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (touchStartDist > 0) {
          const factor = dist / touchStartDist;
          currentScale = Math.max(1.0, Math.min(1.5, touchStartScale * factor));
        }
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        panX += midX - lastTouchX;
        panY += midY - lastTouchY;
        lastTouchX = midX;
        lastTouchY = midY;
        clampPan();
        updateTransform();
        e.preventDefault();
      } else if (e.touches.length === 1 && currentScale > 1.02) {
        touchMoved = true;
        const curX = e.touches[0].clientX;
        const curY = e.touches[0].clientY;
        panX += curX - lastTouchX;
        panY += curY - lastTouchY;
        lastTouchX = curX;
        lastTouchY = curY;
        clampPan();
        updateTransform();
        e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      // Handle swipe navigation commit
      if (isSwipeTracking && e.touches.length === 0) {
        isSwipeTracking = false;
        if (stage) stage.classList.remove('swiping');

        const SWIPE_THRESHOLD = 50;
        if (Math.abs(swipeOffsetX) > SWIPE_THRESHOLD && currentGallery.length > 1) {
          // Animate out in swipe direction, then show next/prev
          const direction = swipeOffsetX > 0 ? 'prev' : 'next';
          if (stage) {
            stage.style.transform = `translate3d(${swipeOffsetX > 0 ? '100%' : '-100%'}, 0, 0)`;
          }
          setTimeout(() => {
            if (direction === 'prev') prevMedia(); else nextMedia();
            // Snap in from opposite side
            if (stage) {
              stage.classList.add('swiping');
              stage.style.transform = `translate3d(${direction === 'prev' ? '-60%' : '60%'}, 0, 0)`;
              requestAnimationFrame(() => {
                stage.classList.remove('swiping');
                stage.style.transform = '';
              });
            }
          }, 180);
        } else {
          // Snap back — no navigation
          if (stage) stage.style.transform = '';
        }
        swipeOffsetX = 0;
        return;
      }

      if (e.touches.length === 0) {
        isTouchGesturing = false;
        lightbox.classList.remove('is-gesturing');
        if (currentScale <= 1.04) {
          resetZoom();
        } else {
          clampPan();
          updateTransform();
        }
      } else if (e.touches.length === 1) {
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      }
    });

    // Container click: toggle zoom or close if clicked backdrop
    container.addEventListener('click', (e) => {
      if (touchMoved) return;
      if (e.target === imgEl) {
        toggleZoom();
      } else if (e.target === container || e.target === backdrop) {
        closeLightbox();
      }
    });

    if (backdrop) backdrop.addEventListener('click', closeLightbox);
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prevMedia(); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); nextMedia(); });

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        prevMedia();
      } else if (e.key === 'ArrowRight') {
        nextMedia();
      } else if (e.key === 'Tab') {
        const focusable = lightbox.querySelectorAll('button:not([disabled]), [href], video[controls], [tabindex]:not([tabindex="-1"])');
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first || !lightbox.contains(document.activeElement)) {
              last.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === last) {
              first.focus();
              e.preventDefault();
            }
          }
        }
      }
    }

    // Global delegation for modal image or video wrapper clicks
    document.addEventListener('click', (e) => {
      const clickedMedia = e.target.closest('.work-modal-scroll-area img, .work-modal-scroll-area .app-video-wrapper');
      if (clickedMedia && !clickedMedia.closest('.work-modal-close')) {
        // If clicking video controls, let controls handle it
        if (e.target.closest('#app-video-controls') || e.target.closest('#app-video-play-btn')) return;
        const modal = clickedMedia.closest('.work-modal, .project-modal');
        if (modal) {
          const gallery = getModalMedia(modal);
          const index = gallery.findIndex(item => item.element === clickedMedia || item.element === clickedMedia.closest('.app-video-wrapper'));
          if (index !== -1) {
            openLightbox(gallery, index);
          }
        }
      }
    });
  })();

  // --- Pull-Down / Swipe-at-Top to Reload on Touch Devices ---
  (function initSwipeToReload() {
    let startY = 0;
    let isTracking = false;

    window.addEventListener('touchstart', (e) => {
      if (window.scrollY <= 5 && e.touches.length === 1) {
        startY = e.touches[0].clientY;
        isTracking = true;
      } else {
        isTracking = false;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!isTracking) return;
      const currentY = e.touches[0].clientY;
      const pullDistance = currentY - startY;

      // If user pulled down more than 120px at the top of the page
      if (window.scrollY <= 2 && pullDistance > 120) {
        isTracking = false;
        window.location.reload();
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      isTracking = false;
    }, { passive: true });
  })();

  // --- Gyroscope-Driven 3D Parallax Depth Effect (Phone & Tablet: <= 1024px) ---
  // True device orientation only — no touch drag fallback.
  // Tilting/rotating the phone drives the parallax depth layers.
  // NOTE: Transforms are applied as INLINE STYLES directly on .gyro-layer-base
  // and .gyro-layer-text elements to bypass CSS `transform: ... !important`
  // overrides in responsive media queries that would otherwise nullify the effect.
  (function initGyroscopeParallax() {
    const gyroCards = document.querySelectorAll('.gyro-card');
    if (!gyroCards || gyroCards.length === 0) return;

    // Collect all base and text layer elements across all gyro-cards
    const layerPairs = [];
    gyroCards.forEach(card => {
      const base = card.querySelector('.gyro-layer-base');
      const text = card.querySelector('.gyro-layer-text');
      if (base || text) {
        layerPairs.push({ card, base, text });
      }
    });
    if (layerPairs.length === 0) return;

    let isEnabled = false;
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;
    let currentBaseX = 0;
    let currentBaseY = 0;
    let currentTextX = 0;
    let currentTextY = 0;
    let animId = null;

    const MAX_TILT = 30; // Max 3D tilt in degrees (boosted for dramatic depth)
    const BASE_SHIFT = 22; // Base graphic shift amplitude in px (stronger layer separation)
    const TEXT_SHIFT = 48; // Floating yellow text shift amplitude in px (very pronounced parallax split)
    const LERP_FACTOR = 0.18; // Inertial spring smoothing (quicker response to tilt)
    const TEXT_Z = 48; // Z-depth offset for the text layer (px)

    function checkViewport() {
      return window.innerWidth <= 1024;
    }

    function applyValues() {
      const rotX = currentRotX.toFixed(2);
      const rotY = currentRotY.toFixed(2);
      const bx = currentBaseX.toFixed(2);
      const by = currentBaseY.toFixed(2);
      const tx = currentTextX.toFixed(2);
      const ty = currentTextY.toFixed(2);

      layerPairs.forEach(({ card, base, text }) => {
        // Apply perspective and preserve-3d inline on the card container
        // so it can't be overridden by any CSS !important rule
        card.style.perspective = '500px';
        card.style.transformStyle = 'preserve-3d';

        if (base) {
          base.style.transformStyle = 'preserve-3d';
          base.style.transform = `translate3d(${bx}px, ${by}px, 0px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        }
        if (text) {
          text.style.transformStyle = 'preserve-3d';
          text.style.transform = `translate3d(${tx}px, ${ty}px, ${TEXT_Z}px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
        }
      });
    }

    function resetValues() {
      targetRotX = 0;
      targetRotY = 0;
      currentRotX = 0;
      currentRotY = 0;
      currentBaseX = 0;
      currentBaseY = 0;
      currentTextX = 0;
      currentTextY = 0;

      // Clear inline transforms to restore default CSS positioning
      layerPairs.forEach(({ card, base, text }) => {
        card.style.perspective = '';
        card.style.transformStyle = '';
        if (base) {
          base.style.transformStyle = '';
          base.style.transform = '';
        }
        if (text) {
          text.style.transformStyle = '';
          text.style.transform = '';
        }
      });
    }

    function tick() {
      if (!checkViewport()) {
        resetValues();
        animId = null;
        return;
      }

      // Calculate target layer shifts from target rotations
      const targetBaseX = (targetRotY / MAX_TILT) * BASE_SHIFT;
      const targetBaseY = (-targetRotX / MAX_TILT) * BASE_SHIFT;
      const targetTextX = (targetRotY / MAX_TILT) * TEXT_SHIFT;
      const targetTextY = (-targetRotX / MAX_TILT) * TEXT_SHIFT;

      // Smooth lerp interpolation
      currentRotX += (targetRotX - currentRotX) * LERP_FACTOR;
      currentRotY += (targetRotY - currentRotY) * LERP_FACTOR;
      currentBaseX += (targetBaseX - currentBaseX) * LERP_FACTOR;
      currentBaseY += (targetBaseY - currentBaseY) * LERP_FACTOR;
      currentTextX += (targetTextX - currentTextX) * LERP_FACTOR;
      currentTextY += (targetTextY - currentTextY) * LERP_FACTOR;

      applyValues();

      animId = requestAnimationFrame(tick);
    }

    function startLoop() {
      if (!animId && checkViewport()) {
        animId = requestAnimationFrame(tick);
      }
    }

    function handleOrientation(e) {
      if (!checkViewport()) return;
      if (e.gamma === null || e.beta === null) return;

      // gamma: left-to-right tilt [-90, 90]
      // beta: front-to-back tilt [-180, 180], ~45deg is comfortable resting hand holding angle
      const gamma = Math.max(-45, Math.min(45, e.gamma || 0));
      const beta = Math.max(0, Math.min(90, e.beta || 45)) - 45;

      targetRotY = (gamma / 45) * MAX_TILT;
      targetRotX = -(beta / 45) * MAX_TILT;

      startLoop();
    }

    // iOS 13+ permission request on user interaction
    function requestPermissionAndStart() {
      if (isEnabled) return;
      isEnabled = true;

      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(permissionState => {
            if (permissionState === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation, { passive: true });
            }
          })
          .catch(() => {
            // Permission denied — no fallback, parallax simply won't activate
          });
      } else if ('ondeviceorientation' in window) {
        window.addEventListener('deviceorientation', handleOrientation, { passive: true });
      }

      startLoop();
    }

    // Bind auto-permission on first user interaction
    window.addEventListener('touchstart', requestPermissionAndStart, { once: true, passive: true });
    window.addEventListener('click', requestPermissionAndStart, { once: true, passive: true });

    // Handle resize
    window.addEventListener('resize', () => {
      if (!checkViewport()) {
        resetValues();
      } else {
        startLoop();
      }
    });

    // Initial trigger if supported immediately (e.g. Android)
    if ('ondeviceorientation' in window && !(typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function')) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
      startLoop();
    }
  })();

  // --- In-App Browser (WebView) Degradation & Banner ---
  (function initWebViewDegradation() {
    if (!window.isWebView) return;

    // 1. Prevent canvas-ui WebGL from initializing (already hidden via CSS .is-webview)
    //    Also prevent the JS instance from doing any work
    if (window.canvasUIInstance) {
      try { window.canvasUIInstance.setVisible(false, true); } catch (e) { }
    }

    // 2. Reduce will-change on heavy SVG elements to free compositor memory
    const heroSvg = document.querySelector('.hero-canvas-sticky svg');
    if (heroSvg) {
      heroSvg.style.willChange = 'auto';
    }

    // (Banner removed — portfolio works well enough in webviews without prompting)
  })();

});
