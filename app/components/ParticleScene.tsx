"use client";
import { useEffect, useRef } from "react";
import { scene } from "./sceneState";

const vertex = /* glsl */ `
  attribute vec3 p0; attribute vec3 p1; attribute vec3 p2; attribute vec3 p3; attribute vec3 p4; attribute vec3 p5;
  attribute float rnd;
  uniform float uMorph, uTime, uSize; uniform vec2 uMouse;
  varying float vDepth; varying float vRnd;
  float seg(float i){ float t = clamp(uMorph - i, 0., 1.); float d = rnd * .45; return smoothstep(d, d + .55, t); }
  void main(){
    vec3 p = p0;
    p = mix(p, p1, seg(0.)); p = mix(p, p2, seg(1.)); p = mix(p, p3, seg(2.)); p = mix(p, p4, seg(3.)); p = mix(p, p5, seg(4.));
    p += .018 * vec3(sin(uTime * .9 + rnd * 40.), cos(uTime * .7 + rnd * 70.), sin(uTime * .5 + rnd * 90.));
    vec4 world = modelMatrix * vec4(p, 1.);
    vec2 away = world.xy - uMouse; float d = length(away);
    world.xy += normalize(away + .0001) * smoothstep(.75, 0., d) * .32;
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (.55 + rnd) / -mv.z;
    vDepth = smoothstep(-1.4, 1.4, p.z); vRnd = rnd;
  }`;
const fragment = /* glsl */ `
  uniform float uOpacity; varying float vDepth; varying float vRnd;
  void main(){
    float a = smoothstep(.5, .05, length(gl_PointCoord - .5));
    vec3 deep = vec3(.03,.42,.47), peach = vec3(.16,.70,.68), cream = vec3(.30,.62,.88);
    vec3 c = mix(deep, peach, vDepth); c = mix(c, cream, step(.93, vRnd) * .85);
    gl_FragColor = vec4(c, a * uOpacity * (.5 + .45 * vDepth));
  }`;

function shapes(n: number) {
  const make = () => new Float32Array(n * 3);
  const [a, b, c, d, e, f] = [make(), make(), make(), make(), make(), make()];
  const R = Math.random;
  const CHECK = [[-1, 0], [-0.3, -0.75], [1.15, 0.85]];
  for (let i = 0; i < n; i++) {
    const j = i * 3;
    // 0 cell: a shell with a dense nucleus
    const u = Math.acos(2 * R() - 1), v = R() * Math.PI * 2;
    const r = i % 7 === 0 ? 0.35 * Math.cbrt(R()) : 1.15 + 0.05 * Math.sin(u * 7 + v * 5);
    a.set([r * Math.sin(u) * Math.cos(v), r * Math.sin(u) * Math.sin(v), r * Math.cos(u)], j);
    // 1 skin surface: gently rippling sheet
    const x = (R() - 0.5) * 4.6, z = (R() - 0.5) * 3.4;
    b.set([x, Math.sin(x * 2.4) * 0.14 + Math.cos(z * 3.1 + x) * 0.14 - 0.1, z], j);
    // 2 DNA double helix with rungs
    const h = (i / n) * 3.6 - 1.8, ang = h * 3.4, kind = i % 5;
    const s = kind === 4 ? (R() * 2 - 1) * 0.58 : (kind % 2 ? 0.6 : -0.6);
    c.set([Math.cos(ang) * s + (R() - 0.5) * 0.04, h, Math.sin(ang) * s + (R() - 0.5) * 0.04], j);
    // 3 collagen: torus knot of woven fibres
    const t = R() * Math.PI * 2, tube = 0.1 * Math.sqrt(R()), tv = R() * Math.PI * 2, q = 0.82 + 0.34 * Math.cos(3 * t);
    d.set([(q + tube * Math.cos(tv)) * Math.cos(2 * t), (q + tube * Math.cos(tv)) * Math.sin(2 * t), 0.34 * Math.sin(3 * t) + tube * Math.sin(tv)], j);
    // 4 open cloud
    e.set([(R() - 0.5) * 8, (R() - 0.5) * 5, (R() - 0.5) * 3], j);
    // 5 confirmation checkmark
    const short = R() < 0.3, A = short ? CHECK[0] : CHECK[1], B = short ? CHECK[1] : CHECK[2], k = R();
    f.set([A[0] + (B[0] - A[0]) * k + (R() - 0.5) * 0.11, A[1] + (B[1] - A[1]) * k + (R() - 0.5) * 0.11, (R() - 0.5) * 0.12], j);
  }
  return [a, b, c, d, e, f];
}

export default function ParticleScene() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let cleanup = () => {};
    let cancelled = false;

    import("three").then((THREE) => {
      if (cancelled) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, premultipliedAlpha: false, antialias: false, powerPreference: "high-performance" });
      } catch {
        host.classList.add("no-webgl"); // CSS gradient fallback
        return;
      }
      const small = window.innerWidth < 800;
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const count = small ? 9000 : 22000;
      const dpr = Math.min(devicePixelRatio, small ? 1.5 : 2);
      renderer.setPixelRatio(dpr);
      host.appendChild(renderer.domElement);

      const threeScene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
      camera.position.z = 5;

      const geo = new THREE.BufferGeometry();
      shapes(count).forEach((arr, i) => geo.setAttribute(i === 0 ? "position" : `p${i}`, new THREE.BufferAttribute(arr, 3)));
      geo.setAttribute("p0", geo.getAttribute("position"));
      const rnd = new Float32Array(count).map(() => Math.random());
      geo.setAttribute("rnd", new THREE.BufferAttribute(rnd, 1));

      const uniforms = {
        uMorph: { value: 0 }, uTime: { value: 0 }, uOpacity: { value: 1 },
        uSize: { value: 26 * dpr }, uMouse: { value: new THREE.Vector2(99, 99) },
      };
      const mat = new THREE.ShaderMaterial({
        vertexShader: vertex, fragmentShader: fragment, uniforms,
        transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      threeScene.add(points);

      const mouse = { x: 99, y: 99, tx: 99, ty: 99 };
      const halfH = Math.tan((45 * Math.PI) / 360) * 5;
      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const halfW = halfH * camera.aspect;
        mouse.tx = (e.clientX / innerWidth) * 2 * halfW - halfW;
        mouse.ty = -((e.clientY / innerHeight) * 2 - 1) * halfH;
      };
      const resize = () => {
        renderer.setSize(innerWidth, innerHeight);
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
      };
      resize();
      addEventListener("resize", resize);
      addEventListener("pointermove", onMove, { passive: true });

      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (document.hidden) return;
        const t = still ? 0 : performance.now() / 1000;
        const wide = camera.aspect > 1;
        uniforms.uTime.value = t;
        uniforms.uMorph.value = scene.morph;
        uniforms.uOpacity.value = scene.opacity * (wide || scene.morph > 4.5 ? 1 : 0.42);
        mouse.x += (mouse.tx - mouse.x) * 0.08;
        mouse.y += (mouse.ty - mouse.y) * 0.08;
        // No repulsion on the checkmark, it has to stay legible.
        if (scene.morph > 4.5) uniforms.uMouse.value.set(99, 99);
        else uniforms.uMouse.value.set(mouse.x, mouse.y);
        // The checkmark and the skin sheet need to hold their angle to read clearly.
        const settle = Math.min(1, Math.abs(scene.morph - 5));
        points.rotation.y = settle * (t * 0.16 + (wide ? mouse.x * 0.05 : 0));
        const sheet = 1 - Math.min(1, Math.abs(scene.morph - 1));
        points.rotation.x = settle * (sheet * 0.5 + 0.12 * Math.sin(t * 0.3));
        points.position.x = wide ? scene.x * halfH * camera.aspect : 0;
        points.position.y = scene.y;
        points.scale.setScalar(scene.scale * (wide || scene.morph > 4.5 ? 1 : 0.8));
        renderer.render(threeScene, camera);
      };
      tick();

      cleanup = () => {
        cancelAnimationFrame(raf);
        removeEventListener("resize", resize);
        removeEventListener("pointermove", onMove);
        geo.dispose(); mat.dispose(); renderer.dispose();
        renderer.domElement.remove();
      };
    });
    return () => { cancelled = true; cleanup(); };
  }, []);

  return <div ref={ref} className="webgl" aria-hidden="true" />;
}
