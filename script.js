/* ============ CONFIGURACIÓN (edita aquí) ============
   Posiciones "x,y" de las Polaroid: NORMALIZADAS (0–1) sobre la imagen original del mapa (1280x1001).
   Para cambiar una foto edita solo "image". Si el archivo no existe se dibuja una ilustración de demostración. */
const CONFIG = {
  postal: { w: 1748, h: 1240, plane: { x: 21, y: 780, w: 468, h: 252 } },   // postal original y posición del avión recortado en ella
  map: { src: "assets/world-map-tile.png", w: 1280, h: 1001, crop: { x: 14, y: 36, w: 1252, h: 840, overlap: 32 } },
  view: { fracX: 0.5, fracY: 0.6 },                                         // fracción del mapa visible (mayor = menos zoom)
  flight: { start: [0.44, 0.30], planeWidth: 78, cruise: 95, boost: 135, accel: 1.4, inertia: 2.2, turnRate: 2.1, turnSmoothing: 4, yMin: 40, yMax: 580, maxPitch: 0.95 },
  smoke: { offset: [70, 30], rate: 20, max: 70 },                           // emisión relativa al avión (px del recorte)
  transitionMs: 2600, polaroidWidth: 112,
  hint: { keys: "usa las flechas ← ↑ → ↓ para volar", touch: "desliza el dedo para guiar el avión" },
  memories: [
    { x: 0.445, y: 0.215, rot: -5, image: "assets/memories/memory-1.jpg" },
    { x: 0.585, y: 0.235, rot: 4,  image: "assets/memories/memory-2.jpg" },
    { x: 0.500, y: 0.440, rot: -3, image: "assets/memories/memory-3.jpg" },
    { x: 0.325, y: 0.425, rot: 5,  image: "assets/memories/memory-4.jpg" },
    { x: 0.460, y: 0.600, rot: -4, image: "assets/memories/memory-5.jpg" },
    { x: 0.800, y: 0.410, rot: 3,  image: "assets/memories/memory-6.jpg" },
    { x: 0.660, y: 0.470, rot: -5, image: "assets/memories/memory-7.jpg" }
  ]
};

(() => {
  "use strict";
  const $ = q => document.querySelector(q);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, K = reduce ? 0.3 : 1;
  const M = CONFIG.map, F = CONFIG.flight, PP = CONFIG.postal, SPR_W = PP.plane.w;
  const TW = M.crop.w - M.crop.overlap, TH = M.crop.h;                      // periodo horizontal del mundo y alto (unidades = px del mapa)
  const stage = $("#stage"), card = $("#card"), plane = $("#plane"), pauseBtn = $("#pause"), hint = $("#hint"), fly = $("#flyHint"),
        trailPath = $("#trailPath"), trailSvg = $("#trail"), cv = $("#smoke"), ctx = cv.getContext("2d"),
        layers = [$("#mapTiles"), $("#world"), $("#photoTiles")];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const toWorld = (nx, ny) => [nx * M.w - M.crop.x, ny * M.h - M.crop.y];

  /* ---------- Fotos provisionales de demostración (ilustraciones, no fotos reales) ---------- */
  const person = (x, y, s, sk, hr, sh) => `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="64" rx="36" ry="30" fill="${sh}"/><circle r="25" fill="${sk}"/><path d="M-26-2a26 26 0 0152 0q-13-13-26-10-13-3-26 10z" fill="${hr}"/><circle cx="-8" cy="3" r="2.4" fill="#3b2a18"/><circle cx="8" cy="3" r="2.4" fill="#3b2a18"/><path d="M-10 12q10 9 20 0" stroke="#7a3b2a" fill="none" stroke-width="2.6" stroke-linecap="round"/></g>`;
  const dog = (x, y) => `<g transform="translate(${x} ${y})"><ellipse cy="40" rx="30" ry="20" fill="#e9e0cc"/><circle r="22" fill="#f3ecda"/><ellipse cx="-17" cy="-4" rx="7" ry="14" fill="#d9c39a" transform="rotate(20 -17 -4)"/><circle cx="-6" cy="-2" r="2.6" fill="#3b2a18"/><circle cx="9" cy="-2" r="2.6" fill="#3b2a18"/><ellipse cx="3" cy="8" rx="5" ry="3.5" fill="#3b2a18"/></g>`;
  const SK = "#e0b48c", SK2 = "#c99669", DK = "#3a2a20", BR = "#6b4528", RD = "#8a4a32";
  const SCENE = {
    mascota: person(70, 100, 1.1, SK, RD, "#b9a8c8") + dog(140, 124),
    infancia: person(100, 118, 1.55, SK2, BR, "#e3c25a") + `<ellipse cx="160" cy="46" rx="14" ry="18" fill="#a5453a"/><path d="M160 64q-4 30-30 40" stroke="#3b2a18" fill="none"/>`,
    familia: person(55, 110, .95, SK, DK, "#c9d4e0") + person(100, 96, 1.05, SK2, RD, "#e3c25a") + person(148, 114, .8, SK, BR, "#a8b8a0"),
    selfie: person(66, 90, 1.25, SK, DK, "#c9d4e0") + person(132, 108, 1, SK2, RD, "#e9e0cc") + dog(165, 150),
    juegos: person(70, 112, .95, SK, RD, "#a8b8a0") + person(135, 126, .75, SK2, BR, "#e3c25a") + `<circle cx="104" cy="170" r="14" fill="#a5453a"/>`
  };
  const demo = t => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8cf9e"/><stop offset="1" stop-color="#b98f5a"/></linearGradient><radialGradient id="v"><stop offset=".55" stop-opacity="0"/><stop offset="1" stop-color="#3b2a18" stop-opacity=".5"/></radialGradient></defs><rect width="200" height="200" fill="url(#g)"/>${SCENE[t] || SCENE.familia}<rect width="200" height="200" fill="url(#v)"/></svg>`);
  function polaroid(c) {                       // solo foto + marco: sin textos
    const w = c.size || CONFIG.polaroidWidth, el = document.createElement("div"); el.className = "pol";
    const [wx, wy] = toWorld(c.x, c.y); el.style.cssText = `width:${w}px;left:${wx - w / 2}px;top:${wy - w * .62}px`;
    const inn = document.createElement("div"); inn.className = "pol-in"; inn.style.setProperty("--r", c.rot + "deg");
    const img = new Image(); img.alt = "Recuerdo familiar"; img.draggable = false;
    img.onerror = () => { img.onerror = null; img.src = demo(c.demo); }; img.src = c.image;
    inn.append(img); el.append(inn); return el;
  }

  /* ---------- Teselas: 3 copias contiguas del mapa y de las fotos (mundo periódico en X) ---------- */
  const tiles = (host, fill) => Array.from({ length: 3 }, () => { const t = document.createElement("div"); t.className = "tile"; fill(t); host.append(t); return t; });
  const mapT = tiles($("#mapTiles"), t => { const i = new Image(); i.className = "map"; i.alt = ""; i.draggable = false; i.src = M.src; i.style.cssText = `width:${TW + 4}px;height:${TH}px`; t.append(i); });
  const photoT = tiles($("#photoTiles"), t => CONFIG.memories.forEach(c => t.append(polaroid(c))));

  /* ---------- Estado, cámara y vuelo ---------- */
  let state = "initial", vw = 0, vh = 0, s = 1, cx = 0, cy = 0, raf = 0, last = 0, dpr = 1, hintShown = false;
  const P = { x: 0, y: 0, a: 0, vx: 0, vy: 0, sp: 0 }, fl = { face: 1, fx: 1, pitch: 0 };
  [P.x, P.y] = [F.start[0] * M.w - M.crop.x, F.start[1] * M.h - M.crop.y];
  const keys = new Set(), touch = { id: null, x: 0, y: 0 };
  let trailD = `M${P.x.toFixed(1)} ${P.y.toFixed(1)}`, lastPt = { x: P.x, y: P.y };
  const setState = n => { state = n; stage.dataset.state = n; };
  const U = () => F.planeWidth / SPR_W;                                    // unidades de mundo por px del recorte

  function postalLayout() {
    const r = Math.min(vw / PP.w, vh / PP.h), l = (vw - PP.w * r) / 2, t = (vh - PP.h * r) / 2;
    hint.style.left = l + 40 * r + "px"; hint.style.top = t + 1048 * r + "px"; return { r, l, t };
  }
  function resize() {
    vw = innerWidth; vh = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    s = Math.max(vw / (CONFIG.view.fracX * TW), vh / (CONFIG.view.fracY * TH));
    cv.width = vw * dpr; cv.height = vh * dpr; postalLayout(); camera(0, true); draw(); drawSmoke();
  }
  function camera(dt, snap) {
    const tx = (P.x + P.vx * .6) * s - vw / 2, ty = clamp((P.y + P.vy * .6) * s - vh / 2, 0, TH * s - vh), k = snap ? 1 : 1 - Math.exp(-2.5 * dt);
    cx += (tx - cx) * k; cy += (ty - cy) * k;
  }
  function draw() {
    const k0 = Math.floor((cx + vw / 2) / (TW * s));
    for (let i = 0; i < 3; i++) { const tr = `translate3d(${(k0 + i - 1) * TW * s - cx}px,${-cy}px,0) scale(${s})`; mapT[i].style.transform = photoT[i].style.transform = tr; }
    trailSvg.style.transform = `translate3d(${-cx}px,${-cy}px,0) scale(${s})`;
    if (state === "flying" || state === "paused") plane.style.transform = planeTransform();
  }
  const planeTransform = () => `translate(${P.x * s - cx}px,${P.y * s - cy}px) rotate(${fl.pitch}rad) scale(${U() * s * fl.fx},${U() * s})`;

  /* Humo */
  const spr = document.createElement("canvas"); spr.width = spr.height = 64;
  { const g = spr.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(236,230,216,.95)"); r.addColorStop(.5, "rgba(222,214,198,.5)"); r.addColorStop(1, "rgba(215,205,188,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }
  const pool = Array.from({ length: CONFIG.smoke.max }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 1, s0: 4 }));
  let emit = 0;
  function spawn() {
    const p = pool.find(q => !q.on); if (!p) return; const o = CONFIG.smoke.offset, u = U(), lx = o[0] * u * fl.face, ly = o[1] * u, c = Math.cos(fl.pitch), n = Math.sin(fl.pitch);
    p.on = true; p.x = P.x + lx * c - ly * n; p.y = P.y + lx * n + ly * c; p.vx = -fl.face * 9 + (Math.random() - .5) * 10; p.vy = (Math.random() - .5) * 10;
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

  /* Entrada: flechas o dedo. El ratón no dirige. */
  function input() {
    let ix = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0), iy = (keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0);
    if (touch.id !== null) { const dx = touch.x - (P.x * s - cx), dy = touch.y - (P.y * s - cy); if (Math.hypot(dx, dy) > 40) { ix = dx; iy = dy; } }
    const l = Math.hypot(ix, iy); return l ? [ix / l, iy / l] : null;
  }
  function step(dt) {
    const inp = input();
    if (inp) {
      const d = wrap(Math.atan2(inp[1], inp[0]) - P.a), mt = F.turnRate * dt;
      P.a = wrap(P.a + clamp(d * (1 - Math.exp(-F.turnSmoothing * dt)), -mt, mt));
      if (!hintShown) { hintShown = true; fly.classList.remove("on"); }
    } else if (P.y < F.yMin + 40 || P.y > F.yMax - 40) {                   // cerca del límite vertical: se endereza suavemente
      const d = wrap((Math.cos(P.a) >= 0 ? 0 : Math.PI) - P.a); P.a = wrap(P.a + clamp(d * dt * 1.5, -F.turnRate * dt * .6, F.turnRate * dt * .6));
    }
    P.sp += ((inp ? F.boost : F.cruise) - P.sp) * (1 - Math.exp(-F.accel * dt));
    const k = 1 - Math.exp(-F.inertia * dt);
    P.vx += (Math.cos(P.a) * P.sp - P.vx) * k; P.vy += (Math.sin(P.a) * P.sp - P.vy) * k;
    P.x += P.vx * dt; P.y += P.vy * dt;                                    // X sin límites: el mundo es periódico
    if ((P.y < F.yMin && P.vy < 0) || (P.y > F.yMax && P.vy > 0)) { P.y = clamp(P.y, F.yMin, F.yMax); P.vy = 0; }
    if (Math.abs(P.vx) > 8) fl.face = Math.sign(P.vx);                     // el avión (vista lateral) mira a izquierda o derecha y cabecea
    fl.fx += (fl.face - fl.fx) * (1 - Math.exp(-12 * dt));
    const pt = clamp(fl.face * Math.atan2(P.vy, Math.abs(P.vx)), -F.maxPitch, F.maxPitch); fl.pitch += (pt - fl.pitch) * (1 - Math.exp(-8 * dt));
    if (Math.hypot(P.x - lastPt.x, P.y - lastPt.y) > 10) { lastPt = { x: P.x, y: P.y }; trailD += `L${P.x.toFixed(1)} ${P.y.toFixed(1)}`; trailPath.setAttribute("d", trailD); }
    smokeStep(dt); camera(dt);
  }
  function loop(now) {
    if (state !== "flying") return;
    const dt = last ? Math.min((now - last) / 1000, .05) : 0; last = now;
    step(dt); draw(); drawSmoke(); raf = requestAnimationFrame(loop);
  }
  const startLoop = () => { last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); };

  /* ---------- Transición postal → mapa: el avión de la postal sale volando ---------- */
  function start() {
    if (state !== "initial") return;
    setState("transitioning"); hint.style.opacity = 0; card.blur();
    const L = postalLayout(), pp = PP.plane, D = CONFIG.transitionMs * K;
    const ix = L.l + (pp.x + pp.w / 2) * L.r, iy = L.t + (pp.y + pp.h / 2) * L.r;
    camera(0, true); draw();
    const sx = P.x * s - cx, sy = P.y * s - cy, k = U() * s;
    plane.style.transform = `translate(${ix}px,${iy}px) scale(${L.r})`; plane.style.opacity = 1; plane.classList.add("run");
    layers.forEach(l => { l.style.transition = `opacity ${D * .7}ms ease ${D * .25}ms`; l.style.opacity = 1; });
    card.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.94)" }], { duration: D * .75, delay: D * .25, fill: "forwards", easing: "ease-in-out" });
    plane.animate([
      { transform: `translate(${ix}px,${iy}px) scale(${L.r})` },
      { transform: `translate(${ix + (sx - ix) * .25}px,${iy - vh * .1}px) scale(${L.r * 1.12})`, offset: .3 },
      { transform: `translate(${sx}px,${sy}px) scale(${k})` }
    ], { duration: D, easing: "cubic-bezier(.45,0,.3,1)", fill: "forwards" }).finished.then(() => {
      P.sp = F.cruise * .6; P.vx = P.sp; P.vy = 0; fl.face = fl.fx = 1; fl.pitch = 0; setState("flying"); draw();
      plane.getAnimations().forEach(a => a.cancel()); card.style.display = hint.style.display = "none";
      fly.textContent = matchMedia("(pointer:coarse)").matches ? CONFIG.hint.touch : CONFIG.hint.keys; fly.classList.add("on"); setTimeout(() => fly.classList.remove("on"), 8000);
      startLoop();
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
