/* ============ CONFIGURACIÓN (edita aquí) ============
   Todas las posiciones son NORMALIZADAS (0–1) sobre la imagen del mapa (assets/world-map.jpg),
   así que siguen alineadas con su lugar aunque cambie la ventana. */
const CONFIG = {
  map: { src: "assets/world-map.jpg", w: 1280, h: 1001, worldWidth: 2000,
         crop: { x0: 0.012, y0: 0.036, x1: 0.988, y1: 0.872 } },   // zona navegable (sin leyendas ni banderas)
  view: { fracX: 0.4, fracY: 0.32 },                               // fracción del mapa visible: menor = más zoom
  flight: { start: [0.44, 0.30], startHeading: 0, cruise: 95, boost: 135, accel: 1.4, inertia: 2.2, turnRate: 2.1, turnSmoothing: 4 },
  smoke: { offset: [-24, 0], rate: 20, max: 70 },                  // punto de emisión relativo al avión (unid. mundo)
  transitionMs: 2400, polaroidWidth: 112,
  hint: { keys: "usa las flechas ← ↑ → ↓ para volar", touch: "desliza el dedo para guiar el avión" },
  landmarks: [  // ilustraciones recortadas de lugares (NO son fotos familiares)
    { name: "París",      kind: "eiffel",  x: 0.506, y: 0.290 },
    { name: "Roma",       kind: "dome",    x: 0.533, y: 0.322 },
    { name: "Egipto",     kind: "pyramid", x: 0.584, y: 0.372 },
    { name: "Nueva York", kind: "liberty", x: 0.327, y: 0.306 },
    { name: "Río",        kind: "cristo",  x: 0.394, y: 0.556 },
    { name: "Japón",      kind: "fuji",    x: 0.859, y: 0.322 }
  ],
  memories: [   // Polaroid de recuerdos familiares. "image": tu foto; si no existe se dibuja una ilustración de demostración
    { x: 0.445, y: 0.215, rot: -5, type: "abrazo",   caption: "un abrazo",     image: "assets/memories/memory-1.jpg" },
    { x: 0.585, y: 0.235, rot: 4,  type: "casa",     caption: "en casa",       image: "assets/memories/memory-2.jpg" },
    { x: 0.500, y: 0.440, rot: -3, type: "mascota",  caption: "mi compañero",  image: "assets/memories/memory-3.jpg" },
    { x: 0.325, y: 0.425, rot: 5,  type: "infancia", caption: "de pequeño",    image: "assets/memories/memory-4.jpg" },
    { x: 0.460, y: 0.620, rot: -4, type: "familia",  caption: "en familia",    image: "assets/memories/memory-5.jpg" },
    { x: 0.800, y: 0.410, rot: 3,  type: "selfie",   caption: "juntos",        image: "assets/memories/memory-6.jpg" },
    { x: 0.660, y: 0.470, rot: -5, type: "juegos",   caption: "día de juegos", image: "assets/memories/memory-7.jpg" }
  ],
  cardPhotos: [ // Polaroid de la tarjeta inicial (posición en %)
    { type: "selfie", image: "assets/memories/card-1.jpg", cap: "mamá",  css: "right:6%;top:6%;--w:clamp(110px,22vw,300px);--r:4deg" },
    { type: "abrazo", image: "assets/memories/card-2.jpg", cap: "juntos", css: "right:7%;bottom:6%;--w:clamp(110px,20vw,280px);--r:-6deg" }
  ]
};

(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, K = reduce ? 0.3 : 1;
  const M = CONFIG.map, F = CONFIG.flight, C = M.crop;
  const WW = M.worldWidth, WH = WW * M.h / M.w;                    // el mundo mide WW x WH "unidades"
  const stage = $("#stage"), card = $("#card"), world = $("#world"), plane = $("#plane"), cardPlane = $("#cardPlane"),
        pols = $("#pols"), pauseBtn = $("#pause"), trailPath = $("#trailPath"), hint = $("#hint"), fly = $("#flyHint"),
        cv = $("#smoke"), ctx = cv.getContext("2d");
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const bx0 = C.x0 * WW, bx1 = C.x1 * WW, by0 = C.y0 * WH, by1 = C.y1 * WH; // límites del mundo navegable

  /* ---------- Mundo: mapa + capas (todo comparte el mismo sistema) ---------- */
  world.style.width = WW + "px"; world.style.height = WH + "px";
  const mapImg = $("#mapImg"); mapImg.onerror = () => { mapImg.style.display = "none"; }; // sin imagen: queda el papel
  const trail = $("#trail"); trail.setAttribute("viewBox", `0 0 ${WW} ${WH}`);
  trailPath.style.stroke = "#a5453a"; trailPath.style.strokeLinecap = "round"; trailPath.style.opacity = ".9";
  pols.style.cssText = `position:absolute;left:0;top:0;width:${WW}px;height:${WH}px`;

  /* ---------- Ilustraciones de lugares (siluetas recortadas) ---------- */
  const ICON = {
    eiffel: "M30 4l3 20 9 32h-6l-6-18-6 18h-6l9-32z", dome: "M8 56V38h44v18zM14 38a16 16 0 0132 0zM29 8h2v8h-2z",
    pyramid: "M3 56L30 12l27 44zM30 12l27 44H38z", liberty: "M24 56V38l6-4 6 4v18zM28 34l2-14 2 14zM34 24l8-14 2 2-6 14zM26 20h8v-4h-8z",
    cristo: "M28 8h4v12h16v5H32v12l5 19H23l5-19V25H12v-5h16z", fuji: "M2 56L24 24l6-9 6 9 22 32z"
  };
  CONFIG.landmarks.forEach((l, i) => {
    const d = document.createElement("div"); d.className = "cutout"; d.style.left = l.x * WW + "px"; d.style.top = l.y * WH + "px";
    d.innerHTML = `<div class="fl" style="animation-delay:${-i * 1.3}s"><svg viewBox="0 0 60 60"><path d="${ICON[l.kind]}" fill="#f1e6c8" stroke="#3b2a18" stroke-width="2.2" stroke-linejoin="round"/></svg></div><i>${l.name}</i>`;
    pols.append(d);
  });

  /* ---------- Fotos familiares provisionales (ilustraciones de demostración) ---------- */
  const person = (x, y, s, sk, hr, sh) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="64" rx="36" ry="30" fill="${sh}"/><circle r="25" fill="${sk}"/><path d="M-26-2a26 26 0 0152 0q-13-13-26-10-13-3-26 10z" fill="${hr}"/><circle cx="-8" cy="3" r="2.4" fill="#3b2a18"/><circle cx="8" cy="3" r="2.4" fill="#3b2a18"/><path d="M-10 12q10 9 20 0" stroke="#7a3b2a" fill="none" stroke-width="2.6" stroke-linecap="round"/></g>`;
  const dog = (x, y) => `<g transform="translate(${x} ${y})"><ellipse cy="40" rx="30" ry="20" fill="#e9e0cc"/><circle r="22" fill="#f3ecda"/><ellipse cx="-17" cy="-4" rx="7" ry="14" fill="#d9c39a" transform="rotate(20 -17 -4)"/><circle cx="-6" cy="-2" r="2.6" fill="#3b2a18"/><circle cx="9" cy="-2" r="2.6" fill="#3b2a18"/><ellipse cx="3" cy="8" rx="5" ry="3.5" fill="#3b2a18"/></g>`;
  const SK = "#e0b48c", SK2 = "#c99669", DK = "#3a2a20", BR = "#6b4528", RD = "#8a4a32";
  const SCENE = {
    abrazo: person(78, 96, 1.15, SK, DK, "#c9d4e0") + person(128, 112, .85, SK2, BR, "#e3c25a"),
    casa: `<rect x="120" y="20" width="60" height="70" fill="#e9dcc0" stroke="#8a6a44" stroke-width="4"/>` + person(62, 110, 1, SK, RD, "#a8b8a0") + person(130, 126, .7, SK2, DK, "#c9d4e0"),
    mascota: person(70, 100, 1.1, SK, RD, "#b9a8c8") + dog(140, 124),
    infancia: person(100, 118, 1.55, SK2, BR, "#e3c25a") + `<ellipse cx="160" cy="46" rx="14" ry="18" fill="#a5453a"/><path d="M160 64q-4 30-30 40" stroke="#3b2a18" fill="none"/>`,
    familia: person(55, 110, .95, SK, DK, "#c9d4e0") + person(100, 96, 1.05, SK2, RD, "#e3c25a") + person(148, 114, .8, SK, BR, "#a8b8a0"),
    selfie: person(66, 90, 1.25, SK, DK, "#c9d4e0") + person(132, 108, 1, SK2, RD, "#e9e0cc") + dog(165, 150),
    juegos: person(70, 112, .95, SK, RD, "#a8b8a0") + person(135, 126, .75, SK2, BR, "#e3c25a") + `<circle cx="104" cy="170" r="14" fill="#a5453a"/>`
  };
  const photo = t => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8cf9e"/><stop offset="1" stop-color="#b98f5a"/></linearGradient><radialGradient id="v"><stop offset=".55" stop-opacity="0"/><stop offset="1" stop-color="#3b2a18" stop-opacity=".5"/></radialGradient></defs><rect width="200" height="200" fill="url(#g)"/>${SCENE[t] || SCENE.familia}<rect width="200" height="200" fill="url(#v)"/></svg>`);
  function polaroid(c, w) {
    const el = document.createElement("div"); el.className = "pol"; if (w) el.style.setProperty("--w", w + "px");
    const inn = document.createElement("div"); inn.className = "pol-in"; inn.style.setProperty("--r", (c.rot || 0) + "deg");
    const img = new Image(); img.alt = "Recuerdo: " + (c.caption || c.cap || "foto familiar"); img.draggable = false;
    img.onerror = () => { img.onerror = null; img.src = photo(c.type); };
    img.src = c.image || photo(c.type);
    const sp = document.createElement("span"); sp.textContent = c.caption || c.cap || "";
    inn.append(img, sp); el.append(inn); return el;
  }
  CONFIG.memories.forEach((c, i) => {
    const w = c.size || CONFIG.polaroidWidth, p = polaroid(c, w);
    p.style.left = c.x * WW - w / 2 + "px"; p.style.top = c.y * WH - w * .62 + "px"; p.firstChild.style.animationDelay = -i * 1.7 + "s"; pols.append(p);
  });

  /* ---------- Tarjeta inicial ---------- */
  const deco = $("#cardDeco");
  CONFIG.cardPhotos.forEach(c => { const p = polaroid({ ...c, rot: 0 }); p.style.cssText += c.css; p.firstChild.style.transform = "rotate(var(--r))"; p.firstChild.style.setProperty("--r", c.css.match(/--r:(-?\d+deg)/)[1]); deco.append(p); });
  [["left:2%;bottom:3%;width:clamp(120px,28vw,380px);height:clamp(90px,19vw,260px)", "20 130 360 220"], ["left:30%;bottom:0;width:clamp(120px,26vw,360px);height:clamp(70px,14vw,200px)", "560 150 300 150"]].forEach(([css, vb], i) => {
    const d = document.createElement("div"); d.className = "cut patch"; d.style.cssText = css + (i ? ";border-bottom:0" : ""); d.style.zIndex = i ? 1 : 0;
    d.innerHTML = `<img src="${M.src}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:${i ? "60% 40%" : "5% 60%"};filter:sepia(.3) saturate(.85)">`; deco.append(d);
  });

  /* ---------- Estado, cámara y vuelo ---------- */
  let state = "initial", vw = 0, vh = 0, s = 1, cx = 0, cy = 0, raf = 0, last = 0, dpr = 1, hintShown = false;
  const P = { x: F.start[0] * WW, y: F.start[1] * WH, a: F.startHeading, ang: F.startHeading, vx: 0, vy: 0, sp: 0 };
  const keys = new Set(), touch = { id: null, x: 0, y: 0 };
  let trail_d = `M${P.x.toFixed(1)} ${P.y.toFixed(1)}`, lastPt = { x: P.x, y: P.y };
  const setState = n => { state = n; stage.dataset.state = n; };

  function resize() {
    vw = innerWidth; vh = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    s = Math.max(vw / (CONFIG.view.fracX * WW), vh / (CONFIG.view.fracY * WH), vw / ((C.x1 - C.x0) * WW), vh / ((C.y1 - C.y0) * WH));
    cv.width = vw * dpr; cv.height = vh * dpr; camera(0, true); draw(); drawSmoke();
  }
  function camera(dt, snap) {
    const lx = P.x + P.vx * .6, ly = P.y + P.vy * .6;                // la cámara mira un poco por delante del avión
    const tx = clamp(lx * s - vw / 2, bx0 * s, bx1 * s - vw), ty = clamp(ly * s - vh / 2, by0 * s, by1 * s - vh), k = snap ? 1 : 1 - Math.exp(-2.5 * dt);
    cx += (tx - cx) * k; cy += (ty - cy) * k;
  }
  function draw() {
    world.style.transform = `translate3d(${-cx}px,${-cy}px,0) scale(${s})`;
    plane.style.transform = `translate(${P.x}px,${P.y}px) rotate(${P.ang}rad)`;
  }

  /* Humo: pool fijo, partículas en coordenadas del mundo */
  const spr = document.createElement("canvas"); spr.width = spr.height = 64;
  { const g = spr.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(236,230,216,.95)"); r.addColorStop(.5, "rgba(222,214,198,.5)"); r.addColorStop(1, "rgba(215,205,188,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }
  const pool = Array.from({ length: CONFIG.smoke.max }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, s0: 5 }));
  let emit = 0;
  function spawn() {
    const p = pool.find(q => !q.on); if (!p) return; const o = CONFIG.smoke.offset, c = Math.cos(P.ang), n = Math.sin(P.ang);
    p.on = true; p.x = P.x + o[0] * c - o[1] * n; p.y = P.y + o[0] * n + o[1] * c; p.vx = -c * 8 + (Math.random() - .5) * 10; p.vy = -n * 8 + (Math.random() - .5) * 10;
    p.age = 0; p.life = 1.5 + Math.random() * .8; p.s0 = 4 + Math.random() * 3;
  }
  function smokeStep(dt) {
    emit += CONFIG.smoke.rate * dt * Math.min(1, P.sp / F.cruise); while (emit >= 1) { spawn(); emit--; }
    for (const p of pool) if (p.on) { p.age += dt; if (p.age >= p.life) p.on = false; else { p.x += p.vx * dt; p.y += p.vy * dt; } }
  }
  function drawSmoke() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, vw, vh);
    for (const p of pool) if (p.on) { const t = p.age / p.life, r = (p.s0 + t * 16) * s; ctx.globalAlpha = .38 * Math.pow(1 - t, 1.3); ctx.drawImage(spr, p.x * s - cx - r, p.y * s - cy - r, r * 2, r * 2); }
    ctx.globalAlpha = 1;
  }

  /* Entrada: flechas (teclado) o dedo (táctil). El ratón NO dirige el avión. */
  function input() {
    let ix = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0), iy = (keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0);
    if (touch.id !== null) { const dx = touch.x - (P.x * s - cx), dy = touch.y - (P.y * s - cy); if (Math.hypot(dx, dy) > 40) { ix = dx; iy = dy; } }
    const l = Math.hypot(ix, iy); return l ? [ix / l, iy / l] : null;           // normalizado: la diagonal no acelera más
  }
  function step(dt) {
    const inp = input();
    if (inp) {
      const d = wrap(Math.atan2(inp[1], inp[0]) - P.a), mt = F.turnRate * dt;
      P.a = wrap(P.a + clamp(d * (1 - Math.exp(-F.turnSmoothing * dt)), -mt, mt));
      if (!hintShown) { hintShown = true; fly.classList.remove("on"); }
    } else if (P.x < bx0 + 60 || P.x > bx1 - 60 || P.y < by0 + 60 || P.y > by1 - 60) {   // cerca del borde: vira suavemente hacia dentro
      const d = wrap(Math.atan2((by0 + by1) / 2 - P.y, (bx0 + bx1) / 2 - P.x) - P.a); P.a = wrap(P.a + clamp(d * dt * 1.5, -F.turnRate * dt * .6, F.turnRate * dt * .6));
    }
    P.sp += ((inp ? F.boost : F.cruise) - P.sp) * (1 - Math.exp(-F.accel * dt));
    const k = 1 - Math.exp(-F.inertia * dt);                                   // inercia: la velocidad real persigue a la deseada
    P.vx += (Math.cos(P.a) * P.sp - P.vx) * k; P.vy += (Math.sin(P.a) * P.sp - P.vy) * k;
    P.x = clamp(P.x + P.vx * dt, bx0, bx1); P.y = clamp(P.y + P.vy * dt, by0, by1);
    if (Math.hypot(P.vx, P.vy) > 8) P.ang = wrap(P.ang + wrap(Math.atan2(P.vy, P.vx) - P.ang) * (1 - Math.exp(-10 * dt)));
    if (Math.hypot(P.x - lastPt.x, P.y - lastPt.y) > 10) { lastPt = { x: P.x, y: P.y }; trail_d += `L${P.x.toFixed(1)} ${P.y.toFixed(1)}`; trailPath.setAttribute("d", trail_d); }
    smokeStep(dt); camera(dt);
  }
  function loop(now) {
    if (state !== "flying") return;
    const dt = last ? Math.min((now - last) / 1000, .05) : 0; last = now;
    step(dt); draw(); drawSmoke(); raf = requestAnimationFrame(loop);
  }
  const startLoop = () => { last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); };

  /* ---------- Transición tarjeta → mapa ---------- */
  function start() {
    if (state !== "initial") return;
    setState("transitioning"); hint.style.opacity = 0; card.blur();
    const r = cardPlane.getBoundingClientRect(), sx = P.x * s - cx, sy = P.y * s - cy, D = CONFIG.transitionMs * K;
    const dx = sx - (r.left + r.width / 2), dy = sy - (r.top + r.height / 2), sc = (56 * s) / r.width;
    world.style.transition = `opacity ${D * .7}ms ease ${D * .25}ms`; world.style.opacity = 1;
    card.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.06)" }], { duration: D * .75, delay: D * .25, fill: "forwards", easing: "ease-in-out" });
    cardPlane.animate([
      { transform: "translate(0,0) rotate(-28deg) scale(1)" },
      { transform: `translate(${dx * .3}px,${dy * .1 - 30}px) rotate(-34deg) scale(1.1)`, offset: .3 },
      { transform: `translate(${dx}px,${dy}px) rotate(${F.startHeading}rad) scale(${sc})` }
    ], { duration: D, easing: "cubic-bezier(.45,0,.3,1)", fill: "forwards" }).finished.then(() => {
      plane.style.opacity = 1; cardPlane.style.display = "none"; card.style.display = hint.style.display = "none";
      P.sp = F.cruise * .6; P.vx = Math.cos(P.a) * P.sp; P.vy = Math.sin(P.a) * P.sp;
      fly.textContent = matchMedia("(pointer:coarse)").matches ? CONFIG.hint.touch : CONFIG.hint.keys; fly.classList.add("on"); setTimeout(() => fly.classList.remove("on"), 8000);
      setState("flying"); startLoop();
    });
  }

  /* ---------- Pausa ---------- */
  function togglePause() {
    if (state === "flying") { cancelAnimationFrame(raf); keys.clear(); touch.id = null; setState("paused"); pauseBtn.setAttribute("aria-pressed", "true"); pauseBtn.setAttribute("aria-label", "Reanudar viaje"); }
    else if (state === "paused") { setState("flying"); pauseBtn.setAttribute("aria-pressed", "false"); pauseBtn.setAttribute("aria-label", "Pausar viaje"); startLoop(); }
  }

  /* ---------- Eventos ---------- */
  stage.addEventListener("pointerdown", e => {
    if (e.target.closest("#pause")) return;
    if (state === "initial") start();
    else if (state === "flying" && e.pointerType === "touch") { touch.id = e.pointerId; touch.x = e.clientX; touch.y = e.clientY; }
  });
  stage.addEventListener("pointermove", e => { if (e.pointerId === touch.id) { touch.x = e.clientX; touch.y = e.clientY; } });
  ["pointerup", "pointercancel"].forEach(t => addEventListener(t, e => { if (e.pointerId === touch.id) touch.id = null; }));
  pauseBtn.addEventListener("pointerdown", e => e.stopPropagation());
  pauseBtn.addEventListener("click", e => { e.stopPropagation(); togglePause(); });
  card.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); start(); } });
  const isForm = t => t && t.closest && t.closest("input,textarea,select,[contenteditable='true']");
  document.addEventListener("keydown", e => {
    if (isForm(e.target)) return;
    if (e.code === "Space") { if (e.target.closest && e.target.closest("button")) return; e.preventDefault(); if (state === "initial") start(); return; }
    if (e.key.startsWith("Arrow") && state === "flying") { e.preventDefault(); keys.add(e.key); }
  });
  document.addEventListener("keyup", e => keys.delete(e.key));
  addEventListener("blur", () => { keys.clear(); touch.id = null; });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { keys.clear(); if (state === "flying") togglePause(); } });
  addEventListener("resize", resize);
  resize();
})();
