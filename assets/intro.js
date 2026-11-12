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
  var T = { click: 1.5, reveal0: 1.55, reveal1: 2.65, fall0: 2.3, armIn: 3.45, endFade: 8.7 };

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
  var LAND = 0.9;
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
    var sx = Math.min(W + 40, cx + 380), sy = H + 50;
    var far = 0;
    letters.forEach(function (L) {
      far = Math.max(far, Math.hypot(L.jx - sx, L.jy - sy), Math.hypot(L.cx - sx, L.cy - sy));
    });
    var lift = { x: Math.min(W - 60, maxX + 70 * Math.max(.8, far / 470)), y: Math.max(40, minY - H * 0.26) };
    var hit = { x: lift.x, y: floor - 8 };
    far = Math.max(far, Math.hypot(lift.x - sx, lift.y - sy));
    var L1 = far * 0.62;
    var u = clamp(far / 330, 1.1, 2.1);
    plan = {
      sx: sx, sy: sy, L1: L1, L2: L1, u: u, cx: cx, bw: bw, floor: floor, lift: lift, hit: hit,
      hidden: { x: sx + 1.9 * L1 * 0.98, y: sy - 40 }
    };
    // hand path
    segs = [];
    var t = T.armIn, prev = plan.hidden, cPrev = .9;
    letters.forEach(function (L, i) {
      var A = i === 0 ? 0.5 : 0.075, B = 0.115;
      var J = { x: L.jx, y: L.jy }, Sl = { x: L.cx, y: L.cy };
      segs.push({ t0: t, t1: t + A, a: prev, b: J, c0: cPrev, c1: .1, e: i === 0 ? eio : eout, kind: "reach", i: i });
      L.grab = t + A; L.place = t + A + B;
      segs.push({ t0: t + A, t1: t + A + B, a: J, b: Sl, c0: .1, c1: .85, e: eio, kind: "carry", i: i });
      prev = Sl; cPrev = .85; t += A + B;
    });
    plan.tLift = t; plan.tHit = t + 0.32; plan.tImp = plan.tHit + 0.12;
    segs.push({ t0: t, t1: plan.tHit, a: prev, b: plan.lift, c0: .85, c1: 1, e: eio, kind: "lift" });
    segs.push({ t0: plan.tHit, t1: plan.tImp, a: plan.lift, b: plan.hit, c0: 1, c1: 1, e: ein, kind: "slam" });
    segs.push({ t0: plan.tImp, t1: plan.tImp + 0.28, a: plan.hit, b: plan.hit, c0: 1, c1: 1, e: eout, kind: "hold" });
    segs.push({ t0: plan.tImp + 0.28, t1: plan.tImp + 0.95, a: plan.hit, b: plan.hidden, c0: .5, c1: .2, e: eio, kind: "leave" });
    plan.tLev = plan.tImp + 0.25;
    T.endFade = plan.tImp + 1.55;
    letters.forEach(function (L) { L.d = Math.hypot(L.cx - plan.hit.x, L.cy - plan.hit.y); });
    buildArm();
  }

  /* ---- alien arm (SVG) ---- */
  function buildArm() {
    fx.textContent = "";
    var u = plan.u;
    var shadow = sv("ellipse", { cx: plan.cx, cy: plan.floor + 4, rx: plan.bw * 0.55, ry: 9 * u, fill: "#000", opacity: 0 }, fx);
    shadow.setAttribute("style", "filter:blur(5px)");
    var ring = sv("ellipse", { cx: plan.hit.x, cy: plan.floor, rx: 1, ry: 1, fill: "none", stroke: "#7cf0ff", "stroke-width": 3, opacity: 0 }, fx);
    var sparks = [];
    for (var i = 0; i < 10; i++) sparks.push(sv("line", { stroke: i % 2 ? "#fff" : "#7cf0ff", "stroke-width": 2.5, "stroke-linecap": "round", opacity: 0 }, fx));
    var g = sv("g", {}, fx);
    var dark = "#0a3a35", skin = "#6ee7b7", hi = "#c8ffe9";
    var upO = sv("path", { fill: "none", stroke: dark, "stroke-width": 26 * u, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    var foO = sv("path", { fill: "none", stroke: dark, "stroke-width": 20 * u, "stroke-linecap": "round" }, g);
    var up = sv("path", { fill: "none", stroke: skin, "stroke-width": 20 * u, "stroke-linecap": "round" }, g);
    var fo = sv("path", { fill: "none", stroke: skin, "stroke-width": 14 * u, "stroke-linecap": "round" }, g);
    var foH = sv("path", { fill: "none", stroke: hi, "stroke-width": 3 * u, "stroke-linecap": "round", opacity: .55 }, g);
    var elbow = sv("circle", { r: 13 * u, fill: skin, stroke: dark, "stroke-width": 3 * u }, g);
    var hand = sv("g", {}, g);
    var fing = [];
    var palm = sv("ellipse", { cx: 0, cy: 0, rx: 21 * u, ry: 17 * u, fill: skin, stroke: dark, "stroke-width": 3 * u }, hand);
    for (var k = 0; k < 4; k++) {
      var fg = sv("g", {}, hand);
      var o1 = sv("line", { x1: 0, y1: 0, x2: 1, y2: 0, stroke: dark, "stroke-width": 9 * u, "stroke-linecap": "round" }, fg);
      var o2 = sv("line", { x1: 0, y1: 0, x2: 1, y2: 0, stroke: dark, "stroke-width": 9 * u, "stroke-linecap": "round" }, fg);
      var s1 = sv("line", { x1: 0, y1: 0, x2: 1, y2: 0, stroke: skin, "stroke-width": 5 * u, "stroke-linecap": "round" }, fg);
      var s2 = sv("line", { x1: 0, y1: 0, x2: 1, y2: 0, stroke: skin, "stroke-width": 5 * u, "stroke-linecap": "round" }, fg);
      fing.push({ g: fg, lines: [o1, s1, o2, s2] });
    }
    var tip = sv("circle", { r: 2.2 * u, fill: "#fff", opacity: .0 }, hand);
    arm = { g: g, upO: upO, foO: foO, up: up, fo: fo, foH: foH, elbow: elbow, hand: hand, fing: fing, shadow: shadow, ring: ring, sparks: sparks, u: u };
  }

  function ik(tx, ty) {
    var sx = plan.sx, sy = plan.sy, L1 = plan.L1, L2 = plan.L2;
    var dx = tx - sx, dy = ty - sy;
    var d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 2, L1 + L2 - 1);
    var base = Math.atan2(dy, dx);
    var a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    var e1 = { x: sx + Math.cos(base + a) * L1, y: sy + Math.sin(base + a) * L1 };
    var e2 = { x: sx + Math.cos(base - a) * L1, y: sy + Math.sin(base - a) * L1 };
    var e = e1.x > e2.x ? e1 : e2;                 // keep the elbow on the outer, right side
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
    var A = arm;
    if (!h || h.x > W + plan.L1 * 1.3) { A.g.setAttribute("opacity", 0); return; }
    A.g.setAttribute("opacity", 1);
    var r = ik(h.x, h.y);
    var d1 = "M" + plan.sx + " " + plan.sy + "L" + r.ex + " " + r.ey;
    var d2 = "M" + r.ex + " " + r.ey + "L" + r.wx + " " + r.wy;
    A.upO.setAttribute("d", d1); A.up.setAttribute("d", d1);
    A.foO.setAttribute("d", d2); A.fo.setAttribute("d", d2); A.foH.setAttribute("d", d2);
    A.elbow.setAttribute("cx", r.ex); A.elbow.setAttribute("cy", r.ey);
    var ang = Math.atan2(r.wy - r.ey, r.wx - r.ex);
    A.hand.setAttribute("transform", "translate(" + r.wx + " " + r.wy + ") rotate(" + (ang * 180 / Math.PI) + ")");
    var u = A.u, c = clamp(h.c, 0, 1);
    var defs = [[-9, -.35], [-2, -.1], [6, .12], [12, .42]];   // base y (palm side +), spread
    for (var k = 0; k < 4; k++) {
      var f = A.fing[k];
      var by = (k === 3 ? 13 : (k - 1) * 8.5) * u, bx = (k === 3 ? 4 : 17) * u;
      var len1 = (k === 3 ? 15 : 24) * u, len2 = (k === 3 ? 13 : 20) * u;
      var open = (k === 3 ? 62 : (k - 1) * 11) * Math.PI / 180;
      var a1 = lerp(open, 80 * Math.PI / 180 + (k === 3 ? -.5 : 0), c);
      var a2 = a1 + lerp(.1, 1.45, c);
      var x1 = bx + Math.cos(a1) * len1, y1 = by + Math.sin(a1) * len1;
      var x2 = x1 + Math.cos(a2) * len2, y2 = y1 + Math.sin(a2) * len2;
      var L = f.lines;
      L[0].setAttribute("x1", bx); L[0].setAttribute("y1", by); L[0].setAttribute("x2", x1); L[0].setAttribute("y2", y1);
      L[1].setAttribute("x1", bx); L[1].setAttribute("y1", by); L[1].setAttribute("x2", x1); L[1].setAttribute("y2", y1);
      L[2].setAttribute("x1", x1); L[2].setAttribute("y1", y1); L[2].setAttribute("x2", x2); L[2].setAttribute("y2", y2);
      L[3].setAttribute("x1", x1); L[3].setAttribute("y1", y1); L[3].setAttribute("x2", x2); L[3].setAttribute("y2", y2);
    }
  }

  /* ---- one frame ---- */
  var lastWall = "";
  function render(t) {
    // --- wall: M plate, click, pull back
    var appear = eout(u01(t, 0.1, 1.0));
    var click = t >= T.click;
    var rv = eio(u01(t, T.reveal0, T.reveal1));
    var zoom = click ? lerp(2.5, 1, eio(u01(t, T.reveal0, T.reveal1 + .1))) : lerp(2.7, 2.5, u01(t, 0, T.click));
    var R0 = 95 * S;                                    // local radius around the M plate
    var Rmax = Math.hypot(W, H) * 1.1;
    var R = lerp(R0, Rmax, rv);
    var dim = click ? lerp(.6, 1, eout(u01(t, T.click, T.click + .5))) : lerp(.35, .6, u01(t, .2, T.click));
    wall.style.opacity = (appear * dim).toFixed(3);
    wall.style.transformOrigin = geo.mx + "px " + geo.my + "px";
    wall.style.transform = "scale(" + zoom.toFixed(4) + ")";
    var m = "radial-gradient(circle at " + geo.mx.toFixed(1) + "px " + geo.my.toFixed(1) + "px,#000 " + (R * .62).toFixed(1) + "px,transparent " + R.toFixed(1) + "px)";
    if (m !== lastWall) { wall.style.webkitMaskImage = m; wall.style.maskImage = m; lastWall = m; }
    shade.style.opacity = eout(u01(t, T.click + .3, T.click + 1.2)).toFixed(3);

    // click ripple + page flash
    var fu = u01(t, T.click, T.click + .9);
    if (fu > 0 && fu < 1) {
      var fr = lerp(20, Math.hypot(W, H) * .55, eout(fu));
      flash.style.opacity = (1 - fu).toFixed(3);
      flash.style.background = "radial-gradient(circle at " + geo.mx + "px " + geo.my + "px, rgba(190,245,255,.75) 0, rgba(34,211,238,.35) " + (fr * .25).toFixed(0) + "px, rgba(34,211,238,0) " + fr.toFixed(0) + "px)";
    } else flash.style.opacity = 0;

    if (!measured) {
      if (t >= 1.2) { buildLetters(); measure(); } else return;
    }

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
    var lv = u01(t, plan.tLev, plan.tLev + 0.6);
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
