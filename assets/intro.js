/* Marcelino Games opening animation (self-contained: this file injects its own CSS).
   Sequence (one async/await timeline, every move is a time-based tween, so a slow frame never stalls it):
   1 dark preloader + the "M" resting on a peeking alien hand, loader ring, tactile click
   2 radial light burst reveals the wallpaper, the alien arm stretches in from the left edge
   3 "Marcelino Games" drops in as a tumbled pile
   4 the arm nudges every letter into a straight line
   5 floor slam, the title bounces up, the arm carries in the Arabic badge
   6 the arm leaves, a 1.5s pause, the overlay slides up and the page is revealed.
   window.MG_INTRO.replay() plays it again; the "Replay Intro" button does the same. */
(function () {
  "use strict";
  var host = document.getElementById("splash");
  if (!host) return;
  var de = document.documentElement;
  var NS = "http://www.w3.org/2000/svg";
  var ABORT = { aborted: true };
  var noop = function () {};
  var reduce = false;
  try { reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}
  var cur = null;

  /* ---------------- tiny helpers ---------------- */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  var E = {
    lin: function (u) { return u; },
    io: function (u) { return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; },
    out: function (u) { return 1 - Math.pow(1 - u, 3); },
    ein: function (u) { return u * u * u; },
    back: function (u) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); },
    bounce: function (u) {
      var n = 7.5625, d = 2.75;
      if (u < 1 / d) return n * u * u;
      if (u < 2 / d) { u -= 1.5 / d; return n * u * u + .75; }
      if (u < 2.5 / d) { u -= 2.25 / d; return n * u * u + .9375; }
      u -= 2.625 / d; return n * u * u + .984375;
    }
  };
  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }
  function sv(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function bg(p) { p.catch(noop); return p; }          // a promise nobody awaits must not raise "unhandled"

  /* ---------------- CSS (injected once) ---------------- */
  function ensureCSS() {
    if (document.getElementById("mgi-css")) return;
    var f = 'var(--font-display,"Changa"),"Lilita One","Arial Black",Impact,sans-serif';
    var css = [
      "#splash{position:fixed;inset:0;z-index:1000;background:#000;overflow:hidden;direction:ltr;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}",
      ".mgi-stage{position:absolute;inset:0;will-change:transform}",
      ".mgi-stars{position:absolute;inset:0;pointer-events:none}",
      ".mgi-star{position:absolute;border-radius:50%;background:#cfe6ff;opacity:0;animation:mgi-tw 3.2s ease-in-out infinite}",
      "@keyframes mgi-tw{0%,100%{opacity:.05;transform:scale(.7)}50%{opacity:.7;transform:scale(1.25)}}",
      ".mgi-wall{position:absolute;inset:0;pointer-events:none;overflow:hidden;clip-path:circle(0px at 50% 50%);-webkit-clip-path:circle(0px at 50% 50%)}",
      ".mgi-wall>div{position:absolute;inset:0}",
      ".mgi-wbase{background:radial-gradient(ellipse 75% 60% at 20% 15%,rgba(124,58,237,.5),transparent 70%),radial-gradient(ellipse 65% 55% at 85% 80%,rgba(109,40,217,.4),transparent 72%),#070a1e}",
      ".mgi-wimg{background:url(images/bg.jpg) center/cover no-repeat;opacity:0;will-change:transform,opacity}",
      ".mgi-wtint{background:linear-gradient(180deg,rgba(5,7,24,.3),rgba(5,7,24,.52))}",
      ".mgi-wfloor{top:auto;height:34%;opacity:0;background:radial-gradient(ellipse 60% 70% at 50% 100%,rgba(34,211,238,.42),rgba(34,211,238,0) 70%)}",
      ".mgi-scrim{position:absolute;left:0;top:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(3,5,20,.7) 0,rgba(3,5,20,.4) 45%,rgba(3,5,20,0) 72%)}",
      ".mgi-vig{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.55) 100%)}",
      ".mgi-flash{position:absolute;inset:0;opacity:0;pointer-events:none}",
      ".mgi-rim{position:absolute;left:0;top:0;width:400px;height:400px;border-radius:50%;opacity:0;pointer-events:none;will-change:transform,opacity;background:radial-gradient(circle closest-side,rgba(255,255,255,0) 72%,rgba(150,230,255,.75) 93%,rgba(255,255,255,0) 100%)}",
      ".mgi-arm,.mgi-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}",
      ".mgi-arm{z-index:3}.mgi-fx{z-index:7}",
      ".mgi-name{position:absolute;left:0;right:0;top:0;z-index:4;text-align:center;white-space:nowrap;font-family:" + f + ";font-weight:800;line-height:1.15;will-change:transform;pointer-events:none}",
      ".mgi-line{position:relative;display:block}",
      ".mgi-l{display:inline-block;opacity:0;color:#FFFFFF;will-change:transform;text-shadow:0 0 16px rgba(255,255,255,.3),0 4px 0 rgba(0,0,0,.5)}",
      ".mgi-l.b{color:#00A8FF;text-shadow:0 0 22px rgba(0,168,255,.75),0 4px 0 rgba(0,25,60,.6)}",
      ".mgi-sp{display:inline-block;width:.28em}",
      ".mgi-probe{display:inline-block;width:0;height:0}",
      ".mgi-pill{position:absolute;left:0;top:0;z-index:6;direction:rtl;white-space:nowrap;pointer-events:none;will-change:transform;font-family:'Tajawal','Changa','Noto Sans Arabic',system-ui,sans-serif;font-weight:800;line-height:1.35;color:#fff;" +
        "padding:.3em 1.3em .36em;border-radius:999px;background:linear-gradient(180deg,#14409a 0%,#0a2159 100%);border:1.5px solid rgba(0,168,255,.7);" +
        "box-shadow:0 0 22px rgba(0,168,255,.5),inset 0 0 10px rgba(0,168,255,.3),0 6px 18px rgba(0,0,0,.45);text-shadow:0 0 10px rgba(120,200,255,.7)}",
      ".mgi-pill::after{content:'';position:absolute;inset:-6px;border-radius:999px;box-shadow:0 0 30px rgba(0,168,255,.65);opacity:0}",
      ".mgi-pill.on::after{animation:mgi-glow 2.2s ease-in-out infinite}",
      "@keyframes mgi-glow{0%,100%{opacity:.15}50%{opacity:.9}}",
      ".mgi-mw{position:absolute;left:0;top:0;z-index:8;opacity:0;cursor:pointer;font-family:" + f + ";font-weight:800;transform-origin:50% 86%;will-change:transform,opacity;touch-action:manipulation}",
      ".mgi-mtxt{position:relative;color:#fff;line-height:1;white-space:nowrap;text-shadow:0 0 18px rgba(170,225,255,.95),0 0 46px rgba(0,168,255,.7),0 5px 0 rgba(0,20,50,.5)}",
      ".mgi-mglow{position:absolute;left:50%;top:48%;width:2em;height:2em;margin:-1em 0 0 -1em;border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(120,205,255,.5),rgba(120,205,255,0) 66%);animation:mgi-pulse 2.4s ease-in-out infinite}",
      "@keyframes mgi-pulse{0%,100%{opacity:.55;transform:scale(.88)}50%{opacity:1;transform:scale(1.12)}}",
      ".mgi-rip{position:absolute;left:0;top:0;width:200px;height:200px;border-radius:50%;border:3px solid rgba(160,235,255,.9);opacity:0;pointer-events:none;z-index:7;will-change:transform,opacity}",
      ".mgi-hint{position:absolute;left:50%;bottom:max(40px,calc(env(safe-area-inset-bottom) + 28px));max-width:92vw;z-index:9;direction:rtl;text-align:center;white-space:nowrap;pointer-events:none;opacity:0;transform:translate3d(-50%,14px,0);" +
        "transition:opacity .5s ease,transform .5s ease;font-family:'Tajawal','Changa','Noto Sans Arabic',system-ui,sans-serif;font-weight:700;font-size:clamp(14px,4vw,18px);line-height:1.4;color:#fff;padding:.5em 1.3em .55em;border-radius:999px;" +
        "background:rgba(10,33,89,.78);border:1.5px solid rgba(0,168,255,.65);box-shadow:0 0 20px rgba(0,168,255,.45),inset 0 0 10px rgba(0,168,255,.25)}",
      ".mgi-hint.on{opacity:1;transform:translate3d(-50%,0,0);animation:mgi-hint 1.6s ease-in-out .5s infinite}",
      "@keyframes mgi-hint{0%,100%{box-shadow:0 0 14px rgba(0,168,255,.35),inset 0 0 8px rgba(0,168,255,.2)}50%{box-shadow:0 0 30px rgba(0,168,255,.85),inset 0 0 12px rgba(0,168,255,.4)}}",
      ".mgi-load{position:absolute;left:50%;bottom:max(34px,calc(env(safe-area-inset-bottom) + 22px));width:78px;margin-left:-39px;z-index:9;pointer-events:none;opacity:0;text-align:center}",
      ".mgi-load svg{display:block;width:78px;height:78px;filter:drop-shadow(0 0 8px rgba(34,211,238,.55))}",
      ".mgi-spin{transform-origin:39px 39px;animation:mgi-rot 2.6s linear infinite}",
      "@keyframes mgi-rot{to{transform:rotate(360deg)}}",
      ".mgi-pct{position:absolute;left:0;right:0;top:27px;font:700 15px/1 " + f + ";color:#dff6ff}",
      ".mgi-skip,.mgi-replay{font:inherit;font-size:.85rem;min-height:34px;padding:2px 14px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(3,6,13,.6);color:#e8f4ff;cursor:pointer;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}",
      ".mgi-skip:hover,.mgi-replay:hover{border-color:#22d3ee}",
      ".mgi-skip{position:absolute;z-index:10;top:max(12px,env(safe-area-inset-top));right:12px}",
      ".mgi-replay{position:fixed;z-index:1002;top:max(12px,env(safe-area-inset-top));left:12px;direction:ltr}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = "mgi-css";
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ================================================================== */
  function run(root) {
    var R = { dead: false };                       // set by kill(): every pending await rejects with ABORT
    var W = innerWidth, H = innerHeight;
    var seed = (Date.now() % 2147483000) + 1;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var prevOverflow = de.style.overflow;
    de.style.overflow = "hidden";

    /* ---------- the timeline primitives ---------- */
    function frame() {
      return new Promise(function (res, rej) {
        requestAnimationFrame(function () { if (R.dead) rej(ABORT); else res(); });
      });
    }
    function sleep(ms) {
      return new Promise(function (res, rej) {
        var t0 = performance.now();
        (function f() {
          if (R.dead) return rej(ABORT);
          if (performance.now() - t0 >= ms) return res();
          requestAnimationFrame(f);
        })();
      });
    }
    function tween(ms, fn, ease) {
      ease = ease || E.io;
      return new Promise(function (res, rej) {
        var t0 = performance.now();
        (function step() {
          if (R.dead) return rej(ABORT);
          var u = clamp((performance.now() - t0) / ms, 0, 1);
          fn(ease(u), u);
          if (u < 1) requestAnimationFrame(step); else res();
        })();
      });
    }

    /* ---------- DOM ---------- */
    root.textContent = "";
    var stage = el("div", "mgi-stage", root);
    var starsEl = el("div", "mgi-stars", stage);
    for (var si = 0; si < 46; si++) {
      var st = el("i", "mgi-star", starsEl), sz = 1 + rnd() * 1.8;
      st.style.cssText = "left:" + (rnd() * 100).toFixed(2) + "%;top:" + (rnd() * 100).toFixed(2) + "%;width:" + sz.toFixed(1) + "px;height:" + sz.toFixed(1) +
        "px;animation-delay:-" + (rnd() * 3.2).toFixed(2) + "s;animation-duration:" + (2.4 + rnd() * 2.4).toFixed(2) + "s";
    }
    var wall = el("div", "mgi-wall", stage);
    var wbase = el("div", "mgi-wbase", wall);        // 1st layer: the cosmic purple-blue sky
    var wimg = el("div", "mgi-wimg", wall);          // 2nd layer: the glowing controller
    el("div", "mgi-wtint", wall);
    var wfloor = el("div", "mgi-wfloor", wall);      // 3rd layer: the light on the floor
    var scrim = el("div", "mgi-scrim", stage);
    var vig = el("div", "mgi-vig", stage);
    var flash = el("div", "mgi-flash", stage);
    var rim = el("div", "mgi-rim", stage);
    var armSvg = sv("svg", { "class": "mgi-arm", "aria-hidden": "true" }, stage);
    var nameEl = el("div", "mgi-name", stage);
    var pill = el("div", "mgi-pill", stage);
    pill.textContent = "ألعاب أندرويد ببلاش";
    var fxSvg = sv("svg", { "class": "mgi-fx", "aria-hidden": "true" }, stage);
    var rip1 = el("div", "mgi-rip", stage), rip2 = el("div", "mgi-rip", stage);
    var mw = el("div", "mgi-mw", stage);
    mw.setAttribute("role", "button");
    mw.setAttribute("aria-label", "M");
    el("div", "mgi-mglow", mw);
    var mtxt = el("div", "mgi-mtxt", mw);
    mtxt.textContent = "M";
    var mprobe = el("span", "", mtxt);
    mprobe.style.cssText = "display:inline-block;width:0;height:0";
    var load = el("div", "mgi-load", stage);
    var lsvg = sv("svg", { viewBox: "0 0 78 78" }, load);
    var ldefs = sv("defs", {}, lsvg);
    var lg = sv("linearGradient", { id: "mgiLg", x1: "0", y1: "0", x2: "1", y2: "1" }, ldefs);
    sv("stop", { offset: "0", "stop-color": "#22d3ee" }, lg);
    sv("stop", { offset: "1", "stop-color": "#a855f7" }, lg);
    var spin = sv("g", { "class": "mgi-spin" }, lsvg);
    sv("circle", { cx: 39, cy: 39, r: 35, fill: "none", stroke: "rgba(160,200,255,.35)", "stroke-width": 1.5, "stroke-dasharray": "2 7", "stroke-linecap": "round" }, spin);
    sv("circle", { cx: 39, cy: 39, r: 28, fill: "none", stroke: "rgba(160,200,255,.16)", "stroke-width": 4 }, lsvg);
    var CIRC = 2 * Math.PI * 28;
    var lbar = sv("circle", { cx: 39, cy: 39, r: 28, fill: "none", stroke: "url(#mgiLg)", "stroke-width": 4, "stroke-linecap": "round",
      "stroke-dasharray": CIRC.toFixed(2), "stroke-dashoffset": CIRC.toFixed(2), transform: "rotate(-90 39 39)" }, lsvg);
    var lorb = sv("circle", { cx: 39, cy: 11, r: 3.2, fill: "#fff" }, lsvg);
    var lpct = el("div", "mgi-pct", load);
    lpct.textContent = "0";
    var skipBtn = el("button", "mgi-skip", root);
    skipBtn.type = "button";
    skipBtn.textContent = "تخطّي";

    var letters = [];
    var line = el("div", "mgi-line", nameEl);
    var txt = "Marcelino Games";
    for (var ci = 0; ci < txt.length; ci++) {
      var ch = txt.charAt(ci);
      if (ch === " ") { el("span", "mgi-sp", line); continue; }
      var sp = el("span", "mgi-l" + (ci > 9 ? " b" : ""), line);
      sp.textContent = ch;
      letters.push({ el: sp });
    }
    var probe = el("span", "mgi-probe", line);

    /* ---------- geometry ---------- */
    var fs = 80, u = 1, titleTop = 0, floorY = 0, pillFs = 20, pillH = 40, pillW = 200, pillY = 0;
    var Mh = 200, Mx = W / 2, plateVisY = H * .38, mBase = 0, mTopY = 0, baseY = 0, restTipY = 0;
    var M = { dy: 0, s: 1, bob: 0 };
    var A = { Sx: 0, Sy: 0, tx: 0, ty: 0 };
    var TIPMAX = 63.5;

    function fit() {
      nameEl.style.fontSize = "100px";
      var a = letters[0].el, z = letters[letters.length - 1].el;
      var nat = z.offsetLeft + z.offsetWidth - a.offsetLeft;
      fs = clamp(100 * Math.min(W * .9, 1060) / Math.max(nat, 1), 24, 150);
      u = clamp(fs / 52, .75, 2.2);
      nameEl.style.fontSize = fs + "px";
      pillFs = clamp(fs * .36, 15, 44);
      pill.style.fontSize = pillFs + "px";
      pillW = pill.offsetWidth; pillH = pill.offsetHeight;
      var total = fs * 1.15 + fs * .34 + pillH;
      titleTop = Math.max(H * .1, (H - total) / 2 - H * .02);
      nameEl.style.top = titleTop + "px";
      pill.style.transform = "translate3d(" + (-pillW - 40) + "px," + (-200) + "px,0)";
    }
    function measure() {
      var i, L;
      for (i = 0; i < letters.length; i++) {
        L = letters[i];
        L.w = L.el.offsetWidth; L.h = L.el.offsetHeight;
        L.cx = L.el.offsetLeft + L.w / 2;
        L.top = titleTop + L.el.offsetTop;
      }
      floorY = titleTop + probe.offsetTop + fs * .03;
      for (i = 0; i < letters.length; i++) {
        L = letters[i];
        L.vcy = floorY - fs * .36;
        L.el.style.transformOrigin = "50% " + (L.vcy - L.top).toFixed(1) + "px";
      }
      pillY = floorY + fs * .2 + pillH / 2;           // sits on the floor, right under the floating title
    }
    function makePile() {
      var n = letters.length, bw = letters[n - 1].cx - letters[0].cx + fs * .6;
      var half = Math.min(bw * .52, W * .46), idx = [], i, j, t;
      for (i = 0; i < n; i++) idx.push(i);
      for (i = n - 1; i > 0; i--) { j = Math.floor(rnd() * (i + 1)); t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
      for (i = 0; i < n; i++) {
        var L = letters[i];
        L.jx = clamp(W / 2 + (((idx[i] + .1 + rnd() * .8) / n) - .5) * 2 * half, fs * .5, W - fs * .5);
        L.jy = floorY - fs * (.2 + rnd() * .16);
        L.rot = (rnd() < .5 ? -1 : 1) * (25 + rnd() * 65);
        L.spin = (rnd() < .5 ? -1 : 1) * (200 + rnd() * 220);
        L.dx0 = (rnd() * 2 - 1) * W * .22;
        L.delay = i === 0 ? 60 : 200 + i * 24 + rnd() * 80;
      }
    }
    function setShoulder(mode) {
      if (mode === "bottom") { A.Sx = W * .66; A.Sy = H + 380 * u; }
      else { A.Sx = -(TIPMAX * u + Math.max(pillW, 0) + 120); A.Sy = floorY + fs * .9; }
    }
    function layoutPlate() {
      Mh = clamp(Math.min(W * .5, H * .3, 280), 96, 280);
      Mx = W / 2;
      mw.style.fontSize = Mh + "px";
      mBase = mtxt.offsetTop + mprobe.offsetTop;
      baseY = plateVisY + .36 * Mh;
      restTipY = baseY + 2;
      mTopY = restTipY - mBase;
    }
    function applyM() {
      mw.style.transform = "translate3d(" + Mx + "px," + (mTopY + M.dy + M.bob) + "px,0) translateX(-50%) scale(" + M.s.toFixed(4) + ")";
    }

    /* ---------- the alien arm (rubbery arm + 3-finger hand) ---------- */
    var DARK = "#0e4a14";
    var adefs = sv("defs", {}, armSvg);
    var ag = sv("linearGradient", { id: "mgiArmG", x1: "0", y1: "0", x2: "0", y2: "1" }, adefs);
    [["0", "#d9ff82"], ["0.4", "#7cf33b"], ["1", "#2fa81c"]].forEach(function (x) { sv("stop", { offset: x[0], "stop-color": x[1] }, ag); });
    var pg = sv("radialGradient", { id: "mgiPalmG", cx: ".35", cy: ".3", r: ".85" }, adefs);
    [["0", "#e6ffa0"], ["0.4", "#86f642"], ["1", "#2ea51b"]].forEach(function (x) { sv("stop", { offset: x[0], "stop-color": x[1] }, pg); });
    var armG = sv("g", { opacity: 0 }, armSvg);
    var aBody = sv("path", { fill: "url(#mgiArmG)", stroke: DARK, "stroke-linejoin": "round" }, armG);
    var aHi = sv("path", { fill: "none", stroke: "#f0ffc8", "stroke-opacity": .6, "stroke-linecap": "round" }, armG);
    var aHand = sv("g", {}, armG);
    var fingers = [];
    for (var fi = 0; fi < 3; fi++) {
      fingers.push({
        out: sv("path", { fill: "none", stroke: DARK, "stroke-linecap": "round", "stroke-linejoin": "round" }, aHand),
        fill: sv("path", { fill: "none", stroke: "#7cf33b", "stroke-linecap": "round", "stroke-linejoin": "round" }, aHand)
      });
    }
    var palm = sv("ellipse", { fill: "url(#mgiPalmG)", stroke: DARK }, aHand);
    var shine = sv("ellipse", { fill: "#fff", "fill-opacity": .45 }, aHand);
    var spots = [[8, -5, 3.4], [17, 6, 2.8], [4, 7, 2.4]].map(function (p) { return sv("circle", { fill: "#1f9a1a", "fill-opacity": .5 }, aHand); });
    function sizeArm() {
      var fw = [10, 11.5, 10];
      for (var i = 0; i < 3; i++) {
        fingers[i].out.setAttribute("stroke-width", ((fw[i] + 4.2) * u).toFixed(2));
        fingers[i].fill.setAttribute("stroke-width", (fw[i] * u).toFixed(2));
      }
      palm.setAttribute("cx", 13 * u); palm.setAttribute("cy", 0);
      palm.setAttribute("rx", 21 * u); palm.setAttribute("ry", 18 * u);
      palm.setAttribute("stroke-width", (3.2 * u).toFixed(2));
      shine.setAttribute("cx", 8 * u); shine.setAttribute("cy", -8 * u);
      shine.setAttribute("rx", 8 * u); shine.setAttribute("ry", 3.6 * u);
      shine.setAttribute("transform", "rotate(-20 " + 8 * u + " " + -8 * u + ")");
      [[8, -1, 3.4], [18, 7, 2.8], [3, 8, 2.4]].forEach(function (p, i) {
        spots[i].setAttribute("cx", p[0] * u); spots[i].setAttribute("cy", p[1] * u); spots[i].setAttribute("r", p[2] * u);
      });
      aBody.setAttribute("stroke-width", (3.2 * u).toFixed(2));
      aHi.setAttribute("stroke-width", (3.4 * u).toFixed(2));
    }
    // hand pose helpers
    function openHand(w) { return { curl: 0, wiggle: w === undefined ? 1 : w, spread: .5 }; }
    function pointUp(mid) { return { ang: -Math.PI / 2, fing: [.95, mid || 0, .95], spread: .22, wiggle: .5 }; }

    /* Puts the contact point (fingertip) at (tx,ty). o: ang | tilt | curl | fing[3] | spread | wiggle. Returns the hand angle. */
    function setHand(tx, ty, o) {
      o = o || {};
      A.tx = tx; A.ty = ty;
      var now = performance.now() / 1000, i;
      var wig = o.wiggle === undefined ? 0 : o.wiggle, base = o.curl === undefined ? 0 : o.curl, cs = [0, 0, 0];
      for (i = 0; i < 3; i++) cs[i] = clamp((o.fing ? o.fing[i] : base) + wig * .13 * Math.sin(now * 7 + i * 1.9), 0, 1);
      var ang = o.ang !== undefined ? o.ang : Math.atan2(ty - A.Sy, tx - A.Sx) + (o.tilt || 0);
      var ca = Math.cos(ang), sa = Math.sin(ang);
      var Lf = [24 * u, 31 * u, 24 * u], ext = 0;
      for (i = 0; i < 3; i++) ext = Math.max(ext, Lf[i] * (1 - .5 * cs[i]));
      var dist = 28 * u + ext + 5.5 * u;
      var wx = tx - ca * dist, wy = ty - sa * dist;
      // arm body: a cubic from the shoulder to the wrist that arrives along the hand direction
      var dx = wx - A.Sx, dy = wy - A.Sy, d = Math.hypot(dx, dy) || 1;
      var nx = dy / d, ny = -dx / d, bul = Math.min(d * .14, 120 * u) * (o.bulge === undefined ? 1 : o.bulge);
      var p0x = A.Sx, p0y = A.Sy, p1x = A.Sx + dx * .33 + nx * bul, p1y = A.Sy + dy * .33 + ny * bul;
      var p2x = wx - ca * d * .28, p2y = wy - sa * d * .28, p3x = wx, p3y = wy;
      var N = 22, wS = 34 * u, wW = 15 * u, ph = now * 3, Ls = [], Rs = [], Hs = [];
      for (var k = 0; k <= N; k++) {
        var q = k / N, m = 1 - q;
        var px = m * m * m * p0x + 3 * m * m * q * p1x + 3 * m * q * q * p2x + q * q * q * p3x;
        var py = m * m * m * p0y + 3 * m * m * q * p1y + 3 * m * q * q * p2y + q * q * q * p3y;
        var tx2 = 3 * m * m * (p1x - p0x) + 6 * m * q * (p2x - p1x) + 3 * q * q * (p3x - p2x);
        var ty2 = 3 * m * m * (p1y - p0y) + 6 * m * q * (p2y - p1y) + 3 * q * q * (p3y - p2y);
        var tl = Math.hypot(tx2, ty2) || 1, qx = -ty2 / tl, qy = tx2 / tl;
        var w = lerp(wS, wW, Math.pow(q, .75)) * (1 + .07 * Math.sin(q * 9 + ph));
        Ls.push((px + qx * w / 2).toFixed(1) + " " + (py + qy * w / 2).toFixed(1));
        Rs.push((px - qx * w / 2).toFixed(1) + " " + (py - qy * w / 2).toFixed(1));
        if (k > 0 && k < N - 1) Hs.push((px + qx * w * .27).toFixed(1) + " " + (py + qy * w * .27).toFixed(1));
      }
      aBody.setAttribute("d", "M" + Ls.join("L") + "L" + Rs.reverse().join("L") + "Z");
      aHi.setAttribute("d", "M" + Hs.join("L"));
      aHand.setAttribute("transform", "translate(" + wx.toFixed(1) + " " + wy.toFixed(1) + ") rotate(" + (ang * 180 / Math.PI).toFixed(1) + ")");
      // three fingers
      var th = [-.62, 0, .62], sg = [1, 1, -1], spr = o.spread === undefined ? .45 : o.spread;
      for (i = 0; i < 3; i++) {
        var phi = th[i] * (.5 + 1.1 * spr), bx = 13 * u + 15 * u * Math.cos(th[i]), by = 15 * u * Math.sin(th[i]);
        var l1 = Lf[i] * .42, l2 = Lf[i] * .34, l3 = Lf[i] * .24, bend = cs[i] * sg[i];
        var x1 = bx + Math.cos(phi) * l1, y1 = by + Math.sin(phi) * l1;
        var a2 = phi + bend, x2 = x1 + Math.cos(a2) * l2, y2 = y1 + Math.sin(a2) * l2;
        var a3 = a2 + bend, x3 = x2 + Math.cos(a3) * l3, y3 = y2 + Math.sin(a3) * l3;
        var dd = "M" + bx.toFixed(1) + " " + by.toFixed(1) + "L" + x1.toFixed(1) + " " + y1.toFixed(1) + "L" + x2.toFixed(1) + " " + y2.toFixed(1) + "L" + x3.toFixed(1) + " " + y3.toFixed(1);
        fingers[i].out.setAttribute("d", dd);
        fingers[i].fill.setAttribute("d", dd);
      }
      armG.setAttribute("opacity", 1);
      return ang;
    }
    function hideArm() { armG.setAttribute("opacity", 0); }

    /* ---------- boot: fit, measure, plate ---------- */
    fit(); measure(); makePile(); sizeArm(); layoutPlate();
    var bx = Mx, by = plateVisY;                 // centre of the light burst
    var diag = Math.hypot(W, H);
    wall.style.clipPath = wall.style.webkitClipPath = "circle(0px at " + bx + "px " + by + "px)";
    flash.style.background = "radial-gradient(circle at " + bx + "px " + by + "px,rgba(205,246,255,.95) 0,rgba(34,211,238,.4) 16%,rgba(34,211,238,0) 55%)";
    function placeScrim() {
      var sw = Math.min(W, fs * 17);
      scrim.style.width = sw + "px"; scrim.style.height = fs * 3.9 + "px";
      scrim.style.transform = "translate3d(" + (W / 2 - sw / 2) + "px," + (titleTop - fs * .85) + "px,0)";
    }
    placeScrim();
    applyM();
    setShoulder("bottom");

    /* ---------- tiny effects ---------- */
    function ripple(node, x, y, delay) {
      return (async function () {
        if (delay) await sleep(delay);
        await tween(700, function (e) {
          node.style.opacity = (.9 * (1 - e)).toFixed(3);
          node.style.transform = "translate3d(" + (x - 100) + "px," + (y - 100) + "px,0) scale(" + lerp(.25, 2.6, e).toFixed(3) + ")";
        }, E.out);
        node.style.opacity = 0;
      })();
    }
    function setNameY(y) { nameEl.style.transform = "translate3d(0," + y.toFixed(2) + "px,0)"; }

    /* ================= PHASE 1: preloader, M on the hand, click ================= */
    var clicked = false;
    function onM(ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      if (clicked) return;
      clicked = true;
      clearTimeout(guard);
      guard = setTimeout(function () { ctl.kill(false); }, 20000);   // never trap the visitor once it is running
    }
    mw.addEventListener("pointerdown", onM);
    mw.tabIndex = 0;
    mw.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") onM(ev); });
    var hint = el("div", "mgi-hint", stage);
    var isApp = false;
    try { isApp = !!((window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone); } catch (e) {}
    hint.textContent = isApp ? "دوس على الحرف M عشان التطبيق يفتح" : "دوس على الحرف M عشان الموقع يفتح";

    async function phaseLoad() {
      var t0 = performance.now(), ready = false, p = 0, img = new Image();
      img.onload = img.onerror = function () { ready = true; };
      img.src = "images/bg.jpg";
      var fontsOk = false;
      try {
        Promise.race([
          Promise.all([document.fonts.load("800 100px Changa"), document.fonts.load("800 20px Tajawal")]),
          new Promise(function (r) { setTimeout(r, 2500); })
        ]).then(function () { fontsOk = true; }, function () { fontsOk = true; });
      } catch (e) { fontsOk = true; }
      var assetsDone = function () { return ready && fontsOk; };
      for (;;) {
        await frame();
        var now = performance.now(), el_ = now - t0;
        if (clicked) { t0 = Math.min(t0, now - 1100); el_ = Math.max(el_, 1100); }
        var tp = clamp(el_ / 1100, 0, 1), done = assetsDone() || el_ > 4500 || clicked;
        var want = Math.min(E.io(tp), done ? 1 : .92);
        p += clamp(want - p, 0, .06);
        // widgets
        load.style.opacity = clamp(el_ / 450, 0, 1).toFixed(3);
        lbar.setAttribute("stroke-dashoffset", (CIRC * (1 - p)).toFixed(2));
        var a = p * Math.PI * 2 - Math.PI / 2;
        lorb.setAttribute("cx", (39 + 28 * Math.cos(a)).toFixed(2)); lorb.setAttribute("cy", (39 + 28 * Math.sin(a)).toFixed(2));
        lpct.textContent = Math.round(p * 100);
        mw.style.opacity = E.io(clamp(el_ / 700, 0, 1)).toFixed(3);
        var bob = Math.sin(el_ / 430) * 4 * u;
        M.bob = bob; applyM();
        var rise = E.out(clamp(el_ / 1000, 0, 1));
        setHand(Mx, lerp(H + 90 * u, restTipY + bob, rise), pointUp(0));
        if (p >= .995 && tp >= 1 && done) break;
      }
      lpct.textContent = "100";
      lbar.setAttribute("stroke-dashoffset", 0);
      fit(); measure(); makePile(); sizeArm(); layoutPlate(); placeScrim();   // fonts may have arrived: re-fit once, before anything is visible
      M.bob = 0; applyM();
      bg(tween(380, function (e) { load.style.opacity = (1 - e).toFixed(3); }, E.io));
      // wait for the visitor: the plate keeps floating, and after 2 seconds a message tells them what to do
      var tw0 = performance.now(), hinted = false;
      while (!clicked) {
        await frame();
        var nw = performance.now();
        M.bob = Math.sin(nw / 430) * 4 * u; applyM();
        setHand(Mx, restTipY + M.bob, pointUp(0));
        if (!hinted && nw - tw0 > 2000) { hinted = true; hint.classList.add("on"); }
      }
      hint.classList.remove("on");
      M.bob = 0; applyM();
    }

    async function phasePress() {
      var y0 = restTipY;
      bg(ripple(rip1, Mx, baseY, 0)); bg(ripple(rip2, Mx, baseY, 130));
      await tween(170, function (e) { M.dy = 10 * e; M.s = 1 - .06 * e; applyM(); setHand(Mx, y0 + 6 * e, pointUp(.2 * e)); }, E.out);
      await sleep(90);
      await tween(330, function (e) { M.dy = 10 * (1 - e); M.s = .94 + .06 * e; applyM(); setHand(Mx, y0 + 6 * (1 - e), pointUp(.2 * (1 - e))); }, E.back);
      M.dy = 0; M.s = 1; applyM();
    }

    /* ================= PHASE 2 + 3: light burst, arm in, letters fall ================= */
    var SLOT = function (L) { return { x: L.cx, y: L.vcy }; };
    var burstP = null, LIFT = 30, floatShadow = null;

    async function dropLetter(L, i) {
      await sleep(L.delay);
      if (i === 0) mw.style.visibility = "hidden";
      L.el.style.opacity = 1;
      var plateY = baseY - .36 * Mh;
      var sx0 = i === 0 ? Mx : L.jx + L.dx0, sy0 = i === 0 ? plateY : -fs * 1.6, s0 = i === 0 ? Mh / fs : 1;
      await tween(i === 0 ? 800 : 720, function (e, uu) {
        var x = lerp(sx0, L.jx, E.out(uu)), y = lerp(sy0, L.jy, E.bounce(uu));
        var rot = L.rot + L.spin * (1 - E.out(uu)), s = lerp(s0, 1, E.out(uu));
        L.el.style.transform = "translate3d(" + (x - L.cx).toFixed(2) + "px," + (y - L.vcy).toFixed(2) + "px,0) rotate(" + rot.toFixed(2) + "deg) scale(" + s.toFixed(3) + ")";
      }, E.lin);
    }

    async function burst() {
      await Promise.all([
        bg((async function () {                      // the wallpaper appears layer by layer, under the falling letters
          await sleep(650);
          await tween(900, function (e) { wimg.style.opacity = e.toFixed(3); wimg.style.transform = "scale(" + lerp(1.07, 1, e).toFixed(4) + ")"; }, E.io);
        })()),
        bg((async function () {
          await sleep(1350);
          await tween(800, function (e) { wfloor.style.opacity = e.toFixed(3); }, E.io);
        })()),
        tween(1700, function (e) {
          var r = lerp(8, diag * 1.08, e);
          wall.style.clipPath = wall.style.webkitClipPath = "circle(" + r.toFixed(1) + "px at " + bx + "px " + by + "px)";
          rim.style.opacity = (1 - e * e).toFixed(3);
          rim.style.transform = "translate3d(" + (bx - 200) + "px," + (by - 200) + "px,0) scale(" + Math.max(r / 186, .02).toFixed(3) + ")";
          vig.style.opacity = e.toFixed(3); scrim.style.opacity = e.toFixed(3);
        }, E.out),
        tween(720, function (e) { flash.style.opacity = (1 - e).toFixed(3); }, E.io)
      ]);
      wall.style.clipPath = wall.style.webkitClipPath = "none";
      rim.style.opacity = 0;
    }

    async function armEntry() {
      await sleep(60);
      var sy = H + 90 * u;
      await tween(380, function (e) { setHand(Mx, lerp(restTipY, sy, e), pointUp(0)); }, E.ein);     // the peeking hand sinks away
      hideArm();
      setShoulder("left");
      var hidX = -(TIPMAX * u + 60), readyX = W * .26, readyY = floorY - fs * .9;
      await tween(620, function (e) {
        setHand(lerp(hidX, readyX, e), lerp(floorY - fs * .2, readyY, e), { tilt: -.2 * (1 - e), curl: 0, spread: lerp(.95, .45, e), wiggle: 1 });
      }, E.back);
    }

    async function phaseReveal() {
      for (var i = 0; i < letters.length; i++) letters[i].landed = bg(dropLetter(letters[i], i));
      burstP = bg(burst());                             // the wallpaper keeps revealing while the arm starts sorting
      await armEntry();
    }

    /* ================= PHASE 4: the arm sorts every letter ================= */
    async function place(i) {
      var L = letters[i];
      await L.landed;
      measure();
      var dur = i === 0 ? 300 : 140, rd = Math.round(dur * .42), cd = dur - rd;
      var off = L.w * .5 + 6;
      var dp = Math.hypot(L.jx - A.Sx, L.jy - A.Sy) || 1, pk = { x: L.jx - (L.jx - A.Sx) / dp * off, y: L.jy - (L.jy - A.Sy) / dp * off };
      var from = { x: A.tx, y: A.ty }, reachArc = Math.min(fs * .6, Math.hypot(pk.x - from.x, pk.y - from.y) * .25);
      // reach out to the letter
      await tween(rd, function (e, uu) {
        setHand(lerp(from.x, pk.x, e), lerp(from.y, pk.y, e) - reachArc * Math.sin(Math.PI * uu), { tilt: -.12 * Math.sin(Math.PI * uu), curl: .15 * e, wiggle: .6, spread: .55 });
      }, E.out);
      // grab, carry, snap into the slot
      var sl = SLOT(L), arc = fs * (i === 0 ? .5 : .4);
      await tween(cd, function (e, uu) {
        var lx = lerp(L.jx, sl.x, e), ly = lerp(L.jy, sl.y, e) - arc * Math.sin(Math.PI * e);
        var d2 = Math.hypot(lx - A.Sx, ly - A.Sy) || 1;
        var tx = lx - (lx - A.Sx) / d2 * off, ty = ly - (ly - A.Sy) / d2 * off;
        var tilt = .16 * Math.sin(uu * Math.PI * 2) * (1 - uu);
        var ang = setHand(tx, ty, { tilt: tilt, curl: lerp(.55, .15, E.io(clamp((uu - .75) / .25, 0, 1))), wiggle: 0, spread: .35 });
        var px = tx + Math.cos(ang) * off, py = ty + Math.sin(ang) * off;
        var rot = L.rot * (1 - E.back(uu)), pop = 1 + .16 * Math.sin(Math.PI * clamp((uu - .62) / .38, 0, 1));
        L.el.style.transform = "translate3d(" + (px - L.cx).toFixed(2) + "px," + (py - L.vcy).toFixed(2) + "px,0) rotate(" + rot.toFixed(2) + "deg) scale(" + pop.toFixed(3) + ")";
      }, E.lin);
      L.el.style.transform = "translate3d(0,0,0) rotate(0deg) scale(1)";   // exact, no float drift
    }

    async function phaseArrange() {
      for (var i = 0; i < letters.length; i++) await place(i);
      for (i = 0; i < letters.length; i++) {            // safety net: every single letter ends exactly on its slot
        letters[i].el.style.opacity = 1;
        letters[i].el.style.transform = "translate3d(0,0,0) rotate(0deg) scale(1)";
      }
      await burstP;
    }

    /* ================= PHASE 5: slam, bounce, badge ================= */
    function shock(x) {
      var ring = sv("ellipse", { cx: x, cy: floorY, rx: 2, ry: 1, fill: "none", stroke: "#8ff0ff", "stroke-width": 4, opacity: 0 }, fxSvg);
      var ring2 = sv("ellipse", { cx: x, cy: floorY, rx: 2, ry: 1, fill: "none", stroke: "#ffffff", "stroke-width": 2, opacity: 0 }, fxSvg);
      var sparks = [];
      for (var i = 0; i < 12; i++) sparks.push(sv("line", { stroke: i % 2 ? "#fff" : "#b6ff6a", "stroke-width": 2.6, "stroke-linecap": "round", opacity: 0 }, fxSvg));
      var maxR = Math.max(W * .56, 320);
      return tween(800, function (e, uu) {
        ring.setAttribute("rx", (8 + e * maxR).toFixed(1)); ring.setAttribute("ry", (2 + e * 40).toFixed(1));
        ring.setAttribute("opacity", (1 - uu).toFixed(3)); ring.setAttribute("stroke-width", (5 * (1 - uu) + 1).toFixed(2));
        var e2 = E.out(clamp(uu * 1.25 - .15, 0, 1));
        ring2.setAttribute("rx", (8 + e2 * maxR * .8).toFixed(1)); ring2.setAttribute("ry", (2 + e2 * 30).toFixed(1));
        ring2.setAttribute("opacity", (.8 * (1 - clamp(uu * 1.25 - .15, 0, 1))).toFixed(3));
        for (var k = 0; k < sparks.length; k++) {
          var su = clamp(uu / .6, 0, 1), a = Math.PI * (1.06 + k * .075);
          var r0 = 10 + E.out(su) * (70 + (k % 3) * 26) * u * .8, r1 = r0 + 16 * (1 - su);
          sparks[k].setAttribute("x1", (x + Math.cos(a) * r0).toFixed(1)); sparks[k].setAttribute("y1", (floorY + Math.sin(a) * r0).toFixed(1));
          sparks[k].setAttribute("x2", (x + Math.cos(a) * r1).toFixed(1)); sparks[k].setAttribute("y2", (floorY + Math.sin(a) * r1).toFixed(1));
          sparks[k].setAttribute("opacity", su < 1 ? (1 - su).toFixed(3) : 0);
        }
      }, E.lin).then(function () { ring.remove(); ring2.remove(); sparks.forEach(function (s) { s.remove(); }); });
    }
    async function bounceTitle() {
      LIFT = clamp(fs * .5, 24, 56);
      var n = letters.length, sw = letters[n - 1].cx - letters[0].cx + fs * .6;
      floatShadow = sv("ellipse", { cx: W / 2, cy: floorY + fs * .08, rx: sw * .42, ry: Math.max(fs * .07, 4), fill: "#000", opacity: 0 }, fxSvg);
      floatShadow.setAttribute("style", "filter:blur(6px)");
      var top = LIFT + clamp(fs * .22, 10, 26);
      await tween(190, function (e) { setNameY(-top * e); }, E.out);                         // the slam throws the title up off the floor
      await tween(560, function (e, uu) {                                                    // and it settles into a floating position above it
        setNameY(-lerp(top, LIFT, e) - 5 * Math.pow(1 - uu, 2) * Math.sin(uu * Math.PI * 3));
        floatShadow.setAttribute("opacity", (.5 * e).toFixed(3));
      }, E.out);
      setNameY(-LIFT);
      bg((async function () {                                                                // gentle hover until the intro ends
        var t0 = performance.now();
        for (;;) {
          await frame();
          var s = Math.sin((performance.now() - t0) / 380);
          setNameY(-LIFT - 3.5 * s);
          floatShadow.setAttribute("rx", (sw * (.42 - .012 * s)).toFixed(1));
          floatShadow.setAttribute("opacity", (.5 + .06 * s).toFixed(3));
        }
      })());
    }
    async function shake() {
      await tween(420, function (e, uu) {
        var s = Math.sin(uu * 95) * 7 * Math.pow(1 - uu, 2);
        stage.style.transform = "translate3d(" + (s * .4).toFixed(2) + "px," + s.toFixed(2) + "px,0)";
      }, E.lin);
      stage.style.transform = "none";
    }

    async function phaseSlam() {
      var sx = W / 2, from = { x: A.tx, y: A.ty }, a0 = Math.atan2(A.ty - A.Sy, A.tx - A.Sx);
      var wy = Math.max(H * .14, floorY - fs * 2.3), wx = sx - fs * .4;
      // wind up: rear back and make a fist
      await tween(240, function (e, uu) {
        if (uu > .4) armSvg.style.zIndex = 5;                               // the arm may now pass in front of the finished title
        setHand(lerp(from.x, wx, e), lerp(from.y, wy, e), { ang: lerp(a0, 1.45, e), curl: e, spread: .3, wiggle: 0, bulge: 1.2 });
      }, E.io);
      await sleep(50);
      // slam
      await tween(140, function (e) {
        setHand(lerp(wx, sx, e), lerp(wy, floorY + fs * .02, e), { ang: lerp(1.45, Math.PI / 2, e), curl: 1, spread: .3, wiggle: 0, bulge: 1.2 });
      }, E.ein);
      var hit = Promise.all([shock(sx), bounceTitle(), shake()]);
      bg(hit);
      await sleep(220);                                                      // let the impact breathe, fist stays on the floor
      // reach back to the left edge for the badge
      var hidX = -pillW - 28, fy = floorY + fs * .02, a1 = Math.atan2(pillY - A.Sy, hidX - A.Sx);
      await tween(300, function (e, uu) {
        var ey = E.out(uu);
        setHand(lerp(sx, hidX, e), lerp(fy, pillY, ey), { ang: lerp(Math.PI / 2, a1, e), curl: lerp(1, .2, e), spread: .4, wiggle: 0 });
      }, E.io);
      await hit;
    }

    async function phaseBadge() {
      measure();
      var finalLeft = W / 2 - pillW / 2, hidX = -pillW - 28, top = pillY - pillH / 2;
      await tween(620, function (e) {
        var tx = lerp(hidX, finalLeft - 5, e);
        setHand(tx, pillY, { tilt: 0, curl: .2, spread: .4, wiggle: 0 });
        pill.style.transform = "translate3d(" + (tx + 5).toFixed(2) + "px," + top.toFixed(2) + "px,0)";
      }, E.io);
      pill.style.transform = "translate3d(" + finalLeft.toFixed(2) + "px," + top.toFixed(2) + "px,0)";
      pill.classList.add("on");
      await sleep(120);
    }

    /* ================= PHASE 6: leave, pause, slide up ================= */
    async function phaseExit() {
      var hidX = -(TIPMAX * u + 60), fromX = A.tx;
      await tween(430, function (e) { setHand(lerp(fromX, hidX, e), pillY, { curl: .1, spread: .6, wiggle: 1 }); }, E.io);
      hideArm();
      await sleep(1500);                                   // admire the finished logo
      root.style.willChange = "transform,opacity";
      await tween(700, function (e) {
        root.style.transform = "translate3d(0," + (-e * 100).toFixed(2) + "%,0)";
        root.style.opacity = (1 - e * e * .6).toFixed(3);
      }, E.io);
    }

    async function play() {
      await phaseLoad();
      await phasePress();
      await phaseReveal();
      await phaseArrange();
      await phaseSlam();
      await phaseBadge();
      await phaseExit();
    }

    /* ---------- lifecycle ---------- */
    var ctl = { done: false };
    var guard = 0, onResize, stopScroll = function (e) { e.preventDefault(); };
    function finish() {
      if (ctl.done) return;
      ctl.done = true;
      R.dead = true;
      clearTimeout(guard);
      window.removeEventListener("resize", onResize);
      root.removeEventListener("wheel", stopScroll);
      root.removeEventListener("touchmove", stopScroll);
      if (root.parentNode) root.parentNode.removeChild(root);
      if (cur === ctl) { cur = null; de.style.overflow = prevOverflow; }
    }
    function quickOut() {
      if (ctl.done || ctl.fading) return;
      ctl.fading = true;
      root.style.transition = "opacity .35s ease";
      root.style.opacity = 0;
      setTimeout(finish, 380);
    }
    ctl.kill = function (instant) {
      R.dead = true;
      if (instant) finish(); else quickOut();
    };
    onResize = function () { if (Math.abs(innerWidth - W) > W * .08) ctl.kill(false); };      // rotate / resize: don't leave a broken layout, just open the page
    window.addEventListener("resize", onResize);
    root.addEventListener("wheel", stopScroll, { passive: false });
    root.addEventListener("touchmove", stopScroll, { passive: false });
    skipBtn.addEventListener("click", function () { ctl.kill(false); });
    // (the 20s safety timer starts when the visitor presses the M, see onM; the skip button is always there)

    var completed = false;
    play().then(function () { completed = true; }, function (e) { if (e !== ABORT && window.console) console.error("[intro]", e); })
      .then(function () { if (completed) finish(); else quickOut(); });
    return ctl;
  }

  /* ---------------- start / replay ---------------- */
  function start(reuse) {
    if (cur) cur.kill(true);
    var root = reuse && reuse.parentNode ? reuse : null;
    if (!root) {
      root = document.createElement("div");
      root.id = "splash";
      root.setAttribute("aria-hidden", "true");
      document.body.insertBefore(root, document.body.firstChild);
    }
    root.style.cssText = "";
    de.classList.remove("no-splash");
    ensureCSS();
    cur = run(root);
  }

  var rb = document.createElement("button");
  rb.type = "button"; rb.className = "mgi-replay"; rb.textContent = "↻ Replay Intro";
  rb.setAttribute("aria-label", "Replay Intro");
  rb.addEventListener("click", function () { start(null); });
  ensureCSS();
  document.body.appendChild(rb);

  window.MG_INTRO = { replay: function () { start(null); }, skip: function () { if (cur) cur.kill(false); } };

  if (de.classList.contains("no-splash") || reduce) host.parentNode.removeChild(host);
  else start(host);
})();
