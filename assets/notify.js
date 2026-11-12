/* App install + push notifications. Loaded before app.js; app.js calls MG_PUSH.init() once the page is drawn. */
(function () {
  "use strict";
  var deferredInstall = null;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function lsJSON(k, d) { try { var v = JSON.parse(lsGet(k)); return v == null ? d : v; } catch (e) { return d; } }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredInstall = e;
    window.dispatchEvent(new Event("mg-install-ready"));
  });
  window.addEventListener("appinstalled", function () {
    deferredInstall = null;
    lsSet("mg_installed", "1");
    var bar = document.getElementById("install-bar");
    if (bar) bar.remove();
  });

  function standalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
  function pushSupported() { return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window; }
  function vapidSet() { var v = window.VAPID_KEY; return !!(v && String(v).indexOf("PUT_") !== 0); }
  function pushReady(MG) { return pushSupported() && vapidSet() && MG.fbReady(); }
  function saved() { return lsJSON("mg_push", null); }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.register("firebase-messaging-sw.js").catch(function () { return null; });
  }

  /* ---------- subscribe / unsubscribe ---------- */
  function within(p, ms, code) {
    return new Promise(function (res, rej) {
      var t = setTimeout(function () { var e = new Error(code); e.code = code; rej(e); }, ms);
      p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
    });
  }
  function enable(MG, mode, onStep) {
    function say(t) { if (onStep) onStep(t); }
    say("1/4 طلب الإذن...");
    return Notification.requestPermission().then(function (perm) {
      if (perm !== "granted") throw new Error("denied");
      say("2/4 تحميل خدمة الإشعارات...");
      return within(Promise.all([MG.loadFirebase(["firestore", "messaging"]), registerSW()]), 20000, "timeout-load");
    }).then(function (r) {
      var fb = r[0], reg = r[1];
      if (!reg) throw new Error("no-sw");
      say("3/4 تسجيل الجهاز...");
      return within(navigator.serviceWorker.ready, 15000, "timeout-sw").then(function () {
        return within(fb.messaging().getToken({ vapidKey: window.VAPID_KEY, serviceWorkerRegistration: reg }), 20000, "timeout-token");
      }).then(function (token) {
        if (!token) throw new Error("no-token");
        say("4/4 حفظ اختيارك...");
        var doc = { mode: mode, games: lsJSON("mg_downloaded", []).slice(0, 50), updated: fb.firestore.FieldValue.serverTimestamp() };
        return within(fb.firestore().collection("subscribers").doc(token).set(doc), 20000, "timeout-save").then(function () {
          lsSet("mg_push", JSON.stringify({ mode: mode, token: token }));
          return token;
        });
      });
    });
  }
  function disable(MG) {
    var s = saved();
    lsDel("mg_push");
    if (!s || !s.token) return Promise.resolve();
    return MG.loadFirebase(["firestore"]).then(function (fb) {
      return fb.firestore().collection("subscribers").doc(s.token).delete();
    }).catch(function () {});
  }
  function downloaded(slug) {
    var arr = lsJSON("mg_downloaded", []);
    if (arr.indexOf(slug) < 0) { arr.push(slug); lsSet("mg_downloaded", JSON.stringify(arr)); }
    var s = saved();
    if (s && s.token && window.MG && window.MG.fbReady()) {
      window.MG.loadFirebase(["firestore"]).then(function (fb) {
        return fb.firestore().collection("subscribers").doc(s.token).update({
          games: arr.slice(0, 50), updated: fb.firestore.FieldValue.serverTimestamp()
        });
      }).catch(function () {});
    }
  }
  function errText(e) {
    var m = (e && (e.code || e.message)) || "unknown";
    var why = {
      "denied": "الإشعارات مقفولة للموقع. فعّلها من إعدادات المتصفح (أيقونة القفل جنب الرابط) وجرّب تاني.",
      "no-sw": "الجهاز ده مش بيدعم الإشعارات من المتصفح.",
      "no-token": "ماقدرتش أجيب مفتاح الجهاز للإشعارات.",
      "permission-denied": "قواعد Firestore مش بتسمح بالتسجيل. الصق firestore.rules الجديد في Firebase ثم Firestore ثم Rules ثم Publish.",
      "messaging/token-subscribe-failed": "Firebase رفض تسجيل الجهاز. اتأكد إن Firebase Cloud Messaging API متفعّل للمشروع، وإن مفتاح Web Push مظبوط.",
      "timeout-load": "تحميل مكتبة Firebase اتأخر. اتأكد من الإنترنت أو من مانع الإعلانات وجرّب تاني.",
      "timeout-sw": "خدمة الإشعارات ما اشتغلتش. اقفل الموقع وافتحه تاني وجرّب.",
      "timeout-token": "Firebase ما ردش على تسجيل الجهاز. غالبًا Firebase Cloud Messaging API مش متفعّل للمشروع أو مفتاح الـ API متقيّد.",
      "timeout-save": "حفظ اختيارك اتأخر. اتأكد إن قواعد Firestore اتنشرت وإن قاعدة البيانات شغالة.",
      "messaging/permission-blocked": "الإشعارات مقفولة للموقع من إعدادات المتصفح.",
      "messaging/unsupported-browser": "المتصفح ده مش بيدعم الإشعارات.",
      "messaging/failed-service-worker-registration": "ماقدرتش أشغّل خدمة الإشعارات. حدّث الصفحة بقوة وجرّب تاني.",
      "installations/request-failed": "Firebase Installations API مش متفعّل أو مفتاح الـ API متقيّد. شوف Google Cloud Console ثم APIs."
    }[m] || "ماتفعّلتش الإشعارات. جرّب تاني بعد شوية.";
    return why + " (" + m + ")";
  }

  /* ---------- install ---------- */
  function install() {
    if (!deferredInstall) return Promise.resolve(false);
    deferredInstall.prompt();
    return deferredInstall.userChoice.then(function (c) { deferredInstall = null; return c.outcome === "accepted"; });
  }

  function installBar(MG) {
    if (standalone() || lsGet("mg_installed") || lsGet("mg_install_dismissed")) return;
    function show() {
      if (!deferredInstall || document.getElementById("install-bar")) return;
      var h = MG.h;
      var bar = h("div", { id: "install-bar", class: "install-bar", role: "region", "aria-label": "تثبيت التطبيق" }, [
        h("img", { src: "images/icon-192.png", alt: "", width: "40", height: "40", style: "border-radius:10px" }),
        h("span", { text: "ثبّت Marcelino Games كتطبيق على موبايلك" }),
        h("button", { class: "btn", type: "button", text: "تثبيت", onclick: function () { install().then(function () { bar.remove(); }); } }),
        h("button", { class: "install-x", type: "button", "aria-label": "إغلاق", html: "&times;", onclick: function () { lsSet("mg_install_dismissed", "1"); bar.remove(); } })
      ]);
      document.body.appendChild(bar);
    }
    if (deferredInstall) show();
    window.addEventListener("mg-install-ready", show);
  }

  /* ---------- first-visit notification question ---------- */
  function promptNotifications(MG) {
    if (!pushReady(MG) || saved() || Notification.permission === "denied") return;
    var snooze = Number(lsGet("mg_push_snooze") || 0);
    if (snooze && Date.now() < snooze) return;
    var h = MG.h;
    var status = h("p", { class: "note", hidden: "hidden", role: "status" });
    var chosen = false;
    function choose(mode) {
      status.hidden = false; status.textContent = "ثواني...";
      enable(MG, mode, function (t) { status.textContent = t; }).then(function () {
        chosen = true;
        status.textContent = mode === "all" ? "تمام، هتوصلك إشعارات بتحديثات كل الألعاب." : "تمام، هتوصلك إشعارات بتحديثات الألعاب اللي نزّلتها.";
        setTimeout(function () { if (modal) modal.close(); }, 1800);
      }, function (e) { status.textContent = errText(e); });
    }
    var modal = MG.openModal([
      h("h3", { text: "فعّل الإشعارات" }),
      h("p", { class: "muted", text: "عشان توصلك تحديثات الألعاب أول بأول. اختار اللي يناسبك وتقدر تغيّره بعدين من الإعدادات." }),
      h("button", { class: "btn block", type: "button", text: "كل الألعاب", onclick: function () { choose("all"); } }),
      h("button", { class: "btn secondary block", type: "button", text: "الألعاب اللي نزّلتها بس", onclick: function () { choose("mine"); } }),
      status
    ], function () {
      if (!chosen) lsSet("mg_push_snooze", String(Date.now() + 7 * 86400000));
    });
  }

  /* ---------- settings page panel ---------- */
  function settingsPanel(MG) {
    var h = MG.h;
    var panel = h("section", { class: "panel" });
    var body = h("div", { class: "stack" });
    panel.appendChild(h("h3", { text: "التطبيق والإشعارات" }));
    panel.appendChild(body);

    function draw() {
      body.textContent = "";
      var msg = h("p", { class: "note", hidden: "hidden", role: "status" });

      /* install */
      var inst = h("div", { class: "stack" }, [h("p", { class: "muted", text: "ثبّت الموقع كتطبيق: أيقونة على الشاشة الرئيسية وبيفتح من غير شريط المتصفح." })]);
      if (standalone()) inst.appendChild(h("p", { text: "التطبيق متثبّت ومفتوح دلوقتي." }));
      else if (deferredInstall) inst.appendChild(h("button", { class: "btn", type: "button", text: "تثبيت التطبيق", onclick: function () { install().then(draw); } }));
      else if (isIOS()) inst.appendChild(h("p", { class: "note", text: "على آيفون: اضغط زرار المشاركة في سفاري، ثم \"إضافة إلى الشاشة الرئيسية\"." }));
      else inst.appendChild(h("p", { class: "note", text: "لو التثبيت مش ظاهر، افتح قايمة المتصفح (النقط التلاتة) واختار \"تثبيت التطبيق\" أو \"إضافة إلى الشاشة الرئيسية\"." }));
      body.appendChild(inst);

      /* notifications */
      var n = h("div", { class: "stack" }, [h("h3", { text: "الإشعارات" })]);
      if (!pushSupported()) {
        n.appendChild(h("p", { class: "note", text: isIOS() && !standalone()
          ? "على آيفون الإشعارات بتشتغل بعد ما تضيف الموقع للشاشة الرئيسية وتفتحه منها."
          : "المتصفح ده مش بيدعم الإشعارات." }));
      } else if (!pushReady(MG)) {
        n.appendChild(h("p", { class: "note", text: "الإشعارات لسه مش متفعّلة من صاحب الموقع." }));
      } else {
        var s = saved();
        var label = !s ? "مقفولة" : s.mode === "all" ? "شغالة لكل الألعاب" : "شغالة للألعاب اللي نزّلتها";
        n.appendChild(h("p", { text: "الحالة: " + label }));
        function pick(mode) {
          return function () {
            msg.hidden = false; msg.textContent = "ثواني...";
            enable(MG, mode, function (t) { msg.textContent = t; }).then(draw, function (e) { msg.textContent = errText(e); });
          };
        }
        n.appendChild(h("div", { class: "actions" }, [
          h("button", { class: "btn" + (s && s.mode === "all" ? "" : " secondary"), type: "button", text: "كل الألعاب", onclick: pick("all") }),
          h("button", { class: "btn" + (s && s.mode === "mine" ? "" : " secondary"), type: "button", text: "الألعاب اللي نزّلتها", onclick: pick("mine") }),
          s ? h("button", { class: "btn secondary", type: "button", text: "إيقاف", onclick: function () { disable(MG).then(draw); } }) : null
        ]));
        n.appendChild(msg);
      }
      body.appendChild(n);
    }
    draw();
    window.addEventListener("mg-install-ready", draw);
    return panel;
  }

  var started = false;
  window.MG_PUSH = {
    init: function (MG) {
      if (started) return; started = true;
      registerSW();
      installBar(MG);
      setTimeout(function () { promptNotifications(MG); }, 4000);
    },
    settingsPanel: settingsPanel,
    downloaded: downloaded
  };
})();
