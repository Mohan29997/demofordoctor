"use client";
import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { examState, goScene } from "./sceneState";

// All page-level scroll and pointer choreography. Content is plain HTML without it.
export default function Motion() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    // Mobile toolbars hiding on scroll must not re-measure the pinned exam mid-swipe.
    ScrollTrigger.config({ ignoreMobileResize: true });
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = matchMedia("(pointer: fine)").matches;
    const q = <T extends HTMLElement>(s: string) => gsap.utils.toArray<T>(s);
    const undo: (() => void)[] = [];
    let lenis: Lenis | null = null;

    // Smooth scrolling is for mouse and trackpad only. Touch screens keep native scrolling,
    // so nothing can block a swipe during the intro or fight the browser's pinch zoom.
    if (!reduced && finePointer) {
      lenis = new Lenis({ lerp: 0.1 });
      lenis.on("scroll", ScrollTrigger.update);
      const raf = (t: number) => lenis?.raf(t * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      undo.push(() => { gsap.ticker.remove(raf); lenis?.destroy(); });
    }

    const onAnchor = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      const href = a?.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector<HTMLElement>(href);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { duration: 1.6 });
      else target.scrollIntoView();
    };
    document.addEventListener("click", onAnchor);
    undo.push(() => document.removeEventListener("click", onAnchor));

    const ctx = gsap.context(() => {
      // Pins come first so every later trigger measures the page with pin spacing included.
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // The exam film: scroll position drives the whole 3D sequence.
        const sec = document.querySelector<HTMLElement>(".exam");
        if (!sec) return;
        sec.classList.add("pinned");
        examState.progress = 0;
        ScrollTrigger.create({
          trigger: sec, pin: true, start: "top top", end: "+=520%",
          onUpdate: (s) => { examState.progress = s.progress; },
        });
        return () => { sec.classList.remove("pinned"); examState.progress = 1; };
      });

      const loader = document.querySelector<HTMLElement>(".loader");
      if (reduced) {
        loader?.remove();
        goScene(0, 0.62, 0.8, 0.85, true);
      } else {
        // Preloader count, curtain lift, then the headline rises word by word.
        gsap.set(".hero .word > span", { yPercent: 115 });
        gsap.set(".hero .fade-in", { autoAlpha: 0, y: 16 });
        const counter = { v: 0 };
        const num = document.querySelector(".loader-num");
        lenis?.stop();
        gsap.timeline({ onComplete: () => { lenis?.start(); loader?.remove(); } })
          .to(counter, { v: 100, duration: 1.3, ease: "power2.inOut", onUpdate: () => { if (num) num.textContent = String(Math.round(counter.v)); } })
          .to(".loader", { yPercent: -100, duration: 0.9, ease: "expo.inOut" })
          .from(".webgl", { scale: 0.6, autoAlpha: 0, duration: 1.5, ease: "expo.out" }, "-=0.6")
          .to(".hero .word > span", { yPercent: 0, duration: 1.1, stagger: 0.06, ease: "expo.out" }, "-=1.3")
          .to(".hero .fade-in", { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08 }, "-=0.7");

        q(".reveal").forEach((el) => gsap.from(el, { y: 40, autoAlpha: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%" } }));
        q(".mask-title .word > span").forEach((el) => gsap.from(el, { yPercent: 115, duration: 1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 95%" } }));

        // Reel-style word-by-word read-along tied to scroll.
        q(".scrub").forEach((el) => gsap.fromTo(el.querySelectorAll("span"), { opacity: 0.14 }, {
          opacity: 1, stagger: 0.1, ease: "none",
          scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 50%", scrub: true },
        }));

        gsap.to(".progress", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.2 } });
        gsap.to(".hero-inner", { yPercent: -18, autoAlpha: 0, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 30%", scrub: true } });
      }

      // Each section declares which shape the particles should become.
      q("[data-scene]").forEach((el) => {
        const [m, x, o, s] = el.dataset.scene!.split(",").map(Number);
        ScrollTrigger.create({
          // A pinned section's spacer covers its full scroll distance.
          trigger: el.closest(".pin-spacer") ?? el, start: "top 60%", end: "bottom 40%",
          onToggle: (self) => { if (self.isActive) goScene(m, x, o, s, reduced); },
        });
      });

      if (finePointer && !reduced) {
        q("[data-magnetic]").forEach((el) => {
          const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "elastic.out(1,0.4)" }), y = gsap.quickTo(el, "y", { duration: 0.5, ease: "elastic.out(1,0.4)" });
          el.addEventListener("pointermove", (e) => {
            const r = el.getBoundingClientRect();
            x((e.clientX - r.left - r.width / 2) * 0.35); y((e.clientY - r.top - r.height / 2) * 0.35);
          });
          el.addEventListener("pointerleave", () => { x(0); y(0); });
        });
        q(".t-card").forEach((el) => {
          const inner = el.querySelector<HTMLElement>(".t-inner")!;
          const rx = gsap.quickTo(inner, "rotateX", { duration: 0.5 }), ry = gsap.quickTo(inner, "rotateY", { duration: 0.5 });
          el.addEventListener("pointermove", (e) => {
            const r = el.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
            ry((px - 0.5) * 16); rx((0.5 - py) * 16);
            inner.style.setProperty("--gx", `${px * 100}%`); inner.style.setProperty("--gy", `${py * 100}%`);
          });
          el.addEventListener("pointerleave", () => { rx(0); ry(0); });
        });
      }
    });

    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => { ctx.revert(); undo.forEach((f) => f()); };
  }, []);

  return null;
}
