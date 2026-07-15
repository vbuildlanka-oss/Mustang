gsap.registerPlugin(ScrollTrigger);

/* ---------------------------------------------------------------------------
 * Frame sequence definition
 * Scene 1: Set1  -> ezgif-frame-001 ... 300  (300 frames)
 * Scene 2: Set2  -> ezgif-frame-001 ... 167  (167 frames)
 * One continuous sequence, 467 frames total.
 * ------------------------------------------------------------------------- */
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

const images = new Array(FRAME_COUNT);
const state = { frame: 0 };

/* --- Canvas sizing with "cover" fit + devicePixelRatio for crispness --- */
let dpr = Math.min(window.devicePixelRatio || 1, 2);

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
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

  // cover: scale to fill, center-crop overflow
  const scale = Math.max(cw / iw, ch / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;

  ctx.drawImage(img, dx, dy, dw, dh);
}

/* --- Preload all frames, track progress --- */
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
        if (idx === 0) render(0); // paint first frame ASAP
        if (loaded === FRAME_COUNT) resolve();
      };
      img.src = src;
      images[idx] = img;
    });
  });
}

/* --- Lenis smooth scrolling wired into GSAP's ticker + ScrollTrigger --- */
function initSmoothScroll() {
  const lenis = new Lenis({
    lerp: 0.1,
    smoothWheel: true,
  });

  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

/* --- Scroll-driven frame animation --- */
function initSequence() {
  gsap.to(state, {
    frame: FRAME_COUNT - 1,
    ease: "none",
    snap: "frame",
    scrollTrigger: {
      trigger: "#scroll-track",
      start: "top top",
      end: "bottom bottom",
      scrub: 0.5,
    },
    onUpdate: () => render(state.frame),
  });
}

/* --- Boot --- */
function setTrackHeight() {
  // Scroll distance: ~ a bit under one viewport height per handful of frames.
  const track = document.getElementById("scroll-track");
  const perFrame = 9; // px of scroll per frame
  track.style.height = window.innerHeight + FRAME_COUNT * perFrame + "px";
}

async function main() {
  setTrackHeight();
  resizeCanvas();

  await preload();

  loader.classList.add("hidden");

  initSmoothScroll();
  initSequence();

  render(0);
  ScrollTrigger.refresh();
}

window.addEventListener("resize", () => {
  setTrackHeight();
  resizeCanvas();
  ScrollTrigger.refresh();
});

main();
