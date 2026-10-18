/* ============ CONFIGURACIÓN (edita aquí) ============
   Coordenadas x,y: unidades del mapa (1000 x 500). offset: dónde cae la Polaroid respecto al lugar.
   Si "image" no existe, se dibuja una foto provisional automática (sin tocar la lógica). */
const CONFIG = {
  texts: { title: "Feliz 16° día de la madre", sub: "Te amo mucho mami" }, // el cartel está también en index.html
  flight: { speed: 130, smoothing: 6, rotationSmoothing: 3.2, maxTurn: 2.4, start: [90, 430], startHeading: -0.5 },
  transitionMs: 2400,
  triggerRadius: 75,
  polaroidWidth: 118,
  landmarks: [
    { id: "paris", name: "París",    kind: "eiffel",  x: 506, y: 140, image: "assets/polaroid-paris.jpg", caption: "", offset: [-95, -55], rotation: -5 },
    { id: "rome",  name: "Roma",     kind: "dome",    x: 535, y: 160, image: "assets/polaroid-rome.jpg",  caption: "", offset: [62, -62],  rotation: 4 },
    { id: "cairo", name: "Egipto",   kind: "pyramid", x: 586, y: 167, image: "assets/polaroid-egypt.jpg", caption: "", offset: [30, 98],   rotation: -3 },
    { id: "ny",    name: "Nueva York", kind: "liberty", x: 294, y: 160, image: "assets/polaroid-newyork.jpg", caption: "", offset: [-70, -72], rotation: 5 },
    { id: "rio",   name: "Río",      kind: "cristo",  x: 380, y: 315, image: "assets/polaroid-rio.jpg",   caption: "", offset: [98, 15],   rotation: -4 },
    { id: "tokyo", name: "Japón",    kind: "fuji",    x: 886, y: 175, image: "assets/polaroid-japan.jpg", caption: "", offset: [-12, 98],  rotation: 3 }
  ],
  cardPhotos: [ // fotos de la tarjeta inicial (posición en %)
    { kind: "family", image: "assets/family-photo-1.jpg", cap: "mamá", css: "left:7%;top:30%;--w:clamp(80px,15vw,190px);--r:-6deg" },
    { kind: "eiffel", image: "assets/family-photo-2.jpg", cap: "París", css: "left:60%;top:6%;--w:clamp(80px,14vw,180px);--r:5deg" },
    { kind: "dome",   image: "assets/polaroid-rome.jpg",  cap: "Roma",  css: "right:7%;bottom:8%;--w:clamp(80px,16vw,200px);--r:-4deg" },
    { kind: "fuji",   image: "assets/polaroid-japan.jpg", cap: "",      css: "left:38%;bottom:4%;--w:clamp(70px,11vw,140px);--r:3deg" }
  ]
};

(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, K = reduce ? 0.3 : 1;
  const F = CONFIG.flight;
  const stage = $("#stage"), card = $("#card"), world = $("#world"), plane = $("#plane"), cardPlane = $("#cardPlane"),
        pols = $("#pols"), pauseBtn = $("#pause"), trailPath = $("#trailPath"), hint = $("#hint");

  /* ---------- Mapa vintage en SVG (continentes simplificados, lon/lat) ---------- */
  const LAND = {
    "NORTE AMÉRICA|105,95": "-168,66 -140,70 -95,72 -80,70 -62,60 -55,50 -67,44 -76,35 -81,25 -97,26 -97,18 -87,21 -83,10 -78,8 -92,15 -106,23 -115,30 -124,40 -125,49 -140,60",
    "|": "-73,78 -40,83 -20,80 -22,70 -43,60 -55,68",
    "SUDAMÉRICA|345,360": "-78,8 -62,11 -50,0 -35,-6 -40,-22 -48,-27 -58,-38 -65,-42 -68,-54 -74,-50 -72,-30 -70,-18 -81,-5",
    "ASIA|740,110": "-10,36 -9,43 -1,46 -5,48 3,51 8,55 10,58 5,62 15,69 28,71 60,69 100,77 140,72 170,68 180,65 160,58 142,52 135,43 128,35 122,30 120,22 108,18 105,9 100,13 98,8 103,1 98,16 92,22 80,14 77,8 72,20 67,25 57,25 52,16 43,13 35,28 36,36 28,36 26,40 20,40 15,38 12,44 3,43 -5,36",
    "ÁFRICA|560,300": "-17,21 -10,30 -5,36 10,37 32,31 43,12 51,12 40,-3 40,-15 33,-26 20,-35 14,-22 12,-5 9,4 -8,4 -17,14",
    "OCEANÍA|870,380": "114,-22 122,-18 131,-12 142,-11 153,-26 150,-37 140,-38 130,-32 115,-34",
    "||": "130,31 135,34 141,38 142,44 140,40 133,34",
    "|||": "-5,50 1,51 -2,57 -5,58"
  };
  const pt = (lo, la) => ((lo + 180) * 1000 / 360).toFixed(1) + "," + ((90 - la) * 500 / 180).toFixed(1);
  let m = '<g id="worldmap"><rect width="1000" height="500" fill="#e4d3ad"/>';
  for (let lo = -180; lo <= 180; lo += 30) m += `<path d="M${pt(lo, 90)}L${pt(lo, -90)}" stroke="#a88b5e" stroke-width=".6" opacity=".5" fill="none"/>`;
  for (let la = -60; la <= 60; la += 30) m += `<path d="M${pt(-180, la)}L${pt(180, la)}" stroke="#a88b5e" stroke-width=".6" opacity=".5" fill="none"/>`;
  m += `<path d="M${pt(-180, 0)}L${pt(180, 0)}" stroke="#8c6a3e" stroke-width=".9" stroke-dasharray="2 4" fill="none"/>`;
  for (const k in LAND) {
    const p = LAND[k].split(" ").map(s => pt(...s.split(",").map(Number)));
    m += `<path d="M${p.join("L")}Z" fill="#d3bb8a" stroke="#7a5a38" stroke-width="1.2" stroke-linejoin="round"/>`;
    const lab = k.split("|"); if (lab[0]) m += `<text class="mapLabel" x="${lab[1].split(",")[0]}" y="${lab[1].split(",")[1]}">${lab[0]}</text>`;
  }
  m += `<text class="mapLabel" x="205" y="250" font-size="14">OCÉANO ATLÁNTICO</text><text class="mapLabel" x="50" y="330" font-size="14">PACÍFICO</text><text class="mapLabel" x="650" y="330" font-size="14">OCÉANO ÍNDICO</text>`;
  m += `<rect x="3" y="3" width="994" height="494" fill="none" stroke="#6b4a2b" stroke-width="3"/></g>`;
  $("#mapSvg").innerHTML = m;

  /* ---------- Siluetas de lugares y fotos provisionales ---------- */
  const ICON = {
    eiffel: "M30 4l3 20 9 32h-6l-6-18-6 18h-6l9-32z", dome: "M8 56V38h44v18zM14 38a16 16 0 0132 0zM29 8h2v8h-2z",
    pyramid: "M3 56L30 12l27 44zM30 12l27 44H38z", liberty: "M24 56V38l6-4 6 4v18zM28 34l2-14 2 14zM34 24l8-14 2 2-6 14zM26 20h8v-4h-8z",
    cristo: "M28 8h4v12h16v5H32v12l5 19H23l5-19V25H12v-5h16z", fuji: "M2 56L24 24l6-9 6 9 22 32z",
    family: "M20 22a6 6 0 1012 0a6 6 0 10-12 0M34 26a5 5 0 1010 0a5 5 0 10-10 0M16 56V36q10-6 20 0v20zM34 56V38q8-4 14 0v18z"
  };
  const iconSvg = (k, fill = "#6b4a2b") => `<svg viewBox="0 0 60 60"><path d="${ICON[k] || ICON.family}" fill="${fill}" stroke="#3b2a18" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
  const photo = k => "data:image/svg+xml," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecd9a8"/><stop offset="1" stop-color="#c9a56d"/></linearGradient><radialGradient id="v"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3b2a18" stop-opacity=".45"/></radialGradient></defs><rect width="200" height="200" fill="url(#g)"/><circle cx="150" cy="55" r="22" fill="#f6efdd" opacity=".7"/><rect y="150" width="200" height="50" fill="#9c7a4c"/><g transform="translate(35 22) scale(2.2)"><path d="${ICON[k] || ICON.family}" fill="#5a3f26"/></g><rect width="200" height="200" fill="url(#v)"/></svg>`);
  function polaroid(cfg, w) {
    const el = document.createElement("div"); el.className = "pol";
    const inn = document.createElement("div"); inn.className = "pol-in";
    const img = new Image(); img.alt = "Recuerdo: " + (cfg.name || cfg.cap || "foto"); img.draggable = false;
    img.onerror = () => { img.onerror = null; img.src = photo(cfg.kind); };
    img.src = cfg.image || photo(cfg.kind);
    const sp = document.createElement("span"); sp.textContent = cfg.caption || cfg.name || cfg.cap || "";
    inn.append(img, sp); el.append(inn); if (w) el.style.setProperty("--w", w + "px");
    return el;
  }

  /* ---------- Tarjeta inicial (collage estático) ---------- */
  const deco = $("#cardDeco");
  CONFIG.cardPhotos.forEach(c => { const p = polaroid(c); p.style.cssText += c.css; p.firstChild.style.animation = "none"; deco.append(p); });
  [["left:30%;top:6%;width:clamp(90px,14vw,190px);aspect-ratio:1.4;transform:rotate(-4deg)", "300 90 300 210"],
   ["right:5%;top:42%;width:clamp(70px,11vw,150px);aspect-ratio:1;transform:rotate(6deg)", "700 120 220 220"]].forEach(([css, vb]) => {
    const d = document.createElement("div"); d.className = "cut patch"; d.style.cssText = css;
    d.innerHTML = `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid slice"><use href="#worldmap"/></svg>`; deco.append(d);
  });
  [["eiffel", "left:24%;bottom:6%;width:clamp(40px,7vw,90px)"], ["dome", "left:2%;top:52%;width:clamp(40px,6vw,80px)"]].forEach(([k, css]) => {
    const d = document.createElement("div"); d.className = "cut"; d.style.cssText = css; d.innerHTML = iconSvg(k, "#8a6a44"); deco.append(d);
  });

  /* ---------- Lugares en el mapa ---------- */
  const marks = CONFIG.landmarks.map(l => {
    const ic = document.createElement("div"); ic.className = "place"; ic.style.cssText = `left:${l.x}px;top:${l.y}px`; ic.innerHTML = iconSvg(l.kind);
    const nm = document.createElement("div"); nm.className = "placeName"; nm.style.cssText = `left:${l.x}px;top:${l.y}px`; nm.textContent = l.name;
    pols.append(ic, nm); return { ...l, done: false };
  });

  /* ---------- Estado y vuelo ---------- */
  let state = "initial", vw = 0, vh = 0, s = 1, cx = 0, cy = 0, raf = 0, last = 0, hasPtr = false;
  const P = { x: F.start[0], y: F.start[1], a: F.startHeading }, T = { x: P.x + 100, y: P.y }, ptr = { x: 0, y: 0 };
  let trail = `M${P.x} ${P.y}`, lastPt = { x: P.x, y: P.y };
  const setState = n => { state = n; stage.dataset.state = n; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  function resize() {
    vw = innerWidth; vh = innerHeight; s = Math.max(vw, 2 * vh) / 1000;
    cam(true); draw();
  }
  function cam(snap, dt = 0) {
    const tx = clamp(P.x * s - vw / 2, 0, 1000 * s - vw), ty = clamp(P.y * s - vh / 2, 0, 500 * s - vh), k = snap ? 1 : 1 - Math.exp(-3 * dt);
    cx += (tx - cx) * k; cy += (ty - cy) * k;
  }
  function draw() {
    world.style.transform = `translate3d(${-cx}px,${-cy}px,0) scale(${s})`;
    plane.style.transform = `translate(${P.x}px,${P.y}px) rotate(${P.a}rad)`;
  }

  function step(dt) {
    let tx, ty;
    if (hasPtr) { tx = (ptr.x + cx) / s; ty = (ptr.y + cy) / s; }
    else { const n = marks.find(l => !l.done) || { x: 500 + 350 * Math.cos(P.a + 1), y: 250 + 150 * Math.sin(P.a + 1) }; tx = n.x; ty = n.y; }
    if (P.x < 25 || P.x > 975 || P.y < 25 || P.y > 475) { tx = 500; ty = 250; }
    const k = 1 - Math.exp(-F.smoothing * dt); T.x += (tx - T.x) * k; T.y += (ty - T.y) * k;
    if (Math.hypot(T.x - P.x, T.y - P.y) > 25) {
      const d = wrap(Math.atan2(T.y - P.y, T.x - P.x) - P.a), mt = F.maxTurn * dt;
      P.a = wrap(P.a + clamp(d * (1 - Math.exp(-F.rotationSmoothing * dt)), -mt, mt));
    }
    P.x = clamp(P.x + Math.cos(P.a) * F.speed * dt, 4, 996); P.y = clamp(P.y + Math.sin(P.a) * F.speed * dt, 4, 496);
    if (Math.hypot(P.x - lastPt.x, P.y - lastPt.y) > 9) { lastPt = { x: P.x, y: P.y }; trail += `L${P.x.toFixed(1)} ${P.y.toFixed(1)}`; trailPath.setAttribute("d", trail); }
    for (const l of marks) if (!l.done && Math.hypot(P.x - l.x, P.y - l.y) < CONFIG.triggerRadius) reveal(l);
    cam(false, dt);
  }
  function reveal(l) {
    l.done = true; const w = l.size || CONFIG.polaroidWidth, p = polaroid(l, w);
    p.style.left = (l.x + l.offset[0] - w / 2) + "px"; p.style.top = (l.y + l.offset[1] - w * .62) + "px";
    p.firstChild.style.setProperty("--r", (l.rotation || 0) + "deg"); pols.append(p);
  }
  function loop(now) {
    if (state !== "flying") return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0; last = now;
    step(dt); draw(); raf = requestAnimationFrame(loop);
  }
  function startLoop() { last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }

  /* ---------- Transición tarjeta → mapa ---------- */
  function start() {
    if (state !== "initial") return;
    setState("transitioning"); hint.style.opacity = 0; card.blur();
    const r = cardPlane.getBoundingClientRect(), sx = P.x * s - cx, sy = P.y * s - cy;
    const dx = sx - (r.left + r.width / 2), dy = sy - (r.top + r.height / 2), sc = (44 * s) / r.width, D = CONFIG.transitionMs * K;
    world.style.transition = `opacity ${D * .7}ms ease ${D * .25}ms`; world.style.opacity = 1;
    card.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.05)" }], { duration: D * .7, delay: D * .3, fill: "forwards", easing: "ease-in-out" });
    const a = cardPlane.animate([
      { transform: "translate(0,0) rotate(-28deg) scale(1)" },
      { transform: `translate(${dx * .25}px,${dy * .1 - 30}px) rotate(-34deg) scale(1.08)`, offset: .3 },
      { transform: `translate(${dx}px,${dy}px) rotate(${F.startHeading}rad) scale(${sc})` }
    ], { duration: D, easing: "cubic-bezier(.45,0,.3,1)", fill: "forwards" });
    a.finished.then(() => { plane.style.opacity = 1; cardPlane.style.display = "none"; card.style.display = hint.style.display = "none"; setState("flying"); startLoop(); });
  }

  /* ---------- Pausa ---------- */
  function togglePause() {
    if (state === "flying") { cancelAnimationFrame(raf); setState("paused"); pauseBtn.setAttribute("aria-pressed", "true"); pauseBtn.setAttribute("aria-label", "Reanudar viaje"); }
    else if (state === "paused") { setState("flying"); pauseBtn.setAttribute("aria-pressed", "false"); pauseBtn.setAttribute("aria-label", "Pausar viaje"); startLoop(); }
  }

  /* ---------- Eventos ---------- */
  stage.addEventListener("pointerdown", e => { if (e.target.closest("#pause")) return; if (state === "initial") start(); else if (state === "flying") { ptr.x = e.clientX; ptr.y = e.clientY; hasPtr = true; } });
  stage.addEventListener("pointermove", e => { if (state === "flying" && !e.target.closest("#pause")) { ptr.x = e.clientX; ptr.y = e.clientY; hasPtr = true; } });
  pauseBtn.addEventListener("pointerdown", e => e.stopPropagation());
  pauseBtn.addEventListener("click", e => { e.stopPropagation(); togglePause(); });
  card.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); start(); } });
  document.addEventListener("keydown", e => {
    if (e.code !== "Space" || e.repeat) return;
    if (e.target.closest && e.target.closest("button")) return; // el botón maneja su propio Espacio
    e.preventDefault(); if (state === "initial") start();
  });
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "flying") togglePause(); });

  resize();
})();
