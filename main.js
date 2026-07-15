gsap.registerPlugin(ScrollTrigger);
// Ignore mobile viewport resizes caused by the address bar showing/hiding,
// which would otherwise refresh + jump the pinned hero mid-scroll.
ScrollTrigger.config({ ignoreMobileResize: true });

/* ===========================================================================
 * 1. CANVAS FRAME SEQUENCE
 * Scene 1: Set1 -> 001..300 (300)  |  Scene 2: Set2 -> 001..167 (167)
 * One continuous 467-frame sequence of the Shelby.
 * ========================================================================= */
const SCENES = [
  { dir: "Set1", count: 300 },
  { dir: "Set2", count: 167 },
];
const pad = (n) => String(n).padStart(3, "0");

const frameSrcs = [];
for (const scene of SCENES) {
  for (let i = 1; i <= scene.count; i++) {
    frameSrcs.push(`./${scene.dir}/ezgif-frame-${pad(i)}.webp`);
  }
}
const FRAME_COUNT = frameSrcs.length;

const canvas = document.getElementById("sequence");
const ctx = canvas.getContext("2d", { alpha: false });
const loader = document.getElementById("loader");
const barFill = document.getElementById("bar-fill");
const barPct = document.getElementById("bar-pct");

const images = new Array(FRAME_COUNT);
const state = { frame: 0 };

let dpr = Math.min(window.devicePixelRatio || 1, 2);

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Size the drawing buffer to the canvas's actual rendered box (driven by
  // the hero's 100dvh), not window.innerHeight — keeps it correct on mobile.
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  render(state.frame);
}

function render(index) {
  const i = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(index)));
  const img = images[i];
  if (!img || !img.complete || !img.naturalWidth) return;

  const cw = canvas.width;
  const ch = canvas.height;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  const scale = Math.max(cw / iw, ch / ih); // cover
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

let loaded = 0;
function preload() {
  return new Promise((resolve) => {
    frameSrcs.forEach((src, idx) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = img.onerror = () => {
        loaded++;
        const pct = Math.round((loaded / FRAME_COUNT) * 100);
        barFill.style.width = pct + "%";
        if (barPct) barPct.textContent = pct;
        if (idx === 0) render(0);
        if (loaded === FRAME_COUNT) resolve();
      };
      img.src = src;
      images[idx] = img;
    });
  });
}

/* ===========================================================================
 * 2. SMOOTH SCROLL (Lenis -> GSAP ticker -> ScrollTrigger)
 * ========================================================================= */
let lenis = null;
function initSmoothScroll() {
  // smoothTouch left off: native touch scrolling feels better and avoids
  // fighting the pinned hero on phones/tablets.
  lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // In-page anchor links routed through Lenis
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: 0 });
      }
    });
  });
  return lenis;
}

/* ===========================================================================
 * 3. PINNED HERO TIMELINE — frame scrub + cinematic captions
 * ========================================================================= */
// Scroll distance per frame — shorter on smaller screens so getting through
// the 467-frame sequence isn't an endless swipe on a phone.
function perFrame() {
  const w = window.innerWidth;
  if (w <= 600) return 5;
  if (w <= 1024) return 7;
  return 9;
}

function initHeroTimeline() {
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: "#hero",
      start: "top top",
      // functional end so it recomputes per breakpoint on refresh
      end: () => "+=" + FRAME_COUNT * perFrame(),
      pin: true,
      pinSpacing: true,
      anticipatePin: 1,
      scrub: 0.6,
      invalidateOnRefresh: true,
    },
  });

  // The frame scrub spans the entire timeline (duration = 1).
  tl.to(state, { frame: FRAME_COUNT - 1, duration: 1, onUpdate: () => render(state.frame) }, 0);

  // Intro headline fades/scales away as the drive begins.
  tl.to("#hero-intro", { autoAlpha: 0, scale: 0.9, filter: "blur(6px)", duration: 0.14, ease: "power2.in" }, 0.02);
  tl.to("#scroll-cue", { autoAlpha: 0, duration: 0.05 }, 0.02);

  // Cinematic captions timed across the sequence.
  const caps = gsap.utils.toArray(".cap");
  const windows = [
    [0.20, 0.36],
    [0.42, 0.58],
    [0.62, 0.78],
    [0.84, 0.99],
  ];
  caps.forEach((cap, i) => {
    const [inAt, outAt] = windows[i];
    tl.fromTo(
      cap,
      { autoAlpha: 0, yPercent: 24, scale: 0.94 },
      { autoAlpha: 1, yPercent: 0, scale: 1, duration: 0.06, ease: "power2.out" },
      inAt
    );
    // last caption stays on screen through the end
    if (i < caps.length - 1) {
      tl.to(cap, { autoAlpha: 0, yPercent: -22, scale: 1.04, duration: 0.06, ease: "power2.in" }, outAt);
    }
  });
}

/* ===========================================================================
 * 4. MOUSE-DRIVEN 3D PARALLAX on the hero layers
 * ========================================================================= */
function initMouseParallax() {
  const scene = document.querySelector(".hero-parallax");
  const layers = gsap.utils.toArray(".hero-parallax .layer");
  if (!scene || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Smooth setters for the whole scene tilt...
  const rotX = gsap.quickTo(scene, "rotationX", { duration: 0.8, ease: "power3" });
  const rotY = gsap.quickTo(scene, "rotationY", { duration: 0.8, ease: "power3" });

  // ...and per-layer depth shift.
  const setters = layers.map((el) => ({
    depth: parseFloat(el.dataset.depth || "0"),
    x: gsap.quickTo(el, "x", { duration: 0.9, ease: "power3" }),
    y: gsap.quickTo(el, "y", { duration: 0.9, ease: "power3" }),
  }));

  window.addEventListener("pointermove", (e) => {
    const nx = e.clientX / window.innerWidth - 0.5; // -0.5..0.5
    const ny = e.clientY / window.innerHeight - 0.5;
    rotY(nx * 10);
    rotX(-ny * 8);
    setters.forEach((s) => {
      const k = s.depth * 0.12;
      s.x(nx * k);
      s.y(ny * k);
    });
  });
}

/* ===========================================================================
 * 5. SCROLL REVEALS + PARALLAX for content sections
 * ========================================================================= */
function initContentMotion() {
  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    gsap.from(el, {
      y: 60,
      autoAlpha: 0,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });

  gsap.utils.toArray("[data-parallax]").forEach((el) => {
    const amount = parseFloat(el.dataset.parallax);
    gsap.to(el, {
      yPercent: amount,
      ease: "none",
      scrollTrigger: {
        trigger: el.closest("section") || el,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    });
  });
}

/* ===========================================================================
 * 6. 3D TILT on spec cards
 * ========================================================================= */
function initTiltCards() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.utils.toArray(".tilt").forEach((card) => {
    const rotX = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3" });
    const rotY = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3" });
    const lift = gsap.quickTo(card, "z", { duration: 0.5, ease: "power3" });

    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      rotY(px * 16);
      rotX(-py * 16);
      lift(40);
    });
    card.addEventListener("pointerleave", () => {
      rotY(0);
      rotX(0);
      lift(0);
    });
  });
}

/* ===========================================================================
 * 7. NAV scroll state
 * ========================================================================= */
function initNav() {
  const nav = document.getElementById("nav");
  const toggle = document.getElementById("nav-toggle");
  const links = document.getElementById("nav-links");

  ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: (self) => nav.classList.toggle("scrolled", self.scroll() > 40),
  });

  // Mobile / tablet hamburger menu
  if (toggle && links) {
    const setOpen = (open) => {
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      if (lenis) open ? lenis.stop() : lenis.start(); // lock scroll while open
    };
    toggle.addEventListener("click", () =>
      setOpen(!nav.classList.contains("open"))
    );
    // Close after tapping a link
    links.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => setOpen(false))
    );
    // Close if resized up to desktop while open
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900 && nav.classList.contains("open")) setOpen(false);
    });
  }
}

/* ===========================================================================
 * BOOT
 * ========================================================================= */
async function main() {
  resizeCanvas();
  await preload();

  loader.classList.add("hidden");

  initSmoothScroll();
  initHeroTimeline();
  initContentMotion();
  initNav();

  // Cursor-driven effects only on real pointer devices — on touch these
  // misfire during drags and there is no hover state.
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (canHover) {
    initMouseParallax();
    initTiltCards();
  }

  // Intro headline entrance (one-shot, independent of scroll scrub targets)
  gsap.from("#hero-intro .line", {
    yPercent: 120,
    duration: 1.1,
    ease: "power4.out",
    stagger: 0.12,
    delay: 0.15,
  });

  render(0);
  ScrollTrigger.refresh();
}

// Only react to WIDTH changes (real layout/orientation changes). Mobile
// browsers fire resize on every address-bar toggle with a height-only delta,
// which we deliberately ignore to keep the pinned hero from jumping.
let lastW = window.innerWidth;
let resizeTimer;
window.addEventListener("resize", () => {
  if (window.innerWidth === lastW) return;
  lastW = window.innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    resizeCanvas();
    ScrollTrigger.refresh();
  }, 200);
});

window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    resizeCanvas();
    ScrollTrigger.refresh();
  }, 300);
});

main();
