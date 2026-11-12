/* Marcelino Games opening animation.
   1) the M plate shows  2) a click, the controller and page light up  3) the name falls in jumbled
   4) an alien arm sorts the letters, then slams  5) letters float, the arm leaves, the page opens.
   Everything is a pure function of time (render(t)), so it can be seeked for testing. */
(function () {
  var root = document.getElementById("splash");
  if (!root) return;
  var de = document.documentElement;
  var reduce = false;
  try { reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  if (de.classList.contains("no-splash") || reduce) { root.remove(); return; }

  var NS = "http://www.w3.org/2000/svg";
  var W = 0, H = 0, S = 1, offX = 0, offY = 0;
  var done = false, measured = false, raf = 0, t0 = 0;
  var letters = [], plan = null, segs = [], arm = null, geo = null;

  /* ---- timeline (seconds) ---- */
  var T = { mIn0: 0.4, mIn1: 4.4, handIn: 5.0, handPre: 6.9, click: 7.9, away0: 8.6, away1: 9.8, reveal0: 8.0, reveal1: 12.6, fall0: 11.0, armIn: 14.0, endFade: 30 };

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function u01(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function eio(u) { return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function eout(u) { return 1 - Math.pow(1 - u, 3); }
  function ein(u) { return u * u * u; }
  function eback(u) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }
  function ebounce(u) {
    var n = 7.5625, d = 2.75;
    if (u < 1 / d) return n * u * u;
    if (u < 2 / d) { u -= 1.5 / d; return n * u * u + .75; }
    if (u < 2.5 / d) { u -= 2.25 / d; return n * u * u + .9375; }
    u -= 2.625 / d; return n * u * u + .984375;
  }
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function sv(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ---- DOM ---- */
  var stage = el("div", "sp-stage", root);
  var wall = el("div", "sp-wall", stage);
  var shade = el("div", "sp-shade", stage);
  var flash = el("div", "sp-flash", stage);
  var nameEl = el("div", "sp-name", stage);
  var fx = sv("svg", { "class": "sp-fx", "aria-hidden": "true" }, stage);
  var skip = el("button", "sp-skip", root);
  skip.type = "button"; skip.textContent = "تخطّي";

  var wide = false;
  function buildLetters() {
    nameEl.textContent = "";
    wide = innerWidth >= 640 && innerWidth > innerHeight * 0.9;
    var words = [["Marcelino", ""], ["Games", "b"]];
    var lines = wide ? [words] : [[words[0]], [words[1]]];
    letters = [];
    lines.forEach(function (ws) {
      var line = el("div", "sp-line", nameEl);
      ws.forEach(function (w, wi) {
        if (wi) el("span", "sp-sp", line);
        for (var i = 0; i < w[0].length; i++) {
          var s = el("span", "sp-l" + (w[1] ? " " + w[1] : ""), line);
          s.textContent = w[0][i];
          letters.push({ el: s });
        }
      });
    });
    nameEl.style.fontSize = wide ? Math.min(innerWidth * 0.062, innerHeight * 0.13, 92) + "px" : Math.min(innerWidth * 0.125, 70) + "px";
  }

  /* ---- geometry from the viewport ---- */
  function layout() {
    W = innerWidth; H = innerHeight;
    S = Math.max(W / 1200, H / 800);
    offX = (W - 1200 * S) / 2; offY = (H - 800 * S) / 2;
    fx.setAttribute("viewBox", "0 0 " + W + " " + H);
    geo = {
      mx: offX + 600 * S, my: offY + 277 * S,         // M plate centre on screen
      floor: Math.min(H - 46, offY + 662 * S)         // glowing disc under the controller
    };
    nameEl.style.bottom = (H - geo.floor) + "px";
    nameEl.style.top = "auto";
  }

  function pickRadius() { return Math.max(70 * S * 2.4, 90); }

  /* ---- measure slots, build jumbled pile, hand path ---- */
  var LAND = 1.25;
  function measure() {
    measured = true;
    letters.forEach(function (L) {
      L.el.style.transform = "none";
      var r = L.el.getBoundingClientRect();
      L.cx = r.left + r.width / 2; L.cy = r.top + r.height / 2; L.w = r.width; L.h = r.height;
    });
    var nr = nameEl.getBoundingClientRect();
    var minX = 1e9, maxX = -1e9, minY = 1e9;
    letters.forEach(function (L) { minX = Math.min(minX, L.cx - L.w / 2); maxX = Math.max(maxX, L.cx + L.w / 2); minY = Math.min(minY, L.cy - L.h / 2); });
    var bw = maxX - minX, cx = (minX + maxX) / 2;
    var floor = geo.floor;
    seed = 7;
    var n = letters.length;
    letters.forEach(function (L, i) {
      // pile on the floor, tipped over, spread wider than the final word
      var spread = Math.min(W * 0.46, bw * 0.62 + 40);
      L.jx = cx + (rnd() * 2 - 1) * spread;
      L.rot = (rnd() < .5 ? -1 : 1) * (28 + rnd() * 62);
      L.jy = floor - L.h * (0.34 + rnd() * 0.1) - rnd() * L.h * 0.18;
      L.fs = T.fall0 + i * 0.045 + rnd() * 0.16;
      L.fromY = -(L.jy + 160);
      L.spin = (rnd() < .5 ? -1 : 1) * (200 + rnd() * 260);
    });
    // spread overlapping neighbours a little so the pile does not stack on one spot
    // arm geometry
    var sx = -60, sy = H + 30;
    var far = 0;
    letters.forEach(function (L) {
      far = Math.max(far, Math.hypot(L.jx - sx, L.jy - sy), Math.hypot(L.cx - sx, L.cy - sy));
    });
    far = Math.max(far, Math.hypot(geo.mx - sx, geo.my - sy) + 40);
    var lift = { x: Math.max(60, minX - 70 * Math.max(.8, far / 470)), y: Math.max(40, minY - H * 0.26) };
    var hit = { x: lift.x, y: floor - 8 };
    far = Math.max(far, Math.hypot(lift.x - sx, lift.y - sy));
    var L1 = far * 0.62;
    var u = clamp(far / 330, 1.1, 2.1) * 1.5;
    plan = {
      sx: sx, sy: sy, L1: L1, L2: L1, u: u, cx: cx, bw: bw, floor: floor, lift: lift, hit: hit,
      hidden: { x: sx - 1.9 * L1 * 0.98, y: sy - 40 }
    };
    // hand path
    segs = [];
    var uu = plan.u, tipR = 52 * uu;
    // the hand taps the M plate: fingertip lands on its centre
    var ang0 = Math.atan2(geo.my - plan.sy, geo.mx - plan.sx);
    plan.press = { x: geo.mx - Math.cos(ang0) * tipR, y: geo.my + 4 * S - Math.sin(ang0) * tipR };
    plan.pre = { x: plan.press.x - Math.cos(ang0) * 90 * uu, y: plan.press.y - Math.sin(ang0) * 90 * uu - 12 * uu };
    segs.push({ t0: T.handIn, t1: T.handPre, a: plan.hidden, b: plan.pre, c0: 0, c1: 0, e: eio, kind: "in", pose: "point" });
    segs.push({ t0: T.handPre, t1: T.click, a: plan.pre, b: plan.press, c0: 0, c1: 0, e: eio, kind: "press", pose: "point" });
    segs.push({ t0: T.click, t1: T.away0, a: plan.press, b: plan.press, c0: 0, c1: 0, e: eio, kind: "tap", pose: "point" });
    segs.push({ t0: T.away0, t1: T.away1, a: plan.press, b: plan.hidden, c0: 0, c1: .3, e: eio, kind: "away", pose: "point" });
    var t = T.armIn, prev = plan.hidden, cPrev = .9;
    letters.forEach(function (L, i) {
      var A = i === 0 ? 1.0 : 0.17, B = 0.26;
      var J = { x: L.jx, y: L.jy }, Sl = { x: L.cx, y: L.cy };
      segs.push({ t0: t, t1: t + A, a: prev, b: J, c0: cPrev, c1: .1, e: i === 0 ? eio : eout, kind: "reach", i: i });
      L.grab = t + A; L.place = t + A + B;
      segs.push({ t0: t + A, t1: t + A + B, a: J, b: Sl, c0: .1, c1: .85, e: eio, kind: "carry", i: i });
      prev = Sl; cPrev = .85; t += A + B;
    });
    plan.tLift = t; plan.tHit = t + 0.9; plan.tImp = plan.tHit + 0.2;
    segs.push({ t0: t, t1: plan.tHit, a: prev, b: plan.lift, c0: .85, c1: 1, e: eio, kind: "lift" });
    segs.push({ t0: plan.tHit, t1: plan.tImp, a: plan.lift, b: plan.hit, c0: 1, c1: 1, e: ein, kind: "slam" });
    segs.push({ t0: plan.tImp, t1: plan.tImp + 0.7, a: plan.hit, b: plan.hit, c0: 1, c1: 1, e: eout, kind: "hold" });
    segs.push({ t0: plan.tImp + 0.7, t1: plan.tImp + 2.0, a: plan.hit, b: plan.hidden, c0: .5, c1: .2, e: eio, kind: "leave" });
    plan.tLev = plan.tImp + 0.35;
    T.endFade = plan.tImp + 3.6;
    letters.forEach(function (L) { L.d = Math.hypot(L.cx - plan.hit.x, L.cy - plan.hit.y); });
    buildArm();
  }

  /* ---- alien arm (SVG): smooth rubbery green monster arm, blob hand, no fingers or joints ---- */
  function buildArm() {
    fx.textContent = "";
    var u = plan.u;
    var defs = sv("defs", {}, fx);
    var gr = sv("radialGradient", { id: "mgGreen", cx: ".35", cy: ".28", r: ".85" }, defs);
    [["0", "#e3ff9a"], ["0.35", "#9be84a"], ["0.75", "#55b52a"], ["1", "#2b7d1c"]].forEach(function (x) { sv("stop", { offset: x[0], "stop-color": x[1] }, gr); });
    var shadow = sv("ellipse", { cx: plan.cx, cy: plan.floor + 4, rx: plan.bw * 0.55, ry: 9 * u, fill: "#000", opacity: 0 }, fx);
    shadow.setAttribute("style", "filter:blur(5px)");
    var ring = sv("ellipse", { cx: plan.hit.x, cy: plan.floor, rx: 1, ry: 1, fill: "none", stroke: "#b6ff6a", "stroke-width": 3, opacity: 0 }, fx);
    var sparks = [];
    for (var i = 0; i < 10; i++) sparks.push(sv("line", { stroke: i % 2 ? "#fff" : "#b6ff6a", "stroke-width": 2.5, "stroke-linecap": "round", opacity: 0 }, fx));
    var g = sv("g", {}, fx);
    var dark = "#1d5a14";
    var body = sv("path", { fill: "#69c635", stroke: dark, "stroke-width": 3.2 * u, "stroke-linejoin": "round" }, g);
    var shade = sv("path", { fill: "none", stroke: "#2f8a1c", "stroke-opacity": .45, "stroke-linecap": "round", "stroke-width": 7 * u }, g);
    var hi = sv("path", { fill: "none", stroke: "#e8ffb8", "stroke-opacity": .7, "stroke-linecap": "round", "stroke-width": 3.4 * u }, g);
    var hand = sv("g", {}, g);
    var blob = sv("ellipse", { cx: 0, cy: 0, rx: 26 * u, ry: 21 * u, fill: "url(#mgGreen)", stroke: dark, "stroke-width": 3.2 * u }, hand);
    var thumb = sv("ellipse", { cx: 2 * u, cy: 17 * u, rx: 10 * u, ry: 8 * u, fill: "url(#mgGreen)", stroke: dark, "stroke-width": 3 * u }, hand);
    var nub = sv("ellipse", { cx: 30 * u, cy: 0, rx: 13 * u, ry: 9.5 * u, fill: "url(#mgGreen)", stroke: dark, "stroke-width": 3 * u, opacity: 0 }, hand);
    var spots = [[-8, -6, 4], [5, -11, 3], [-2, 6, 3.2]].map(function (p) {
      return sv("circle", { cx: p[0] * u, cy: p[1] * u, r: p[2] * u, fill: "#2f8a1c", "fill-opacity": .5 }, hand);
    });
    var shine = sv("ellipse", { cx: -8 * u, cy: -10 * u, rx: 8 * u, ry: 4 * u, fill: "#fff", "fill-opacity": .45, transform: "rotate(-20 " + (-8 * u) + " " + (-10 * u) + ")" }, hand);
    arm = { g: g, body: body, shade: shade, hi: hi, hand: hand, blob: blob, thumb: thumb, nub: nub, shine: shine, spots: spots, shadow: shadow, ring: ring, sparks: sparks, u: u };
  }

  function ik(tx, ty) {
    var sx = plan.sx, sy = plan.sy, L1 = plan.L1, L2 = plan.L2;
    var dx = tx - sx, dy = ty - sy;
    var d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 2, L1 + L2 - 1);
    var base = Math.atan2(dy, dx);
    var a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    var e1 = { x: sx + Math.cos(base + a) * L1, y: sy + Math.sin(base + a) * L1 };
    var e2 = { x: sx + Math.cos(base - a) * L1, y: sy + Math.sin(base - a) * L1 };
    var e = e1.y < e2.y ? e1 : e2;                 // elbow arches upward
    var wx = sx + Math.cos(base) * d, wy = sy + Math.sin(base) * d;
    return { ex: e.x, ey: e.y, wx: wx, wy: wy };
  }

  function handAt(t) {
    if (t < segs[0].t0) return null;
    var last = segs[segs.length - 1];
    if (t >= last.t1) return { x: last.b.x, y: last.b.y, c: last.c1, seg: last };
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (t >= s.t0 && t < s.t1) {
        var u = s.e(u01(t, s.t0, s.t1));
        return { x: lerp(s.a.x, s.b.x, u), y: lerp(s.a.y, s.b.y, u), c: lerp(s.c0, s.c1, u), seg: s };
      }
    }
    return null;
  }

  function drawArm(h, t) {
    var A = arm, u = A.u;
    if (!h || h.x < plan.sx - plan.L1 * 1.2) { A.g.setAttribute("opacity", 0); return; }
    A.g.setAttribute("opacity", 1);
    var r = ik(h.x, h.y);
    var S = { x: plan.sx, y: plan.sy }, E = { x: r.ex, y: r.ey }, Wr = { x: r.wx, y: r.wy };
    var C = { x: 2 * E.x - (S.x + Wr.x) / 2, y: 2 * E.y - (S.y + Wr.y) / 2 };   // curve passes through the elbow
    var N = 18, Ls = [], Rs = [], mid = [], Hs = [];
    var wS = 32 * u, wW = 15 * u;
    for (var k = 0; k <= N; k++) {
      var q = k / N, a = (1 - q) * (1 - q), b = 2 * (1 - q) * q, c2 = q * q;
      var px = a * S.x + b * C.x + c2 * Wr.x, py = a * S.y + b * C.y + c2 * Wr.y;
      var tx = 2 * (1 - q) * (C.x - S.x) + 2 * q * (Wr.x - C.x), ty = 2 * (1 - q) * (C.y - S.y) + 2 * q * (Wr.y - C.y);
      var tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
      var w = lerp(wS, wW, Math.pow(q, .8)) * (1 + .1 * Math.sin(q * Math.PI * 2.5));   // slightly rubbery, wobbly taper
      Ls.push([px + nx * w / 2, py + ny * w / 2]); Rs.push([px - nx * w / 2, py - ny * w / 2]);
      mid.push([px + nx * w * .28, py + ny * w * .28]); Hs.push([px - nx * w * .26, py - ny * w * .26]);
    }
    function pts(a) { return a.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }); }
    A.body.setAttribute("d", "M" + pts(Ls).join("L") + "L" + pts(Rs.slice().reverse()).join("L") + "Z");
    A.shade.setAttribute("d", "M" + pts(mid).join("L"));
    A.hi.setAttribute("d", "M" + pts(Hs.slice(1, N - 2)).join("L"));
    var ang = Math.atan2(r.wy - r.ey, r.wx - r.ex);
    A.hand.setAttribute("transform", "translate(" + r.wx.toFixed(1) + " " + r.wy.toFixed(1) + ") rotate(" + (ang * 180 / Math.PI).toFixed(1) + ")");
    var c = clamp(h.c, 0, 1), point = h.seg && h.seg.pose === "point";
    var rx, ry;
    if (point) { rx = 27; ry = 17; }
    else { rx = lerp(28, 21, c); ry = lerp(20, 25, c); }        // squeezes when it holds a letter
    A.blob.setAttribute("rx", rx * u); A.blob.setAttribute("ry", ry * u);
    A.nub.setAttribute("opacity", point ? 1 : 0);
    A.nub.setAttribute("cx", (rx + 6) * u);
    A.thumb.setAttribute("opacity", point ? 0 : 1);
    A.thumb.setAttribute("cy", ry * .78 * u);
  }

  /* ---- one frame ---- */
  var lastWall = "", remeasured = false;
  function render(t) {
    // --- wall: M plate, click, pull back
    var appear = eio(u01(t, T.mIn0, T.mIn1));
    var click = t >= T.click;
    var rv = eio(u01(t, T.reveal0, T.reveal1));
    var zoom = click ? lerp(2.5, 1, eio(u01(t, T.reveal0, T.reveal1 + .1))) : lerp(2.75, 2.5, eout(u01(t, 0, T.click)));
    var R0 = 95 * S;                                    // local radius around the M plate
    var Rmax = Math.hypot(W, H) * 1.1;
    var R = lerp(R0, Rmax, rv);
    var dim = click ? lerp(.6, 1, eio(u01(t, T.click, T.reveal1))) : lerp(.45, .6, u01(t, .2, T.click));
    wall.style.opacity = (appear * dim).toFixed(3);
    wall.style.transformOrigin = geo.mx + "px " + geo.my + "px";
    wall.style.transform = "scale(" + zoom.toFixed(4) + ")";
    var m = "radial-gradient(circle at " + geo.mx.toFixed(1) + "px " + geo.my.toFixed(1) + "px,#000 " + (R * .62).toFixed(1) + "px,transparent " + R.toFixed(1) + "px)";
    if (m !== lastWall) { wall.style.webkitMaskImage = m; wall.style.maskImage = m; lastWall = m; }
    shade.style.opacity = eio(u01(t, T.click + .6, T.reveal1)).toFixed(3);

    // click ripple + page flash
    var fu = u01(t, T.click, T.click + 1.5);
    if (fu > 0 && fu < 1) {
      var fr = lerp(20, Math.hypot(W, H) * .55, eout(fu));
      flash.style.opacity = (1 - fu).toFixed(3);
      flash.style.background = "radial-gradient(circle at " + geo.mx + "px " + geo.my + "px, rgba(190,245,255,.75) 0, rgba(34,211,238,.35) " + (fr * .25).toFixed(0) + "px, rgba(34,211,238,0) " + fr.toFixed(0) + "px)";
    } else flash.style.opacity = 0;

    if (!measured) {
      buildLetters(); measure();
    }

    if (!remeasured && t >= T.fall0 - 0.4) { remeasured = true; buildLetters(); measure(); }
    // --- hand
    var h = handAt(t);
    drawArm(h, t);

    // --- impact effects
    var ti = t - plan.tImp;
    var shake = ti > 0 && ti < 0.45 ? Math.sin(ti * 90) * 7 * Math.pow(1 - ti / 0.45, 2) : 0;
    stage.style.transform = shake ? "translate(" + (shake * .5).toFixed(2) + "px," + shake.toFixed(2) + "px)" : "none";
    var A = arm;
    if (ti > 0 && ti < 0.7) {
      var ru = ti / 0.7;
      A.ring.setAttribute("rx", (8 + eout(ru) * Math.max(W * .55, 320)).toFixed(1));
      A.ring.setAttribute("ry", (2 + eout(ru) * 38).toFixed(1));
      A.ring.setAttribute("opacity", (1 - ru).toFixed(3));
      A.ring.setAttribute("stroke-width", (4 * (1 - ru) + 1).toFixed(2));
    } else A.ring.setAttribute("opacity", 0);
    A.sparks.forEach(function (sp, i) {
      var su = ti / 0.5;
      if (ti > 0 && su < 1) {
        var ang = Math.PI * (1.08 + i * 0.087);   // fan over the top
        var r0 = 10 + eout(su) * (60 + (i % 3) * 22) * A.u, r1 = r0 + 16 * (1 - su);
        sp.setAttribute("x1", plan.hit.x + Math.cos(ang) * r0); sp.setAttribute("y1", plan.floor + Math.sin(ang) * r0);
        sp.setAttribute("x2", plan.hit.x + Math.cos(ang) * r1); sp.setAttribute("y2", plan.floor + Math.sin(ang) * r1);
        sp.setAttribute("opacity", (1 - su).toFixed(3));
      } else sp.setAttribute("opacity", 0);
    });

    // --- levitation
    var lv = u01(t, plan.tLev, plan.tLev + 1.2);
    var lift = 20 * eback(lv);
    if (lv <= 0) lift = 0;
    A.shadow.setAttribute("opacity", (t > plan.tImp - .1 ? lerp(.55, .22, clamp(lift / 20, 0, 1)) * u01(t, plan.tImp - .1, plan.tImp + .1) : 0).toFixed(3));
    A.shadow.setAttribute("rx", (plan.bw * lerp(.55, .42, clamp(lift / 20, 0, 1))).toFixed(1));

    // --- letters
    letters.forEach(function (L, i) {
      var x, y, rot, op = 1;
      if (t < L.fs) { L.el.style.opacity = 0; return; }
      var fu2 = u01(t, L.fs, L.fs + LAND);
      if (t < L.grab) {
        var b = ebounce(fu2);
        x = L.jx; y = L.jy + L.fromY * (1 - b);
        rot = L.rot + L.spin * (1 - Math.min(1, fu2 * 1.15)) * (1 - b * .0);
        rot = L.rot + L.spin * (1 - eout(fu2));
      } else if (t < L.place) {
        var hh = handAt(t);
        x = hh.x; y = hh.y;
        rot = lerp(L.rot, 0, eio(u01(t, L.grab, L.place)));
      } else {
        x = L.cx; y = L.cy; rot = 0;
        var hopu = (t - plan.tImp - L.d / 900) / 0.38;
        if (t >= plan.tImp && hopu > 0 && hopu < 1) y -= 14 * Math.exp(-L.d / 420) * Math.sin(Math.PI * hopu);
        if (lift > 0) y -= lift + Math.sin((t - plan.tLev) * 2.6 + i * 0.7) * 3 * clamp(lift / 20, 0, 1);
      }
      L.el.style.opacity = op;
      L.el.style.transform = "translate(" + (x - L.cx).toFixed(2) + "px," + (y - L.cy).toFixed(2) + "px) rotate(" + rot.toFixed(2) + "deg)";
    });
  }

  /* ---- run / finish ---- */
  function finish() {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    root.classList.add("out");
    setTimeout(function () { if (root.parentNode) root.remove(); }, 700);
  }
  function tick(now) {
    if (done) return;
    if (!t0) t0 = now;
    var t = (now - t0) / 1000;
    render(t);
    if (measured && t >= T.endFade) { finish(); return; }
    raf = requestAnimationFrame(tick);
  }

  layout();
  window.addEventListener("resize", function () {
    if (done) return;
    layout();
    if (measured) { buildLetters(); measure(); }
  });
  skip.addEventListener("click", finish);
  setTimeout(finish, 16000);                     // never trap the visitor
  window.MG_INTRO = { render: function (t) { done = false; t0 = -1; render(t); }, finish: finish, T: T, _stop: function () { cancelAnimationFrame(raf); done = true; } };
  raf = requestAnimationFrame(tick);
})();
