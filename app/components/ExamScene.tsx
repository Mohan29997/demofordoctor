"use client";
import { useEffect, useRef } from "react";
import type { BufferGeometry, Material, Object3D } from "three";
import { examState } from "./sceneState";

// Procedural skin shared by the forearm and every lens. Illustrative, not clinical imagery.
const SKIN = /* glsl */ `
  uniform float uHeal; uniform vec3 uMole;
  vec2 h2(vec2 p){ p = vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
    return mix(mix(h2(i).x,h2(i+vec2(1,0)).x,u.x),mix(h2(i+vec2(0,1)).x,h2(i+vec2(1,1)).x,u.x),u.y); }
  float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*noise(p); p=p*2.03+7.; a*=.5; } return s; }
  // x: distance to nearest cell, y: distance to the cell edge, zw: cell id
  vec4 cells(vec2 p){ vec2 i=floor(p),f=fract(p); float d=9.,d2=9.; vec2 id=vec2(0);
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y),o=h2(i+g); float e=length(g+o-f);
      if(e<d){d2=d;d=e;id=i+g;} else if(e<d2){d2=e;} }
    return vec4(d,d2-d,id); }
  const vec2 SPOT_A=vec2(.8,.3); const vec2 SPOT_P=vec2(-.8,.3);
  // Spots clear behind a sweep that crosses the arm from left to right. Moles stay.
  float keep(vec2 p){ float x=mix(-3.2,3.2,uHeal); return smoothstep(x-.35,x+.35,p.x); }
  float acne(vec2 p){ vec4 c=cells(p*13.); return step(.4,h2(c.zw+3.).x)*smoothstep(.42,.05,c.x)*smoothstep(.42,.16,length(p-SPOT_A))*keep(p); }
  float pigment(vec2 p){ return smoothstep(.36,.5,fbm(p*7.))*smoothstep(.42,.18,length(p-SPOT_P))*keep(p); }
  // The fine polygon network of real skin, soft and shallow, with sparse pores.
  float height(vec2 p, float detail){
    vec4 c=cells(p*62.+fbm(p*14.)*1.4);
    float groove=smoothstep(.0,.3,c.y);
    vec4 q=cells(p*30.); float pore=step(.8,h2(q.zw).x)*smoothstep(.14,.03,q.x);
    return 1.+detail*(.05*groove-.1*pore+.05*fbm(p*40.))+.45*acne(p);
  }
  vec3 skin(vec2 p, float detail){
    vec3 base=mix(vec3(.79,.54,.42),vec3(.90,.68,.56),fbm(p*2.6));
    float e=.002;
    vec3 n=normalize(vec3(height(p-vec2(e,0),detail)-height(p+vec2(e,0),detail),height(p-vec2(0,e),detail)-height(p+vec2(0,e),detail),.075));
    float a=acne(p); base=mix(base,vec3(.67,.12,.12),smoothstep(.0,.6,a)); base=mix(base,vec3(.98,.92,.74),smoothstep(.88,.98,a));
    float m=pigment(p); float net=.72+.28*smoothstep(.02,.16,cells(p*34.).y); base=mix(base,vec3(.40,.21,.12)*net,m*.92);
    if(uMole.z>0.){ float d=length(p-uMole.xy)+.012*fbm(p*60.); float mn=.7+.3*smoothstep(.02,.14,cells(p*90.).y);
      base=mix(base,vec3(.23,.11,.07)*mn,smoothstep(uMole.z,uMole.z*.72,d)); }
    float l=clamp(dot(n,normalize(vec3(-.4,.45,.8))),0.,1.);
    float spec=pow(clamp(dot(n,normalize(vec3(-.2,.25,1.))),0.,1.),40.)*.13*detail;
    return base*(.5+.68*l)+spec;
  }`;

const passVert = /* glsl */ `varying vec2 vUv; varying vec3 vW;
  void main(){ vUv=uv; vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }`;
const faceVert = /* glsl */ `varying vec3 vL;
  void main(){ vL=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
// Face coordinates match the lens, so a spot seen on the cheek is the same spot in close-up.
const faceFrag = /* glsl */ `varying vec3 vL; uniform vec2 uScope; uniform float uGlow, uTime; ${SKIN}
  void main(){ vec2 p=vec2(vL.x*2.4,vL.y*2.4+.55);
    float detail=.08+.92*(1.-smoothstep(.05,.3,fwidth(p.x)*62.));
    vec3 c=skin(p,detail); vec3 n=normalize(vL);
    float d=length(p-uScope);
    c*=1.+.25*uGlow*smoothstep(.45,.05,d);
    float wave=fract(uTime*.55); c+=vec3(.05,.3,.28)*uGlow*smoothstep(.02,.0,abs(d-.12-wave*.45))*(1.-wave);
    float front=mix(-3.2,3.2,uHeal); c+=vec3(.03,.13,.11)*smoothstep(.3,.0,abs(p.x-front))*step(.001,uHeal)*step(uHeal,.999);
    c*=1.+.02*sin(uTime*1.3);
    gl_FragColor=vec4(c*(.62+.5*clamp(dot(n,normalize(vec3(-.25,.5,.85))),0.,1.)),1.); }`;
const lensFrag = /* glsl */ `varying vec2 vUv; uniform vec2 uCenter; uniform float uSpan, uScan, uTime; ${SKIN}
  void main(){ vec2 c=vUv-.5, p=uCenter+c*2.*uSpan; float r=length(c)*2.;
    vec3 col=skin(p,1.);
    float y=fract(uScan); col+=vec3(.1,.55,.55)*smoothstep(.012,.0,abs(c.y+.5-y))*uTime*.55;
    col+=vec3(.1,.55,.55)*.5*uTime*smoothstep(.004,.0,abs(r-.62));
    col+=vec3(.1,.55,.55)*.5*uTime*step(r,.09)*(smoothstep(.002,.0,abs(c.x))+smoothstep(.002,.0,abs(c.y)));
    col*=1.-smoothstep(.72,1.,r)*.72;
    col+=.2*smoothstep(.34,.0,length(c-vec2(-.2,.24)));
    gl_FragColor=vec4(col,1.); }`;

const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const back = (t: number) => { const c = 1.9, u = t - 1; return t <= 0 ? 0 : 1 + (c + 1) * u * u * u + c * u * u; };

export default function ExamScene() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    const section = el?.closest<HTMLElement>(".exam");
    if (!el || !section) return;
    let cancelled = false;
    let cleanup = () => {};

    import("three").then((T) => {
      if (cancelled) return;
      let renderer: InstanceType<typeof T.WebGLRenderer>;
      try {
        renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      } catch {
        section.classList.add("no-webgl");
        return;
      }
      const dpr = Math.min(devicePixelRatio, innerWidth < 800 ? 1.5 : 2);
      renderer.setPixelRatio(dpr);
      renderer.toneMapping = T.ACESFilmicToneMapping;
      el.appendChild(renderer.domElement);

      const scene = new T.Scene();
      scene.background = new T.Color("#dff2f1");
      const camera = new T.PerspectiveCamera(40, 1, 0.04, 60);
      scene.add(new T.HemisphereLight("#ffffff", "#bfe3e2", 2.1));
      const key = new T.DirectionalLight("#fff1e6", 2.6); key.position.set(-3, 5, 5); scene.add(key);
      const rim = new T.DirectionalLight("#c9f1ee", 1.6); rim.position.set(4, 2, -4); scene.add(rim);

      const std = (color: string, roughness = 0.6, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });
      const mesh = (g: BufferGeometry, m: Material, parent: Object3D, x = 0, y = 0, z = 0) => {
        const o = new T.Mesh(g, m); o.position.set(x, y, z); parent.add(o); return o;
      };
      
      // ---------- The forearm and dermatoscope ----------
      const MOLE = [-0.3, 0.98, 0.035];
      const shared = { uHeal: { value: 0 }, uMole: { value: new T.Vector3(...MOLE) } };
      const SCOPE = 0.3;
      const steel0 = () => std("#b7c9ce", 0.3, 0.15);
      const exam = new T.Group(); scene.add(exam);
      // Clinic room
      mesh(new T.PlaneGeometry(40, 14), new T.MeshBasicMaterial({ color: "#dff2f1", toneMapped: false }), exam, 0, 5, -3);
            mesh(new T.PlaneGeometry(40, 16), new T.MeshBasicMaterial({ color: "#c7e6e4", toneMapped: false }), exam, 0, 0, 3).rotation.x = -Math.PI / 2;
      mesh(new T.PlaneGeometry(1.5, 4.2), new T.MeshBasicMaterial({ color: "#a9d8d5", toneMapped: false }), exam, 4.6, 2.1, -2.96);
      const crossMat = new T.MeshBasicMaterial({ color: "#2bb6ae", toneMapped: false });
      mesh(new T.PlaneGeometry(0.55, 0.16), crossMat, exam, 0.7, 3.9, -2.95);
      mesh(new T.PlaneGeometry(0.16, 0.55), crossMat, exam, 0.7, 3.9, -2.95);

      // The patient, sitting in a chair
      const patient = new T.Group(); patient.position.set(-1.1, 0, 0); exam.add(patient);
      const chair = std("#2a9d9a", 0.5), gown = std("#5b8def", 0.75), trousers = std("#34507f", 0.8), limb = std("#d59a78", 0.6), pHair = std("#3a2a4a", 0.6);
      mesh(new T.BoxGeometry(1.3, 0.16, 1.2), chair, patient, 0, 0.82, 0.1);
      mesh(new T.BoxGeometry(1.3, 1.5, 0.15), chair, patient, 0, 1.6, -0.5);
      [[-0.55, 0.55], [0.55, 0.55], [-0.55, -0.4], [0.55, -0.4]].forEach(([x, z]) => mesh(new T.CylinderGeometry(0.04, 0.04, 0.82, 12), steel0(), patient, x, 0.41, z));
      const body = mesh(new T.CapsuleGeometry(0.45, 0.62, 8, 24), gown, patient, 0, 1.4, 0); body.scale.z = 0.72;
      mesh(new T.CylinderGeometry(0.14, 0.17, 0.3, 16), limb, patient, 0, 2.0, 0);
      [-1, 1].forEach((side) => {
        mesh(new T.CapsuleGeometry(0.17, 0.6, 8, 16), trousers, patient, side * 0.24, 1.0, 0.42).rotation.x = Math.PI / 2;
        mesh(new T.CapsuleGeometry(0.13, 0.55, 8, 16), trousers, patient, side * 0.24, 0.5, 0.82);
        mesh(new T.SphereGeometry(0.17, 16, 12), chair, patient, side * 0.24, 0.13, 0.92).scale.set(0.9, 0.6, 1.5);
        const parm = mesh(new T.CapsuleGeometry(0.11, 0.62, 8, 16), gown, patient, side * 0.54, 1.25, 0.2); parm.rotation.x = -0.45;
      });
      const face = new T.Group(); face.position.set(0, 2.5, 0); patient.add(face);
      mesh(new T.SphereGeometry(0.5, 64, 48), new T.ShaderMaterial({
        vertexShader: faceVert, fragmentShader: faceFrag, toneMapped: false,
        uniforms: { ...shared, uScope: { value: new T.Vector2(9, 9) }, uGlow: { value: 0 }, uTime: { value: 0 } },
      }), face);
      const faceU = ((face.children[0] as InstanceType<typeof T.Mesh>).material as InstanceType<typeof T.ShaderMaterial>).uniforms;
      const pcap = mesh(new T.SphereGeometry(0.53, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.5), pHair, face, 0, 0.1, -0.04); pcap.rotation.x = -0.3;
      mesh(new T.SphereGeometry(0.42, 24, 20), pHair, face, 0, -0.08, -0.26);
      [-1, 1].forEach((side) => {
        mesh(new T.SphereGeometry(0.06, 16, 16), std("#fffaf4", 0.3), face, side * 0.17, 0.05, 0.44).scale.z = 0.5;
        mesh(new T.SphereGeometry(0.032, 12, 12), std("#3a2a4a", 0.3), face, side * 0.17, 0.05, 0.47);
        mesh(new T.CapsuleGeometry(0.012, 0.09, 4, 8), pHair, face, side * 0.17, 0.14, 0.45).rotation.z = Math.PI / 2;
      });
      mesh(new T.SphereGeometry(0.045, 12, 12), limb, face, 0, -0.04, 0.5);
      const pSmile = mesh(new T.TorusGeometry(0.09, 0.012, 8, 24, Math.PI), std("#a8453f", 0.5), face, 0, -0.14, 0.47); pSmile.rotation.z = Math.PI;

      const scope = new T.Group(); scope.scale.setScalar(SCOPE); scope.rotation.x = Math.PI / 2; exam.add(scope);
      const black = std("#eaf3f4", 0.3, 0.1), steel = std("#b7c9ce", 0.3, 0.15), glove = std("#7fd0cf", 0.55), coat = std("#ffffff", 0.75);
      const head = mesh(new T.CylinderGeometry(0.47, 0.5, 0.3, 64), black, scope, 0, 0.3, 0);
      head.scale.set(1, 1, 1);
      const ring = mesh(new T.TorusGeometry(0.44, 0.03, 16, 96), steel, scope, 0, 0.455, 0); ring.rotation.x = Math.PI / 2;
      const glow = mesh(new T.TorusGeometry(0.5, 0.012, 12, 96), new T.MeshBasicMaterial({ color: "#12b5a6", toneMapped: false }), scope, 0, 0.17, 0); glow.rotation.x = Math.PI / 2;
      const lens = new T.ShaderMaterial({
        vertexShader: passVert, fragmentShader: lensFrag, toneMapped: false,
        uniforms: { ...shared, uCenter: { value: new T.Vector2() }, uSpan: { value: 0.3 }, uScan: { value: 0 }, uTime: { value: 0 } },
      });
      const disc = mesh(new T.CircleGeometry(0.43, 96), lens, scope, 0, 0.456, 0); disc.rotation.x = -Math.PI / 2;
      const handle = new T.Group(); handle.position.set(0.4, 0.34, 0.1); handle.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), new T.Vector3(0.85, 0.3, 0.42).normalize()); scope.add(handle);
      mesh(new T.CapsuleGeometry(0.11, 1.15, 10, 24), black, handle, 0, -0.68, 0);
      mesh(new T.CylinderGeometry(0.115, 0.115, 0.05, 24), steel, handle, 0, -0.2, 0);
      for (let i = 0; i < 4; i++) { // gloved fingers wrap the handle
        const f = mesh(new T.TorusGeometry(0.135, 0.058, 12, 24, Math.PI * 1.45), glove, handle, 0, -0.42 - i * 0.13, 0);
        f.rotation.x = Math.PI / 2; f.rotation.z = 0.7;
      }
      const thumb = mesh(new T.CapsuleGeometry(0.055, 0.25, 8, 16), glove, handle, 0.02, -0.34, 0.14); thumb.rotation.x = 0.25;
      const palm = mesh(new T.SphereGeometry(0.2, 24, 20), glove, handle, 0.14, -0.68, 0.02); palm.scale.set(0.8, 1.7, 1.05);
      mesh(new T.CapsuleGeometry(0.16, 0.5, 8, 20), glove, handle, 0.3, -1.2, 0.08).rotation.z = 0.3;
      // The doctor's sleeve is stretched each frame from wrist to shoulder.
      const reach = mesh(new T.CapsuleGeometry(0.17, 1, 8, 20), coat, exam);

      // ---------- The doctor ----------
      const doc = new T.Group(); scene.add(doc);
      const skinTone = std("#b9794f", 0.55), hairMat = std("#4a2c20", 0.55), dark = std("#1d4e5a", 0.35), teal = std("#1f6f73", 0.7);
      const torso = mesh(new T.CapsuleGeometry(0.72, 1.1, 10, 32), coat, doc, 0, -1.05, 0); torso.scale.z = 0.62;
      mesh(new T.SphereGeometry(0.34, 24, 20), teal, doc, 0, -0.27, 0.3).scale.set(0.62, 0.8, 0.5);
      [-1, 1].forEach((s) => {
        const lapel = mesh(new T.BoxGeometry(0.17, 0.74, 0.05), std("#e6e1dc", 0.8), doc, s * 0.2, -0.56, 0.46);
        lapel.rotation.z = s * 0.3; lapel.rotation.x = -0.1;
      });
      mesh(new T.CylinderGeometry(0.17, 0.21, 0.4, 24), skinTone, doc, 0, 0.0, 0);
      const headG = new T.Group(); headG.position.y = 0.66; doc.add(headG);
      mesh(new T.SphereGeometry(0.56, 48, 40), skinTone, headG).scale.set(0.9, 1.1, 0.95);
      const hair = mesh(new T.SphereGeometry(0.6, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat, headG, 0, 0.1, -0.05); hair.scale.set(0.92, 0.9, 0.96); hair.rotation.x = -0.34;
      [-1, 1].forEach((s) => {
        mesh(new T.SphereGeometry(0.1, 16, 16), skinTone, headG, s * 0.51, 0, 0).scale.set(0.5, 1, 0.7);
        mesh(new T.SphereGeometry(0.095, 24, 20), std("#fffaf4", 0.25), headG, s * 0.19, 0.08, 0.455).scale.set(1.1, 0.9, 0.45);
        mesh(new T.CapsuleGeometry(0.022, 0.15, 6, 10), hairMat, headG, s * 0.2, 0.25, 0.5).rotation.z = Math.PI / 2 + s * -0.14;
        const frame = mesh(new T.TorusGeometry(0.13, 0.012, 10, 40), dark, headG, s * 0.195, 0.08, 0.57); frame.scale.y = 0.86;
      });
      const pupils = [-1, 1].map((s) => mesh(new T.SphereGeometry(0.05, 20, 16), dark, headG, s * 0.19, 0.08, 0.5));
      mesh(new T.BoxGeometry(0.13, 0.014, 0.014), dark, headG, 0, 0.1, 0.57);
      mesh(new T.SphereGeometry(0.055, 16, 16), skinTone, headG, 0, -0.04, 0.53).scale.set(0.9, 1.1, 1);
      const smile = mesh(new T.TorusGeometry(0.14, 0.018, 10, 32, Math.PI), std("#6e2528", 0.5), headG, 0, -0.17, 0.5); smile.rotation.z = Math.PI;
      // stethoscope
      const tube = new T.CatmullRomCurve3([[-0.25,0.05,0.14],[-0.4,-0.25,0.46],[-0.3,-0.75,0.53],[-0.1,-1.02,0.54]].map((a) => new T.Vector3(...a as [number, number, number])));
      const tube2 = new T.CatmullRomCurve3([[0.25,0.05,0.14],[0.4,-0.25,0.46],[0.2,-0.75,0.53],[-0.1,-1.02,0.54]].map((a) => new T.Vector3(...a as [number, number, number])));
      mesh(new T.TubeGeometry(tube, 40, 0.024, 10), dark, doc); mesh(new T.TubeGeometry(tube2, 40, 0.024, 10), dark, doc);
      mesh(new T.CylinderGeometry(0.095, 0.095, 0.05, 28), steel, doc, -0.1, -1.05, 0.55).rotation.x = Math.PI / 2;
      const legs = [-1, 1].map((side) => {
        const leg = new T.Group(); leg.position.set(side * 0.28, -1.75, 0); doc.add(leg);
        mesh(new T.CapsuleGeometry(0.2, 0.75, 8, 16), teal, leg, 0, -0.45, 0);
        mesh(new T.SphereGeometry(0.2, 16, 12), std("#f4f7f7", 0.5), leg, 0, -0.98, 0.09).scale.set(0.95, 0.6, 1.5);
        return leg;
      });
      // left arm rests; right arm raises the thumbs-up
      const rest = mesh(new T.CapsuleGeometry(0.2, 1.3, 8, 20), coat, doc, -0.88, -0.86, 0); rest.rotation.z = -0.14;
      const shoulder = new T.Group(); shoulder.position.set(0.68, -0.22, 0); doc.add(shoulder);
      mesh(new T.CapsuleGeometry(0.2, 0.62, 8, 20), coat, shoulder, 0, -0.38, 0);
      const elbow = new T.Group(); elbow.position.y = -0.8; shoulder.add(elbow);
      mesh(new T.CapsuleGeometry(0.17, 0.55, 8, 20), coat, elbow, 0, -0.34, 0);
      const hand = new T.Group(); hand.position.y = -0.82; elbow.add(hand);
      const fist = mesh(new T.SphereGeometry(0.2, 24, 20), glove, hand); fist.scale.set(1, 1.05, 0.85);
      for (let i = 0; i < 4; i++) {
        const c = mesh(new T.CapsuleGeometry(0.056, 0.17, 6, 12), glove, hand, -0.12, 0.13 - i * 0.087, 0.12); c.rotation.z = Math.PI / 2;
      }
      const thumbUp = new T.Group(); thumbUp.position.set(0.06, 0.14, 0); hand.add(thumbUp);
      mesh(new T.CapsuleGeometry(0.066, 0.25, 8, 16), glove, thumbUp, 0, 0.16, 0);

      const N = 360, confettiGeo = new T.BufferGeometry(), cp = new Float32Array(N * 3), cc = new Float32Array(N * 3), vel: number[][] = [];
      const palette = ["#0a7f85", "#2bb6ae", "#4a9be0", "#e2604e", "#f2b632"].map((c) => new T.Color(c));
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 4.3;
        vel.push([Math.cos(a) * s, 2.5 + Math.random() * 4.5, (Math.random() - 0.5) * 3]);
        palette[i % 5].toArray(cc, i * 3);
      }
      confettiGeo.setAttribute("position", new T.BufferAttribute(cp, 3));
      confettiGeo.setAttribute("color", new T.BufferAttribute(cc, 3));
      const confetti = new T.Points(confettiGeo, new T.PointsMaterial({ size: 0.075, vertexColors: true, transparent: true, toneMapped: false }));
      confetti.frustumCulled = false; doc.add(confetti);

      // ---------- Direction ----------
      const captions = Array.from(section.querySelectorAll<HTMLElement>("[data-from]"));
      const SPOTS = [[0.8, 0.3], [-0.3, 0.98], [-0.8, 0.3]], UP = new T.Vector3(0, 1, 0);
      const look = new T.Vector3(), camPos = new T.Vector3(), a = new T.Vector3(), b = new T.Vector3();
      const mouse = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; };
      const resize = () => {
        const w = el.clientWidth, h = el.clientHeight;
        renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
      };
      resize();
      addEventListener("resize", resize);
      addEventListener("pointermove", onMove, { passive: true });

      let visible = false;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: "20% 0px" });
      io.observe(el);

      let p = examState.progress, raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!visible || document.hidden) return;
        const t = performance.now() / 1000;
        p += (examState.progress - p) * 0.09;
        const wide = camera.aspect > 1;

        captions.forEach((c) => c.classList.toggle("on", p >= Number(c.dataset.from) && p < Number(c.dataset.to)));

        const inExam = p < 0.76;
        exam.visible = inExam;
        const cut = Math.max(1 - Math.abs(p - 0.76) / 0.018, 0); // soft cut to the doctor's verdict
        el.style.opacity = String(1 - cut);

        if (inExam) {
          // The patient waits. The doctor walks in from the door on the right.
          const arrive = ss(0.0, 0.14, p), lean = ss(0.14, 0.18, p) * (1 - ss(0.62, 0.66, p));
          const stand = wide ? 0.55 : 0.3;
          doc.position.set(4.7 + (stand - 4.7) * arrive, 2.72 + Math.abs(Math.sin(p * 90)) * 0.05 * (1 - arrive), 0.1);
          doc.rotation.z = 0.17 * lean;
          doc.scale.setScalar(1);
          const stride = Math.sin(p * 90) * 0.55 * (1 - arrive);
          legs[0].rotation.x = stride; legs[1].rotation.x = -stride;
          shoulder.visible = false; rest.visible = false; confetti.visible = false; thumbUp.scale.setScalar(1);

          // The patient looks up at the doctor, then holds still for the check.
          face.rotation.y = 0.5 * arrive * (1 - lean) + 0.04 * Math.sin(t * 0.7);
          face.rotation.x = -0.05 * arrive * (1 - lean);
          patient.position.y = Math.sin(t * 1.2) * 0.004;

          // The scope searches each spot on the face, then the view dives into the lens.
          let px = 1.5, py = -0.2, dive = 0;
          SPOTS.forEach(([x, y], i) => {
            const s0 = 0.16 + i * 0.15, move = ss(s0, s0 + 0.04, p);
            px += (x - px) * move; py += (y - py) * move;
            dive = Math.max(dive, ss(s0 + 0.04, s0 + 0.07, p) - ss(s0 + 0.11, s0 + 0.14, p));
          });
          const leave = ss(0.61, 0.65, p);
          px += (1.5 - px) * leave; py += (-0.2 - py) * leave;
          const hunt = ss(0.14, 0.17, p) * (1 - leave) * (1 - dive);
          px += Math.sin(t * 1.1) * 0.05 * hunt; py += Math.cos(t * 1.6) * 0.04 * hunt;
          const lx = px / 2.4, ly = (py - 0.55) / 2.4;
          a.set(lx, ly, Math.sqrt(Math.max(0.01, 0.25 - lx * lx - ly * ly)) + 0.02);
          exam.updateMatrixWorld(true); face.localToWorld(a);
          // Until the doctor arrives the scope is carried at their side.
          const reachOut = ss(0.13, 0.17, p) * (1 - leave);
          b.set(doc.position.x - 0.75, 1.55, 0.45);
          scope.position.lerpVectors(b, a, reachOut);
          a.copy(scope.position);
          const lensZ = a.z + 0.456 * SCOPE;
          const lensX = a.x, lensY = a.y;
          lens.uniforms.uCenter.value.set(px, py);
          lens.uniforms.uScan.value = t * 0.3;
          lens.uniforms.uTime.value = dive;
          faceU.uScope.value.set(px, py);
          faceU.uGlow.value = ss(0.14, 0.18, p) * (1 - leave);
          faceU.uTime.value = t;
          shared.uHeal.value = ss(0.64, 0.75, p);

          // Sleeve from the glove to the doctor's near shoulder.
          scope.updateMatrixWorld(true); doc.updateMatrixWorld(true);
          a.set(0.3, -1.4, 0.08); handle.localToWorld(a);
          b.set(-0.68, -0.22, 0); doc.localToWorld(b);
          reach.position.copy(a).add(b).multiplyScalar(0.5);
          reach.scale.y = a.distanceTo(b) / 1.34;
          reach.quaternion.setFromUnitVectors(UP, b.sub(a).normalize());

          headG.rotation.y = -0.75 * arrive; headG.rotation.x = 0.28 * arrive; headG.rotation.z = 0;
          smile.scale.setScalar(0.72);

          // Whole room, then close on the face, then right down the lens on each spot.
          const face2 = ss(0.14, 0.2, p) * (1 - ss(0.62, 0.66, p) * 0.75);
          const room = wide ? 8 : 12.5;
          a.set(mouse.x * 0.4 + (-1.1 + (wide ? 0.9 : 0.95)) * (1 - face2) - 1.1 * face2 + (wide ? 0.9 : 0) * face2, 2.1 + 0.3 * face2, room - (room - (wide ? 4 : 6.5)) * face2);
          b.set(lensX, lensY, lensZ + 0.55 * SCOPE + 0.12);
          camPos.lerpVectors(a, b, dive);
          look.set(a.x + (lensX - a.x) * dive, (2.1 + 0.3 * face2) + (lensY - 2.4) * dive, 0);
          camera.up.set(0, 1, 0);
          camera.position.copy(camPos); camera.lookAt(look);
        } else {
          shoulder.visible = true; rest.visible = true; doc.rotation.z = 0;
          legs[0].rotation.x = 0; legs[1].rotation.x = 0;
          const rise = ss(0.76, 0.81, p), raise = ss(0.81, 0.87, p), pop = back(ss(0.86, 0.9, p));
          camera.up.set(0, 1, 0);
          camera.position.set(mouse.x * 0.3, 0.1, (wide ? 6 : 9) - ss(0.76, 0.95, p) * 0.45);
          camera.lookAt(0, 0.1, 0);
                    doc.position.set(wide ? 1.2 : -0.1, (wide ? -0.15 : -1.15) - (1 - rise) * 3.2, 0);
          shoulder.rotation.z = 0.1 + raise * 0.5;
          elbow.rotation.z = raise * 2.35;
          hand.rotation.z = -raise * 2.95;
          thumbUp.scale.setScalar(Math.max(0.01, pop));
          headG.rotation.y = Math.sin(t * 0.8) * 0.05 + mouse.x * 0.45;
          headG.rotation.x = mouse.y * 0.22 - 0.02;
          headG.rotation.z = -raise * 0.09;
          const blink = Math.sin(t * 2.1) > 0.985 ? 0.1 : 1;
          pupils.forEach((pu) => { pu.scale.y = blink; pu.position.x = Math.sign(pu.position.x) * 0.19 + mouse.x * 0.07; });
          smile.scale.setScalar(0.72 + raise * 0.48);
          const burst = Math.max(0, (p - 0.885) / 0.11) * 1.15;
          confetti.visible = burst > 0;
          const pos = confettiGeo.getAttribute("position");
          for (let i = 0; i < N; i++) {
            const v = vel[i];
            pos.setXYZ(i, 0.85 + v[0] * burst, 1.3 + v[1] * burst - 5 * burst * burst, v[2] * burst);
          }
          pos.needsUpdate = true;
        }
        renderer.render(scene, camera);
      };
      tick();

      cleanup = () => {
        cancelAnimationFrame(raf); io.disconnect();
        removeEventListener("resize", resize); removeEventListener("pointermove", onMove);
        scene.traverse((o) => {
          const m = o as InstanceType<typeof T.Mesh>;
          m.geometry?.dispose();
          (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach((x) => x.dispose());
        });
        renderer.dispose(); renderer.domElement.remove();
      };
    });
    return () => { cancelled = true; cleanup(); };
  }, []);

  return <div ref={host} className="exam-canvas" aria-hidden="true" />;
}
