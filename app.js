/* ==========================================================================
   PORTFOLIO INTERACTIVE CORE ENGINE (app.js)
   ========================================================================== */

/* ==========================================================================
   0. HERO SCROLL-SCRUBBED FRAME ANIMATION
   Uses hero_section.svg inlined in the HTML.
   Technique: CSS animation-play-state:paused + negative animation-delay
   sets the exact frozen frame. Both are applied together on every scroll
   tick so the browser recomputes the frame — reliable across all browsers.
   ========================================================================== */
(function () {
  const container = document.querySelector('.hero-canvas-sticky');
  if (!container) return;

  function initHeroScroll(svgEl) {
    if (!svgEl) return;
    svgEl.id = 'hero-svg';

    const DURATION_S = 3; // matches the 3s animation duration in hero_section.svg
    const section = document.getElementById('hero');

    // Scale SVG to cover the full hero viewport (object-fit: cover)
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid slice');

    // All animated elements in hero_section.svg
    const targets = Array.from(svgEl.querySelectorAll(
      '#Vector, #Vector_2, #Vector_3, #Vector_4, #Vector_5, #Vector_6, ' +
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

    // Freeze at frame 0 immediately — no auto-play flash
    seekTo(0);

    let rafId = null;

    function onScroll() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!section) return;

        const sectionTop = section.getBoundingClientRect().top + window.scrollY;
        const sectionHeight = section.offsetHeight - window.innerHeight;
        const scrolled = Math.max(0, window.scrollY - sectionTop);
        const progress = sectionHeight > 0 ? Math.min(1, scrolled / sectionHeight) : 0;

        // Clamp to DURATION_S - 0.05s to prevent -3.0s % 3.0s wrap-around back to frame 0
        const seekTime = Math.min(DURATION_S - 0.05, progress * DURATION_S);
        seekTo(seekTime);
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // sync to current scroll position on load
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




/* ==========================================================================
   1. SMOOTH MARQUEE TICKER — clone-based, zero-gap infinite loop
   Supports multiple tracks; data-direction="right" reverses scroll direction.
   ========================================================================== */
(function () {
  function initMarquee() {
    const tracks = document.querySelectorAll('.marquee-ticker__track');
    if (!tracks.length) return;

    tracks.forEach(track => {
      const goRight = track.dataset.direction === 'right';
      let x = 0;
      const speed = 0.8;
      let loopWidth = 0;

      function buildTrack() {
        // 1. Remove previously-cloned aria-hidden items, keep originals
        track.querySelectorAll('[aria-hidden]').forEach(el => el.remove());

        // 2. Measure original set width before cloning
        const origItems = Array.from(track.children);
        loopWidth = track.scrollWidth;

        // 3. Clone until track covers 3× viewport — no gap on any screen
        while (track.scrollWidth < window.innerWidth * 3) {
          origItems.forEach(item => {
            const clone = item.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            track.appendChild(clone);
          });
        }

        // 4. For right-to-left direction, start at negative loopWidth so items
        //    enter from the right edge immediately (same visual as left ticker)
        if (goRight) x = -loopWidth;
      }

      function tick() {
        if (goRight) {
          x += speed;
          if (x >= 0) x = -loopWidth; // wrap back when fully scrolled right
        } else {
          x -= speed;
          if (-x >= loopWidth) x = 0; // wrap back when fully scrolled left
        }
        track.style.transform = `translate3d(${x}px, 0, 0)`;
        requestAnimationFrame(tick);
      }

      // Double-rAF: fonts must be rendered before measuring scrollWidth
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          buildTrack();
          requestAnimationFrame(tick);
        });
      });

      window.addEventListener('resize', () => {
        buildTrack();
        // Clamp x to new loopWidth bounds
        if (!goRight && -x >= loopWidth) x = 0;
        if (goRight && x >= 0) x = -loopWidth;
      }, { passive: true });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMarquee);
  } else {
    initMarquee();
  }
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
  // 6. PROJECT MODALS
  // ==========================================================================
  // Modal Open & Close Triggers
  const detailsBtns = document.querySelectorAll('.project-view-details');
  const modals = document.querySelectorAll('.project-modal');

  detailsBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-modal');
      const targetModal = document.getElementById(modalId);
      if (targetModal) {
        targetModal.classList.add('open');
        document.body.style.overflow = 'hidden'; // Lock background scroll
        document.documentElement.style.overflow = 'hidden';
      }
    });
  });

  const closeModal = (modal) => {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  };

  modals.forEach(modal => {
    const closes = modal.querySelectorAll('.modal-close, .modal-close-btn');
    closes.forEach(c => {
      c.addEventListener('click', () => closeModal(modal));
    });

    // Close modal on click background
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });


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
  // 9. SKILLS RADIAL PROGRESS ANIMATION — dynamic dashoffset draw on scroll
  // ==========================================================================
  const progressCircles = document.querySelectorAll('.skill-radial-progress');

  const skillObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const circle = entry.target;
      const rAttr = circle.getAttribute('r') || '45';
      const radius = parseFloat(rAttr);
      const circumference = 2 * Math.PI * radius;

      if (entry.isIntersecting) {
        const percent = parseInt(circle.getAttribute('data-percent') || '0', 10);
        // Calculate offset based on target percent
        const offset = circumference - (circumference * percent) / 100;

        // Set properties to trigger CSS transition
        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = `${offset}`;
      } else {
        // Reset properties to initial empty state when scrolled out
        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = `${circumference}`;
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -20px 0px'
  });

  progressCircles.forEach(circle => {
    const rAttr = circle.getAttribute('r') || '45';
    const radius = parseFloat(rAttr);
    const circumference = 2 * Math.PI * radius;

    // Set initial state to fully empty
    circle.style.strokeDasharray = `${circumference}`;
    circle.style.strokeDashoffset = `${circumference}`;

    // Start observing
    skillObserver.observe(circle);
  });


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

  // --- About Skill Slider Navigation Module (Sticky Scroll-Driven & Gauge Fill) ---
  (function initSkillSlider() {
    const aboutSection = document.getElementById('about');
    const slides = document.querySelectorAll('.skill-slide');
    const dots = document.querySelectorAll('.pagination-dot');
    const prevBtn = document.getElementById('about-prev-btn');
    const nextBtn = document.getElementById('about-next-btn');

    if (!aboutSection || !slides.length || !dots.length) return;

    let currentIndex = 0;

    // Set initial strokeDasharray on load
    slides.forEach(slide => {
      const circleProgress = slide.querySelector('.skill-gauge-progress');
      if (circleProgress) {
        const radius = 42;
        const circumference = 2 * Math.PI * radius; // ~263.89
        circleProgress.style.strokeDasharray = `${circumference}`;
        circleProgress.style.strokeDashoffset = `${circumference}`;
      }
    });

    function updateSliderState(progress) {
      const position = progress * (slides.length - 1);
      const activeIndex = Math.round(position);

      currentIndex = activeIndex;

      slides.forEach((slide, i) => {
        // Clean up any previously set style properties so CSS handles opacity/transform
        slide.style.opacity = '';
        slide.style.transform = '';
        slide.style.visibility = '';
        slide.style.pointerEvents = '';

        const circleProgress = slide.querySelector('.skill-gauge-progress');
        const textElem = slide.querySelector('.skill-gauge-text');
        
        if (i === activeIndex) {
          slide.classList.add('active');
          if (circleProgress) {
            const percent = parseInt(textElem ? textElem.textContent : '80', 10) || 80;
            const radius = 42;
            const circumference = 2 * Math.PI * radius;
            const targetOffset = circumference * (1 - (percent / 100));
            circleProgress.style.strokeDashoffset = `${targetOffset}`;
          }
        } else {
          slide.classList.remove('active');
          if (circleProgress) {
            const radius = 42;
            const circumference = 2 * Math.PI * radius;
            circleProgress.style.strokeDashoffset = `${circumference}`;
          }
        }
      });

      dots.forEach((dot, i) => {
        if (i === activeIndex) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }

    function scrollByStep(targetIndex) {
      if (targetIndex < 0) targetIndex = slides.length - 1;
      if (targetIndex >= slides.length) targetIndex = 0;

      const rect = aboutSection.getBoundingClientRect();
      const absoluteTop = window.scrollY + rect.top;
      const pinnedDistance = aboutSection.offsetHeight - window.innerHeight;

      if (pinnedDistance > 0) {
        const targetProgress = targetIndex / (slides.length - 1);
        const targetY = absoluteTop + targetProgress * pinnedDistance;
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      } else {
        updateSliderState(targetIndex / (slides.length - 1));
      }
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        scrollByStep(currentIndex - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        scrollByStep(currentIndex + 1);
      });
    }

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        scrollByStep(i);
      });
    });

    function onScroll() {
      const rect = aboutSection.getBoundingClientRect();
      const pinnedDistance = aboutSection.offsetHeight - window.innerHeight;
      if (pinnedDistance <= 0) return;

      const scrolledInPin = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolledInPin / pinnedDistance));
      updateSliderState(progress);
    }

    // Initialize slide 0
    updateSliderState(0);

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  // --- Works Mobile Modal Controls (Tablet & Phone) ---
  (function initWorksMobileModals() {
    const modalTriggers = document.querySelectorAll('[data-modal]');
    const modals = document.querySelectorAll('.work-modal');

    modalTriggers.forEach(item => {
      item.addEventListener('click', () => {
        const modalId = item.getAttribute('data-modal');
        const targetModal = document.getElementById(modalId);
        if (targetModal) {
          targetModal.classList.add('open');
          document.body.style.overflow = 'hidden';
          document.documentElement.style.overflow = 'hidden';
        }
      });
    });

    modals.forEach(modal => {
      const closeBtn = modal.querySelector('.work-modal-close');
      
      const closeModal = () => {
        modal.classList.remove('open');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      };

      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeModal();
        });
      }

      // Close on clicking backdrop
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal();
        }
      });
    });
  })();

  // --- About Section: Reveal Animation (desktop scroll-scrub / mobile fade-up) ---
  (function initAboutScrollReveal() {
    const section = document.getElementById('about');
    const card    = document.querySelector('.about-card');
    if (!section || !card) return;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function easeInOut(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }
    function mapRange(val, inMin, inMax, outMin, outMax) {
      const t = Math.max(0, Math.min(1, (val - inMin) / (inMax - inMin)));
      return outMin + t * (outMax - outMin);
    }

    // ── Shared: fully-visible state writer ───────────────────────────────────
    function setFullyVisible() {
      card.style.setProperty('--about-layer-opacity',  '1');
      card.style.setProperty('--about-header-x',       '0vw');
      card.style.setProperty('--about-header-opacity', '1');
      card.style.setProperty('--about-footer-x',       '0vw');
      card.style.setProperty('--about-footer-opacity', '1');
    }

    // ── DESKTOP (>1024px): scroll-scrubbed cinematic reveal ──────────────────
    function initDesktopReveal() {
      let rafId = null;

      function update() {
        rafId = null;
        const sectionTop   = section.getBoundingClientRect().top + window.scrollY;
        const scrollHeight = section.offsetHeight - window.innerHeight;
        const scrolled     = Math.max(0, window.scrollY - sectionTop);
        const p            = scrollHeight > 0 ? Math.min(1, scrolled / scrollHeight) : 0;

        // Layer (SVG + icons): fades in 0.00→0.15, fades out 0.80→1.00
        const layerOpacity = p < 0.15
          ? easeInOut(mapRange(p, 0, 0.15, 0, 1))
          : p > 0.80
            ? 1 - easeInOut(mapRange(p, 0.80, 1.0, 0, 1))
            : 1;

        // Header: -110vw→0vw (enter 0.05→0.50), 0vw→+110vw (exit 0.72→1.0)
        const headerXvw = p < 0.05
          ? -110
          : p < 0.50
            ? -110 + easeInOut(mapRange(p, 0.05, 0.50, 0, 1)) * 110
            : p < 0.72
              ? 0
              : easeInOut(mapRange(p, 0.72, 1.0, 0, 1)) * 110;

        const headerOpacity = p < 0.05
          ? 0
          : p < 0.50
            ? easeInOut(mapRange(p, 0.05, 0.50, 0, 1))
            : p < 0.72
              ? 1
              : 1 - easeInOut(mapRange(p, 0.72, 1.0, 0, 1));

        // Footer: +110vw→0vw (enter 0.05→0.50), 0vw→-110vw (exit 0.72→1.0)
        const footerXvw = p < 0.05
          ? 110
          : p < 0.50
            ? 110 - easeInOut(mapRange(p, 0.05, 0.50, 0, 1)) * 110
            : p < 0.72
              ? 0
              : -(easeInOut(mapRange(p, 0.72, 1.0, 0, 1)) * 110);

        card.style.setProperty('--about-layer-opacity',  layerOpacity.toFixed(4));
        card.style.setProperty('--about-header-x',       `${headerXvw.toFixed(2)}vw`);
        card.style.setProperty('--about-header-opacity', headerOpacity.toFixed(4));
        card.style.setProperty('--about-footer-x',       `${footerXvw.toFixed(2)}vw`);
        card.style.setProperty('--about-footer-opacity', headerOpacity.toFixed(4));
      }

      function onScroll() {
        if (!rafId) rafId = requestAnimationFrame(update);
      }

      window.addEventListener('scroll', onScroll, { passive: true });
      update();
    }

    // ── TABLET / MOBILE (≤1024px): IntersectionObserver scale+fade-up ────────
    function initMobileReveal() {
      // Ensure CSS vars won't interfere — set to fully visible immediately
      setFullyVisible();

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              // Remove class first to force CSS animation reset (reflow trick)
              card.classList.remove('mobile-reveal');
              // eslint-disable-next-line no-unused-expressions
              void card.offsetWidth; // trigger reflow so browser resets the animation
              card.classList.add('mobile-reveal');
            } else {
              // Section left viewport — remove so it can re-fire on next entry
              card.classList.remove('mobile-reveal');
            }
          });
        },
        { threshold: 0.12 } // fire when 12% of the card is visible
      );

      observer.observe(card);
    }

    // ── Branch on viewport width ──────────────────────────────────────────────
    if (window.innerWidth > 1024) {
      initDesktopReveal();
    } else {
      initMobileReveal();
    }

    // Re-evaluate on resize (e.g. rotating a tablet)
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) {
        card.classList.remove('mobile-reveal');
      } else {
        setFullyVisible();
        if (!card.classList.contains('mobile-reveal')) {
          card.classList.add('mobile-reveal');
        }
      }
    });
  })();

  // --- About Hand Auto-Rotation Module (Point to categories footer center) ---
  (function initAboutHandRotation() {
    const hand = document.querySelector('.about-hand-graphic');
    const footer = document.querySelector('.about-categories-footer');
    if (!hand || !footer) return;

    function adjustRotation() {
      const handRect = hand.getBoundingClientRect();
      const handCenterX = handRect.left + handRect.width / 2;
      const handCenterY = handRect.top + handRect.height / 2;

      // Find the actual category text items to calculate the center of the list text block
      const items = Array.from(footer.querySelectorAll('.category-item'));
      if (items.length === 0) return;

      const lefts = items.map(i => i.getBoundingClientRect().left);
      const rights = items.map(i => i.getBoundingClientRect().right);
      const tops = items.map(i => i.getBoundingClientRect().top);
      const bottoms = items.map(i => i.getBoundingClientRect().bottom);

      const minLeft = Math.min(...lefts);
      const maxRight = Math.max(...rights);
      const minTop = Math.min(...tops);
      const maxBottom = Math.max(...bottoms);

      const footerCenterX = (minLeft + maxRight) / 2;
      const footerCenterY = (minTop + maxBottom) / 2;

      const dx = footerCenterX - handCenterX;
      const dy = footerCenterY - handCenterY;
      
      const angleRad = Math.atan2(dy, dx);
      const angleDeg = angleRad * (180 / Math.PI);

      // Subtract 90 degrees since natural pointer faces straight down
      const rotation = angleDeg - 90;
      hand.style.transform = `rotate(${rotation}deg)`;
    }

    window.addEventListener('resize', adjustRotation);
    window.addEventListener('scroll', adjustRotation, { passive: true });
    
    // Layout settlements
    setTimeout(adjustRotation, 100);
    setTimeout(adjustRotation, 500);
    setTimeout(adjustRotation, 1000);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          adjustRotation();
        }
      });
    }, { threshold: 0.1 });

    const aboutCard = document.querySelector('.about-card');
    if (aboutCard) {
      observer.observe(aboutCard);
    }
  })();

  // --- Mobile Floating Navigation Menu & Desktop Fixed Navbar ---
  (function initGlobalNavigation() {
    const mobileNavbar = document.querySelector('.mobile-navbar');
    const desktopNavbar = document.querySelector('.desktop-navbar');
    const toggleBtn = document.querySelector('.mobile-nav-toggle');
    const closeBtn = document.querySelector('.mobile-dropdown-close');
    const logoBtn = document.querySelector('.mobile-nav-logo');
    const aboutSection = document.getElementById('about');
    const contactSection = document.getElementById('contact');

    if (mobileNavbar && toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        mobileNavbar.classList.toggle('open');
      });
    }

    if (mobileNavbar && closeBtn) {
      closeBtn.addEventListener('click', () => {
        mobileNavbar.classList.remove('open');
      });
    }

    // Logo click smooth scrolls to top of page
    if (logoBtn) {
      logoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (mobileNavbar) mobileNavbar.classList.remove('open');
      });
    }

    // Close mobile dropdown when clicking outside it
    document.addEventListener('click', (e) => {
      if (mobileNavbar && mobileNavbar.classList.contains('open')) {
        if (!mobileNavbar.contains(e.target)) {
          mobileNavbar.classList.remove('open');
        }
      }
    });

    // Bind smooth scrolling for all nav links (mobile dropdown, desktop bar)
    const navLinks = document.querySelectorAll('.mobile-dropdown-link, .desktop-nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth' });
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
      const threshold = aboutSection ? aboutSection.offsetTop - 100 : 0;
      const pastHero = scrollY >= threshold;

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
      if (desktopNavbar) {
        const endY = contactSection 
          ? contactSection.offsetTop + contactSection.offsetHeight 
          : document.body.scrollHeight;
        if (pastHero && scrollY < endY) {
          desktopNavbar.classList.add('visible');
        } else {
          desktopNavbar.classList.remove('visible');
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
    handleScrollUpdates();
  })();

});



