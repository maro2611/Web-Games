/* Marcelino Games - plain JS, no build step. Data lives in /data/*.json */
(function () {
  "use strict";

  var ICONS = {
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    wa: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.8-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.600 15L2 22l5.200-1.400A10 10 0 1 0 12 2zm0 18.200c-1.500 0-3-.4-4.200-1.200l-.3-.2-3.100.8.8-3-.2-.3A8.200 8.200 0 1 1 12 20.200z"/></svg>'
  };

  var SITE = {};
  var GAMES = [];

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function ltr(t) { return h("span", { class: "ltr", text: t }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function waLink(text) { return "https://wa.me/" + SITE.whatsapp + (text ? "?text=" + encodeURIComponent(text) : ""); }
  function daysAgo(d) { return (Date.now() - new Date(d).getTime()) / 86400000; }
  function fmtDate(d) { try { return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }); } catch (e) { return d; } }
  function visible() { return GAMES.filter(function (g) { return !g.hidden; }); }
  function latestVer(g) { return g.versions && g.versions[0]; }
  function byNewest(a, b) { return new Date(b.added) - new Date(a.added); }
  function gameUrl(g) { return "game.html?g=" + encodeURIComponent(g.slug); }

  /* ---------- shared layout ---------- */
  function renderChrome(page) {
    var header = h("header", { class: "site-header" }, [
      h("div", { class: "wrap" }, [
        h("a", { class: "logo", href: "index.html", html: 'Marcelino <span>Games</span>' }),
        h("nav", { class: "nav", "aria-label": "التنقل" }, [
          h("a", { href: "index.html", text: "الرئيسية", "aria-current": page === "home" ? "page" : false }),
          h("a", { href: "games.html", text: "الألعاب", "aria-current": page === "games" ? "page" : false }),
          h("a", { href: "complaints.html", text: "الشكاوى", "aria-current": page === "complaints" ? "page" : false }),
          h("a", { class: "icon-btn", href: "settings.html", "aria-label": "الإعدادات", html: ICONS.gear })
        ])
      ])
    ]);
    document.body.insertBefore(header, document.body.firstChild);

    if (SITE.announcement && SITE.announcement.on && SITE.announcement.text) {
      document.body.insertBefore(h("div", { class: "banner", text: SITE.announcement.text }), header);
    }

    var madeLink = h("a", { class: "made", href: waLink(), target: "_blank", rel: "noopener" }, [
      h("span", { text: "Made by Marcelino Fahmy" }),
      h("bdi", { text: SITE.phone })
    ]);
    document.body.appendChild(h("footer", { class: "site-footer" }, [h("div", { class: "wrap" }, [madeLink])]));
    document.body.appendChild(h("a", { class: "wa-float", href: waLink(), target: "_blank", rel: "noopener", "aria-label": "واتساب", html: ICONS.wa }));
  }

  /* ---------- modal helper ---------- */
  function openModal(content, onClose) {
    var overlay = h("div", { class: "modal", role: "dialog", "aria-modal": "true" });
    var box = h("div", { class: "modal-box" });
    function close() {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      document.body.style.overflow = "";
      if (onClose) onClose();
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    var x = h("button", { class: "modal-x", type: "button", "aria-label": "إغلاق", html: "&times;", onclick: close });
    box.appendChild(x);
    content.forEach(function (c) { if (c) box.appendChild(c); });
    box.appendChild(h("button", { class: "btn secondary block", type: "button", text: "إغلاق", onclick: close }));
    overlay.appendChild(box);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    document.body.appendChild(overlay);
    x.focus();
    return { close: close, box: box };
  }

  /* ---------- support ---------- */
  function supportHasOptions() {
    var s = SITE.support || {};
    return !!(s.on && (s.link || s.wallet || s.qrImage));
  }
  function supportButton() {
    if (!supportHasOptions()) return null;
    return h("button", { class: "btn secondary", type: "button", text: "ادعمني", onclick: openSupport });
  }
  function openSupport() {
    var s = SITE.support;
    var opts = h("div", { class: "support-opt" });
    if (s.link) opts.appendChild(h("a", { class: "btn", href: s.link, target: "_blank", rel: "noopener", text: "صفحة الدعم" }));
    if (s.wallet) {
      var btn = h("button", { class: "btn secondary", type: "button", text: "نسخ" });
      btn.addEventListener("click", function () {
        function done() { btn.textContent = "اتنسخ"; setTimeout(function () { btn.textContent = "نسخ"; }, 1500); }
        if (navigator.clipboard) navigator.clipboard.writeText(s.wallet).then(done, function () {});
      });
      opts.appendChild(h("div", { class: "copy-row" }, [h("code", { text: s.wallet }), btn]));
    }
    if (s.qrImage) opts.appendChild(h("img", { src: s.qrImage, alt: "QR للدعم", style: "max-width:200px;margin:0 auto;border-radius:8px" }));
    openModal([
      h("h3", { text: "ادعمني" }),
      h("p", { class: "muted", text: "لو عجبتك الألعاب وعايز تدعمني، ده بيساعدني أكمل وأعمل ألعاب جديدة. ومفيش أي إلزام." }),
      opts
    ]);
  }

  /* ---------- cards ---------- */
  function coverEl(g, big) {
    var c = h("div", { class: "cover" });
    c.style.setProperty("--h", String(g.hue || 190));
    if (g.wallpaper) {
      var img = h("img", { src: g.wallpaper, alt: g.title, loading: "lazy" });
      img.addEventListener("error", function () { img.remove(); });
      c.appendChild(img);
    }
    c.appendChild(h("div", { class: "letter", text: (g.title || "?").charAt(0) }));
    var tags = h("div", { class: "tags" });
    if (g.example) tags.appendChild(h("span", { class: "tag ex", text: "مثال" }));
    var v = latestVer(g);
    if (daysAgo(g.added) <= 14) tags.appendChild(h("span", { class: "tag", text: "جديد" }));
    else if (v && daysAgo(v.date) <= 14) tags.appendChild(h("span", { class: "tag upd", text: "تحديث " + fmtDate(v.date) }));
    c.appendChild(tags);
    return c;
  }
  function gameCard(g) {
    var v = latestVer(g) || {};
    var meta = h("ul", { class: "meta" }, [
      h("li", { text: g.platform }),
      v.version ? h("li", null, ["إصدار ", ltr(v.version)]) : null,
      v.size ? h("li", null, [ltr(v.size)]) : null,
      statEl("li", g.slug, "mg-stat")
    ]);
    return h("article", { class: "card" }, [
      coverEl(g),
      h("div", { class: "body" }, [
        h("h3", { text: g.title }),
        h("p", { class: "desc", text: g.desc }),
        meta,
        h("a", { class: "btn block", href: gameUrl(g), text: "تفاصيل وتحميل" })
      ])
    ]);
  }

  /* ---------- pages ---------- */
  function pageHome() {
    var main = $("main .wrap") || $("main");
    var latest = visible().sort(byNewest)[0];

    main.appendChild(h("img", { class: "hero-img", src: "images/banner.jpg", alt: "Marcelino Games" }));
    main.appendChild(h("section", { class: "hero" }, [
      h("h1", { html: 'Marcelino <span>Games</span>' }),
      h("p", { text: SITE.tagline }),
      h("p", { text: "الألعاب دي من تصميم وتطوير مارسيلينو فهمي، مطوّر ألعاب مستقل. كل لعبة هنا بتتحمل مباشرة وببلاش، وبتتحدث هنا الأول." }),
      h("div", { class: "actions" }, [h("a", { class: "btn", href: "games.html", text: "ألعاب الأندرويد" })])
    ]));

    var about = h("section", { class: "stack" }, [
      h("h2", { text: "مين اللي عمل الألعاب دي؟" }),
      h("p", { class: "muted", text: SITE.about })
    ]);
    var sb = supportButton();
    if (sb) about.appendChild(h("div", { class: "actions" }, [sb]));
    main.appendChild(about);

    main.appendChild(h("section", { class: "stack" }, [
      h("h2", { text: "ليه تحمّل من هنا؟" }),
      h("div", { class: "grid-3" }, [
        h("div", { class: "panel" }, [h("h3", { text: "تحميل مباشر" }), h("p", { class: "muted", text: "من غير حسابات ولا خطوات زيادة. الملف بينزل على موبايلك على طول." })]),
        h("div", { class: "panel" }, [h("h3", { text: "دايمًا آخر إصدار" }), h("p", { class: "muted", text: "كل تحديث بيتنشر هنا الأول، وفي صفحة كل لعبة سجل بالتغييرات." })]),
        h("div", { class: "panel" }, [h("h3", { text: "دعم مباشر" }), h("p", { class: "muted", text: "أي مشكلة تقابلك ابعتلي على واتساب وهرد عليك." })])
      ])
    ]));

    if (latest) {
      main.appendChild(h("section", { class: "stack" }, [
        h("h2", { text: "أحدث لعبة" }),
        h("div", { class: "grid" }, [gameCard(latest)])
      ]));
    }

    /* problems go to the public complaints board */
    main.appendChild(h("div", { class: "panel" }, [
      h("h3", { text: "عندك مشكلة أو اقتراح؟" }),
      h("p", { class: "muted", text: "اكتبها في صفحة الشكاوى. أي حد يقدر يشوفها ويعلّق عليها ويعمل لايك." }),
      h("a", { class: "btn", href: "complaints.html", text: "افتح الشكاوى" })
    ]));
  }

  function pageGames() {
    var main = $("main .wrap") || $("main");
    var state = { q: "", platform: "الكل" };
    var list = visible().sort(byNewest);

    main.appendChild(h("h1", { text: "ألعاب الأندرويد" }));
    if (list[0]) {
      main.appendChild(h("section", { class: "stack" }, [
        h("h2", { text: "أحدث لعبة" }),
        h("div", { class: "grid" }, [gameCard(list[0])])
      ]));
    }

    var search = h("input", { type: "search", placeholder: "ابحث باسم اللعبة", "aria-label": "بحث" });
    var chipsBox = h("div", { class: "chips", role: "group", "aria-label": "المنصة" });
    main.appendChild(h("div", { class: "tools" }, [search, chipsBox]));
    var grid = h("div", { class: "grid" });
    main.appendChild(h("h2", { text: "كل الألعاب" }));
    main.appendChild(grid);

    function chips() {
      var set = ["الكل"];
      list.forEach(function (g) { if (set.indexOf(g.platform) < 0) set.push(g.platform); });
      chipsBox.textContent = "";
      set.forEach(function (p) {
        chipsBox.appendChild(h("button", {
          class: "chip", type: "button", text: p, "aria-pressed": String(state.platform === p),
          onclick: function () { state.platform = p; chips(); draw(); }
        }));
      });
    }
    function draw() {
      var q = state.q.trim().toLowerCase();
      var rows = list.filter(function (g) {
        return (state.platform === "الكل" || g.platform === state.platform) &&
          (!q || g.title.toLowerCase().indexOf(q) >= 0);
      });
      grid.textContent = "";
      if (!rows.length) grid.appendChild(h("p", { class: "empty", text: "مفيش ألعاب مطابقة." }));
      rows.forEach(function (g) { grid.appendChild(gameCard(g)); });
    }
    search.addEventListener("input", function () { state.q = search.value; draw(); });
    chips(); draw();
  }

  function openDownload(g, v) {
    var TOTAL = 10;
    var C = 2 * Math.PI * 70;
    var count = h("div", { class: "count", text: String(TOTAL) });
    var svg = h("div", { class: "ring" });
    svg.innerHTML = '<svg viewBox="0 0 160 160" aria-hidden="true"><circle class="track" cx="80" cy="80" r="70"></circle><circle class="bar" cx="80" cy="80" r="70"></circle></svg>';
    var barEl = svg.querySelector(".bar");
    barEl.style.strokeDasharray = String(C);
    barEl.style.strokeDashoffset = String(C);
    svg.appendChild(count);

    var go = h("button", { class: "btn block", type: "button", text: "حمّل دلوقتي", disabled: "disabled" });
    var label = h("p", { class: "muted", text: "التحميل هيجهز بعد" });
    var after = h("p", { class: "muted" });
    after.innerHTML = '<span class="mg-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    svg.classList.add("mg-ring-spin");
    var sb = supportButton();
    var timer = null;

    var m = openModal([
      h("h3", null, [g.title + " ", ltr(v.version)]),
      label, svg, after, go,
      sb ? h("div", { class: "actions", style: "justify-content:center" }, [sb]) : null
    ], function () { clearInterval(timer); });

    var left = TOTAL;
    requestAnimationFrame(function () { barEl.style.strokeDashoffset = String(C * (1 - (TOTAL - left) / TOTAL)); });
    timer = setInterval(function () {
      left -= 1;
      count.textContent = String(left);
      count.classList.remove("mg-count-pop"); void count.offsetWidth; count.classList.add("mg-count-pop");
      barEl.style.strokeDashoffset = String(C * (1 - (TOTAL - left) / TOTAL));
      if (left <= 0) {
        clearInterval(timer);
        label.textContent = "جاهز";
        after.textContent = "";
        svg.classList.remove("mg-ring-spin");
        go.classList.add("mg-ready-pop");
        go.removeAttribute("disabled");
      }
    }, 1000);

    go.addEventListener("click", function () {
      if (go.hasAttribute("disabled")) return;
      if (!v.url) { go.textContent = "رابط التحميل لسه مش متضاف"; return; }
      if (window.MG_PUSH) window.MG_PUSH.downloaded(g.slug);
      countDownload(g, v);
      var a = h("a", { href: v.url, rel: "noopener", download: "" });
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  function pageGame() {
    var main = $("main .wrap") || $("main");
    var slug = new URLSearchParams(location.search).get("g");
    var g = GAMES.filter(function (x) { return x.slug === slug && !x.hidden; })[0];
    if (!g) {
      main.appendChild(h("p", { class: "empty", text: "اللعبة دي مش موجودة." }));
      main.appendChild(h("a", { class: "btn", href: "games.html", text: "رجوع للألعاب" }));
      return;
    }
    document.title = g.title + " | Marcelino Games";
    var v = latestVer(g) || {};

    var banner = coverEl(g);
    banner.classList.add("banner-img");
    main.appendChild(h("div", { class: "game-head" }, [banner, h("h1", { text: g.title })]));

    /* left column */
    var left = h("div", { class: "stack" }, [h("p", { text: g.desc })]);
    if (g.screenshots && g.screenshots.length) {
      var shots = h("div", { class: "shots" });
      g.screenshots.forEach(function (s) { shots.appendChild(h("img", { src: s, alt: "لقطة من " + g.title, loading: "lazy" })); });
      left.appendChild(h("h2", { text: "لقطات من اللعبة" }));
      left.appendChild(shots);
    }
    left.appendChild(h("h2", { text: "مواصفات التشغيل" }));
    left.appendChild(h("div", { class: "table-scroll" }, [h("table", null, [
      h("tr", null, [h("th", { text: "إصدار الأندرويد" }), h("td", null, [ltr(g.minAndroid || "-"), " أو أحدث"])]),
      h("tr", null, [h("th", { text: "الرام المناسب" }), h("td", null, [ltr(g.ram || "-")])]),
      h("tr", null, [h("th", { text: "حجم الملف" }), h("td", null, [ltr(v.size || "-")])])
    ])]));

    left.appendChild(h("h2", { text: "سجل التحديثات" }));
    var rows = (g.versions || []).map(function (ver, i) {
      return h("tr", null, [
        h("td", null, [ltr(ver.version), i === 0 ? " (الحالي)" : ""]),
        h("td", { text: fmtDate(ver.date) }),
        h("td", { text: ver.changelog || "" }),
        h("td", null, [h("button", { class: "btn secondary", type: "button", text: "تحميل", onclick: function () { openDownload(g, ver); } })])
      ]);
    });
    left.appendChild(h("div", { class: "table-scroll" }, [h("table", null, [
      h("tr", null, [h("th", { text: "الإصدار" }), h("th", { text: "التاريخ" }), h("th", { text: "إيه اللي اتغير" }), h("th")])
    ].concat(rows))]));
    left.appendChild(h("details", null, [
      h("summary", { text: "إزاي أثبت اللعبة؟" }),
      h("ol", null, [
        h("li", { text: "حمّل الملف من زرار التحميل." }),
        h("li", { text: "افتح الملف من إشعارات التحميل أو من فولدر Downloads." }),
        h("li", { text: "لو الموبايل طلب، فعّل \"التثبيت من مصادر غير معروفة\" للمتصفح اللي نزّلت منه." }),
        h("li", { text: "اضغط تثبيت، وبعدها افتح اللعبة." })
      ])
    ]));

    /* right column */
    var right = h("div", { class: "stack" });
    var card = h("div", { class: "panel" }, [
      h("h3", { text: "آخر إصدار" }),
      h("p", { class: "num" }, [ltr(v.version || "-")]),
      h("p", { class: "muted" }, [v.date ? fmtDate(v.date) : "", v.size ? " · " : "", v.size ? ltr(v.size) : null]),
      v.changelog ? h("p", { text: v.changelog }) : null,
      statEl("p", g.slug, "mg-stat-big"),
      ratingWidget(g),
      h("button", { class: "btn block", type: "button", text: "تحميل", onclick: function () { openDownload(g, v); } })
    ]);
    var sb = supportButton();
    if (sb) { sb.classList.add("block"); card.appendChild(sb); }
    card.appendChild(h("p", { class: "note", text: "ممكن الموبايل يظهر تحذير عادي لأي ملف APK جاي من برّه المتجر. ده متوقع للملفات اللي مش على Google Play." }));
    right.appendChild(card);

    var share = h("button", { class: "btn secondary block", type: "button", text: "نسخ رابط اللعبة" });
    share.addEventListener("click", function () {
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () {
        share.textContent = "اتنسخ";
        setTimeout(function () { share.textContent = "نسخ رابط اللعبة"; }, 1500);
      }, function () {});
    });
    var qrBox = h("div", { class: "qr", hidden: "hidden" });
    var qrBtn = h("button", { class: "btn secondary block", type: "button", text: "عرض QR للصفحة" });
    qrBtn.addEventListener("click", function () {
      qrBox.hidden = !qrBox.hidden;
      if (!qrBox.hidden && !qrBox.firstChild && window.QRCode) new window.QRCode(qrBox, { text: location.href, width: 160, height: 160 });
    });
    right.appendChild(h("div", { class: "panel" }, [share, qrBtn, qrBox]));

    main.appendChild(h("div", { class: "game-grid" }, [left, right]));
  }

  function pageSettings() {
    var main = $("main .wrap") || $("main");
    main.appendChild(h("h1", { text: "الإعدادات" }));
    main.appendChild(h("section", { class: "panel" }, [
      h("h3", { text: "لوحة التحكم" }),
      h("p", { class: "muted", text: "سجّل دخول بحساب جوجل بتاعك. لو الحساب هو صاحب الموقع هتقدر تضيف وتعدّل وتحذف الألعاب وتغيّر الصور، ولو مش هو هيتم رفض الدخول." }),
      h("div", { class: "actions" }, [h("a", { class: "btn", href: "admin.html", text: "لوحة التحكم" })])
    ]));
    if (window.MG_PUSH) main.appendChild(window.MG_PUSH.settingsPanel(window.MG));
  }

  /* ---------- data: Firestore when configured, else data/games.json ---------- */
  function load(url) { return fetch(url, { cache: "no-cache" }).then(function (r) { return r.json(); }); }
  function fbReady() { var c = window.FIREBASE_CONFIG; return !!(c && c.apiKey && c.apiKey.indexOf("PUT_") !== 0); }
  var scriptCache = {};
  function loadScript(src) {
    if (scriptCache[src]) return scriptCache[src];
    scriptCache[src] = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = res;
      s.onerror = function () { delete scriptCache[src]; rej(new Error("load " + src)); };
      document.head.appendChild(s);
    });
    return scriptCache[src];
  }
  function loadFirebase(parts) {
    var base = "https://www.gstatic.com/firebasejs/10.12.2/firebase-";
    var seq = Promise.resolve();
    ["app"].concat(parts).forEach(function (p) { seq = seq.then(function () { return loadScript(base + p + "-compat.js"); }); });
    return seq.then(function () {
      if (!window.firebase.apps.length) window.firebase.initializeApp(window.FIREBASE_CONFIG);
      return window.firebase;
    });
  }
  function withTimeout(p, ms) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { rej(new Error("timeout")); }, ms);
      p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }
  /* Firestore only. Rejects when Firebase isn't configured or doesn't answer in time. */
  function remoteGames() {
    if (!fbReady()) return Promise.reject(new Error("no firebase"));
    var remote = loadFirebase(["firestore"]).then(function (fb) {
      return fb.firestore().collection("games").where("hidden", "==", false).get();
    }).then(function (snap) {
      return snap.docs.map(function (d) { var o = d.data(); o.slug = d.id; return o; });
    });
    return withTimeout(remote, 8000);
  }
  window.MG = { h: h, $: $, ltr: ltr, fmtDate: fmtDate, fbReady: fbReady, loadFirebase: loadFirebase, openModal: openModal };

  /* ---------- download counter + ratings (Firestore "stats/<game>": downloads, ratingSum, ratingCount) ---------- */
  var STATS = {}, STATS_KEY = "mg-stats-v1";
  try { STATS = JSON.parse(localStorage.getItem(STATS_KEY)) || {}; } catch (e) { STATS = {}; }
  function saveStats() { try { localStorage.setItem(STATS_KEY, JSON.stringify(STATS)); } catch (e) {} }
  function shortNum(n) { n = +n || 0; return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "") + "K" : String(n); }
  function statText(slug, big) {
    var s = STATS[slug] || {}, n = +s.downloads || 0, c = +s.ratingCount || 0;
    var txt = "⬇ " + shortNum(n);
    // total stars = whole stars saved by the first version (ratingSum) + half-star units (halfSum / 2)
    if (c > 0) txt += "  ★ " + (((+s.ratingSum || 0) + (+s.halfSum || 0) / 2) / c).toFixed(1) + (big ? " (" + c + " تقييم)" : "");
    return txt;
  }
  function fillStat(el) {
    var slug = el.getAttribute("data-stat"), big = el.className.indexOf("big") >= 0;
    if (!STATS[slug] && !big) { el.hidden = true; return; }
    el.hidden = false; el.textContent = statText(slug, big);
  }
  function statEl(tag, slug, cls) { var e = h(tag, { class: cls, "data-stat": slug }); fillStat(e); return e; }
  function refreshStats() { Array.prototype.forEach.call(document.querySelectorAll("[data-stat]"), fillStat); }
  function statsDb() { return loadFirebase(["firestore"]).then(function (fb) { return fb; }); }
  function fetchStats() {
    if (!fbReady() || page === "admin") return;
    withTimeout(statsDb().then(function (fb) { return fb.firestore().collection("stats").get(); }), 8000).then(function (snap) {
      var m = {}; snap.forEach(function (d) { m[d.id] = d.data(); });
      STATS = m; saveStats(); refreshStats();
    }).catch(function () {});
  }
  function bumpStat(slug, kind, r, old) {
    if (!fbReady()) return;
    var hv = Math.round((r || 0) * 2), oh = Math.round((old || 0) * 2);       // ratings are kept in half-star units
    statsDb().then(function (fb) {
      var fv = fb.firestore.FieldValue, ref = fb.firestore().collection("stats").doc(slug), up = {}, init = { downloads: 0, ratingSum: 0, ratingCount: 0, halfSum: 0 };
      if (kind === "dl") { up.downloads = fv.increment(1); init.downloads = 1; }
      else if (old) { up.halfSum = fv.increment(hv - oh); init.halfSum = hv; init.ratingCount = 1; }   // the visitor changed their stars
      else { up.halfSum = fv.increment(hv); up.ratingCount = fv.increment(1); init.halfSum = hv; init.ratingCount = 1; }
      return ref.update(up).catch(function (e) {
        if (e && (e.code === "not-found" || e.code === "permission-denied")) return ref.set(init);   // first count for this game
        throw e;
      });
    }).then(function () {
      var s = STATS[slug] || { downloads: 0, ratingSum: 0, ratingCount: 0, halfSum: 0 };
      if (kind === "dl") s.downloads = (+s.downloads || 0) + 1;
      else if (old) s.halfSum = (+s.halfSum || 0) + hv - oh;
      else { s.halfSum = (+s.halfSum || 0) + hv; s.ratingCount = (+s.ratingCount || 0) + 1; }
      STATS[slug] = s; saveStats(); refreshStats();
    }).catch(function () {});
  }
  /* one count per device per version, so repeated clicks don't inflate the number */
  function countDownload(g, v) {
    var key = "mg-dl-" + g.slug + "-" + (v.version || "");
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch (e) {}
    bumpStat(g.slug, "dl");
  }
  function ratingWidget(g) {
    var key = "mg-rated-" + g.slug, mine = 0;
    try { mine = parseFloat(localStorage.getItem(key)) || 0; } catch (e) {}
    function fmt(v) { return (v % 1 ? v.toFixed(1) : String(v)); }
    var label = h("p", { class: "muted", text: mine ? "تقييمك " + fmt(mine) + " من 5. دوس على أي نص نجمة لو عايز تغيّره" : "قيّم اللعبة (ممكن نص نجمة)" });
    var fills = [];
    function paintStars(v) { fills.forEach(function (f, i) { f.style.width = (Math.max(0, Math.min(1, v - i)) * 100) + "%"; }); }
    var row = h("div", { class: "stars", dir: "ltr" });
    function pick(v) {
      if (mine === v) return;
      var old = mine;
      mine = v; try { localStorage.setItem(key, String(v)); } catch (e) {}
      paintStars(v); label.textContent = (old ? "اتغيّر تقييمك لـ " : "شكرًا! تقييمك ") + fmt(v) + " من 5";
      bumpStat(g.slug, "rate", v, old);
    }
    for (var i = 1; i <= 5; i++) (function (n) {
      var fill = h("span", { class: "fill", text: "★" });
      fills.push(fill);
      var half = n - .5;
      var lb = h("button", { type: "button", class: "half l", "aria-label": fmt(half) + " من 5", onclick: function () { pick(half); }, onmouseenter: function () { paintStars(half); } });
      var rb = h("button", { type: "button", class: "half r", "aria-label": n + " من 5", onclick: function () { pick(n); }, onmouseenter: function () { paintStars(n); } });
      row.appendChild(h("span", { class: "star" }, [h("span", { class: "base", text: "★" }), fill, lb, rb]));
    })(i);
    row.addEventListener("mouseleave", function () { paintStars(mine); });
    paintStars(mine);
    return h("div", { class: "rate" }, [label, row]);
  }

  /* ---------- public complaints board (Firestore: complaints/<id> and complaints/<id>/comments/<id>) ---------- */
  function complaintsDb() { return loadFirebase(["firestore"]).then(function (fb) { return { fb: fb, db: fb.firestore() }; }); }
  function fmtWhen(ts) {
    try { var d = ts && ts.toDate ? ts.toDate() : new Date(); return d.toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; }
  }
  function getLS(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function setLS(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function cooldownLeft(key, secs) { var t = +getLS(key) || 0; return Math.max(0, Math.ceil((t + secs * 1000 - Date.now()) / 1000)); }

  function pageComplaints() {
    var main = $("main .wrap") || $("main");
    main.appendChild(h("h1", { text: "الشكاوى والمشاكل" }));
    main.appendChild(h("p", { class: "muted", text: "اكتب مشكلتك أو اقتراحك. الشكوى بتظهر هنا لكل الناس، وأي حد يقدر يعلّق عليها ويعمل لايك أو ديسلايك." }));
    if (!fbReady()) { main.appendChild(h("p", { class: "empty", text: "الشكاوى مش متاحة دلوقتي." })); return; }

    var nameIn = h("input", { type: "text", maxlength: "40", placeholder: "اسمك (اختياري)", autocomplete: "nickname" });
    nameIn.value = getLS("mg-name");
    var gameSel = h("select", null, [h("option", { value: "", text: "عامة (مش لعبة معينة)" })]);
    visible().forEach(function (g) { gameSel.appendChild(h("option", { value: g.title, text: g.title })); });
    var textIn = h("textarea", { rows: "4", maxlength: "1000", placeholder: "اكتب شكواك أو مشكلتك هنا" });
    var trap = h("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off", "aria-hidden": "true", style: "position:absolute;opacity:0;width:0;height:0;padding:0;border:0;pointer-events:none" });
    var status = h("p", { class: "note", hidden: "hidden", role: "status" });
    var send = h("button", { class: "btn", type: "submit", text: "انشر الشكوى" });
    var form = h("form", { class: "panel" }, [
      h("h3", { text: "شكوى جديدة" }),
      h("div", { class: "field" }, [h("label", { text: "الاسم" }), nameIn]),
      h("div", { class: "field" }, [h("label", { text: "اللعبة" }), gameSel]),
      h("div", { class: "field" }, [h("label", { text: "الشكوى" }), textIn]),
      trap, send, status
    ]);
    function say(t) { status.hidden = false; status.textContent = t; }
    main.appendChild(form);
    var list = h("div", { class: "stack" });
    main.appendChild(h("h2", { text: "آخر الشكاوى" }));
    main.appendChild(list);
    var info = h("p", { class: "muted" }); info.innerHTML = '<span class="mg-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    list.appendChild(info);

    function card(c) {
      var ref = null, db = null, FV = null;
      function init() { return complaintsDb().then(function (x) { db = x.db; FV = x.fb.firestore.FieldValue; ref = db.collection("complaints").doc(c.id); }); }
      var upBtn = h("button", { class: "react", type: "button" }), downBtn = h("button", { class: "react", type: "button" });
      var comBtn = h("button", { class: "react", type: "button" });
      function paint() {
        var cur = getLS("mg-react-" + c.id);
        upBtn.textContent = "👍 " + (c.likes || 0); downBtn.textContent = "👎 " + (c.dislikes || 0); comBtn.textContent = "💬 " + (c.comments || 0);
        upBtn.classList.toggle("on", cur === "up"); downBtn.classList.toggle("on", cur === "down");
      }
      function react(kind) {
        var key = "mg-react-" + c.id, cur = getLS(key), dl = 0, dd = 0, next = kind;
        if (cur === kind) { if (kind === "up") dl = -1; else dd = -1; next = ""; }
        else { if (kind === "up") dl = 1; else dd = 1; if (cur === "up") dl = -1; if (cur === "down") dd = -1; }
        var prev = { l: c.likes || 0, d: c.dislikes || 0 };
        c.likes = prev.l + dl; c.dislikes = prev.d + dd; setLS(key, next); paint();
        init().then(function () {
          var up = {}; if (dl) up.likes = FV.increment(dl); if (dd) up.dislikes = FV.increment(dd);
          return ref.update(up);
        }).catch(function () { c.likes = prev.l; c.dislikes = prev.d; setLS(key, cur); paint(); });
      }
      upBtn.addEventListener("click", function () { react("up"); });
      downBtn.addEventListener("click", function () { react("down"); });

      var cbox = h("div", { class: "comments", hidden: "hidden" }), loaded = false;
      function addComment(cm) {
        cbox.insertBefore(h("div", { class: "comment" }, [
          h("strong", { text: cm.name }), h("span", { class: "muted", text: " · " + fmtWhen(cm.created) }), h("p", { text: cm.text })
        ]), cbox.querySelector("form"));
      }
      function openComments() {
        cbox.hidden = !cbox.hidden;
        if (cbox.hidden || loaded) return;
        loaded = true;
        var nm = h("input", { type: "text", maxlength: "40", placeholder: "اسمك (اختياري)" }); nm.value = getLS("mg-name");
        var tx = h("textarea", { rows: "2", maxlength: "500", placeholder: "اكتب تعليق" });
        var st = h("p", { class: "note", hidden: "hidden" });
        var cf = h("form", { class: "comment-form" }, [nm, tx, h("button", { class: "btn secondary", type: "submit", text: "تعليق" }), st]);
        cf.addEventListener("submit", function (e) {
          e.preventDefault();
          var text = tx.value.trim(); if (!text) return;
          var wait = cooldownLeft("mg-last-comment", 10);
          if (wait) { st.hidden = false; st.textContent = "استنى " + wait + " ثواني."; return; }
          var name = nm.value.trim() || "زائر"; setLS("mg-name", nm.value.trim());
          setLS("mg-last-comment", String(Date.now()));
          init().then(function () {
            var b = db.batch(), cref = ref.collection("comments").doc();
            b.set(cref, { name: name, text: text, created: FV.serverTimestamp() });
            b.update(ref, { comments: FV.increment(1) });
            return b.commit();
          }).then(function () {
            addComment({ name: name, text: text, created: null }); tx.value = ""; c.comments = (c.comments || 0) + 1; paint(); st.hidden = true;
          }).catch(function () { st.hidden = false; st.textContent = "ماتبعتش. جرّب تاني."; });
        });
        cbox.appendChild(cf);
        init().then(function () { return ref.collection("comments").orderBy("created", "asc").limit(100).get(); }).then(function (snap) {
          snap.docs.forEach(function (d) { addComment(d.data()); });
        }).catch(function () { cbox.insertBefore(h("p", { class: "muted", text: "ماقدرتش أحمّل التعليقات." }), cf); });
      }
      comBtn.addEventListener("click", openComments);
      paint();
      return h("article", { class: "panel complaint" }, [
        h("div", { class: "c-head" }, [h("strong", { text: c.name }), c.game ? h("span", { class: "c-game", text: c.game }) : null, h("span", { class: "muted", text: fmtWhen(c.created) })]),
        h("p", { class: "c-text", text: c.text }),
        h("div", { class: "actions" }, [upBtn, downBtn, comBtn]),
        cbox
      ]);
    }

    function draw(items) {
      list.textContent = "";
      if (!items.length) list.appendChild(h("p", { class: "empty", text: "مفيش شكاوى لسه." }));
      items.forEach(function (c) { list.appendChild(card(c)); });
    }
    var items = [];
    complaintsDb().then(function (x) { return withTimeout(x.db.collection("complaints").orderBy("created", "desc").limit(40).get(), 10000); })
      .then(function (snap) { items = snap.docs.map(function (d) { var o = d.data(); o.id = d.id; return o; }); draw(items); })
      .catch(function () { list.textContent = ""; list.appendChild(h("p", { class: "empty", text: "ماقدرتش أحمّل الشكاوى. جرّب تحدّث الصفحة." })); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (trap.value) return;
      var text = textIn.value.trim();
      if (text.length < 3) { say("اكتب الشكوى (3 حروف على الأقل)."); return; }
      var wait = cooldownLeft("mg-last-post", 30);
      if (wait) { say("استنى " + wait + " ثانية قبل ما تنشر شكوى تانية."); return; }
      var name = nameIn.value.trim() || "زائر"; setLS("mg-name", nameIn.value.trim());
      send.disabled = true; say("بنشر...");
      complaintsDb().then(function (x) {
        return x.db.collection("complaints").add({ name: name, text: text, game: gameSel.value || "", created: x.fb.firestore.FieldValue.serverTimestamp(), likes: 0, dislikes: 0, comments: 0 });
      }).then(function (ref) {
        setLS("mg-last-post", String(Date.now()));
        items.unshift({ id: ref.id, name: name, text: text, game: gameSel.value || "", created: null, likes: 0, dislikes: 0, comments: 0 });
        draw(items); textIn.value = ""; say("اتنشرت. شكرًا.");
      }).catch(function () { say("ماتنشرتش. جرّب تاني."); }).then(function () { send.disabled = false; });
    });
  }

  /* ---------- boot ---------- */
  /* The page paints at once, never waits for Firebase:
     1) from the copy saved on this device at the last visit (no network, instant), or
        from the static data/*.json files on the very first visit;
     2) then Firestore is asked in the background, and the page is redrawn
        only if its data differs from what is already on screen. */
  var page = document.body.getAttribute("data-page");
  var CACHE_KEY = "mg-data-v1";
  var shown = null;

  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY));
      return c && c.site && Array.isArray(c.games) ? c : null;
    } catch (e) { return null; }
  }
  function writeCache(site, games) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ site: site, games: games })); } catch (e) {}
  }
  /* a game page opened for a game this data doesn't know yet must wait for fresh data */
  function canPaintEarly(games) {
    if (page !== "game") return true;
    var slug = new URLSearchParams(location.search).get("g");
    return games.some(function (x) { return x.slug === slug && !x.hidden; });
  }
  function clearPage() {
    Array.prototype.forEach.call(document.querySelectorAll(".banner, .site-header, .site-footer, .wa-float"), function (n) { n.remove(); });
    var w = $("main .wrap") || $("main");
    if (w) w.textContent = "";
  }
  function paint(site, games) {
    var key = JSON.stringify([site, games]);
    if (key === shown) return;
    var repaint = shown !== null;
    shown = key; SITE = site; GAMES = games;
    if (repaint) {
      if (page === "admin") return;
      clearPage();
    }
    var y = window.pageYOffset;
    renderChrome(page);
    if (page === "home") pageHome();
    else if (page === "games") pageGames();
    else if (page === "game") pageGame();
    else if (page === "settings") pageSettings();
    else if (page === "complaints") pageComplaints();
    else if (page === "admin" && window.MG_ADMIN) window.MG_ADMIN(window.MG);
    if (repaint && y) window.scrollTo(0, y);
    if (window.MG_PUSH && page !== "admin") window.MG_PUSH.init(window.MG);
  }
  function start() {
    var cached = readCache();
    if (cached && canPaintEarly(cached.games)) paint(cached.site, cached.games);
    Promise.all([load("data/site.json"), load("data/games.json")]).then(function (st) {
      if (!cached && canPaintEarly(st[1])) paint(st[0], st[1]);
      return remoteGames().then(function (games) { return [st[0], games]; }, function () { return st; });
    }).then(function (res) {
      paint(res[0], res[1]);
      writeCache(res[0], res[1]);
      fetchStats();
    }).catch(function () {
      if (shown === null) document.body.appendChild(h("p", { class: "empty", text: "حصلت مشكلة في تحميل الصفحة. جرّب تحدّث." }));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
