import gsap from "gsap";

// Shared between the page's animation code and the WebGL render loop.
export const scene = { morph: 0, x: 0.62, y: 0, scale: 0.85, opacity: 1 };

export function goScene(morph: number, x = 0, opacity = 1, scale = 1, instant = false, y = 0) {
  gsap.to(scene, { morph, x, y, opacity, scale, duration: instant ? 0 : 1.6, ease: "power3.inOut", overwrite: true });
}

// Scroll progress of the pinned exam sequence. Stays at 1 (final frame) when motion is reduced.
export const examState = { progress: 1 };
