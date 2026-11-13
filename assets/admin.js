/* Owner dashboard: Google sign-in, add / edit / hide / delete games, upload images (stored resized in Firestore). */
window.MG_ADMIN = function (MG) {
  "use strict";
  var h = MG.h, $ = MG.$;
  var OWNER = String(window.OWNER_EMAIL || "").toLowerCase();
  var root = $("main .wrap");
  var box = h("div", { class: "stack" });
  root.appendChild(h("h1", { text: "لوحة التحكم" }));
  root.appendChild(box);

  if (!MG.fbReady()) {
    box.appendChild(h("div", { class: "panel" }, [
      h("h3", { text: "لسه مش متربطة" }),
      h("p", { class: "muted", text: "لوحة التحكم محتاجة مشروع Firebase. حط بياناته في ملف data/firebase-config.js وبعدها هيشتغل تسجيل الدخول بجوجل." })
    ]));
    return;
  }

  function today() { return new Date().toISOString().slice(0, 10); }
  function field(label, el, id) {
    if (id) el.id = id;
    return h("div", { class: "field" }, [h("label", { for: id || false, text: label }), el]);
  }
  function resize(file, max, q) {
    return new Promise(function (res, rej) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var r = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * r);
        c.height = Math.round(img.height * r);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL("image/jpeg", q));
      };
      img.onerror = function () { rej(new Error("bad image")); };
      img.src = url;
    });
  }

  /* ---------- game file upload to GitHub Releases (free, up to 2 GB per file) ----------
     The token is kept for the current tab session only (sessionStorage), never saved in the repo or in Firestore. */
  var GH_REPO = "maro2611/Web-Games";
  var GH_TOKEN_KEY = "mg-gh-token";
  var memToken = "";
  function ghToken() {
    try { return sessionStorage.getItem(GH_TOKEN_KEY) || memToken; } catch (e) { return memToken; }
  }
  function setGhToken(t) {
    memToken = t;
    try { if (t) sessionStorage.setItem(GH_TOKEN_KEY, t); else sessionStorage.removeItem(GH_TOKEN_KEY); } catch (e) {}
  }
  function ghErr(status, data) {
    var m = data && data.message ? data.message : "";
    if (status === 401) return "التوكن غلط أو منتهي. اعمل توكن جديد واربطه تاني.";
    if (status === 403 || status === 404) return "التوكن مالوش صلاحية على الريبو. لازم Contents على Read and write لريبو Web-Games.";
    if (status === 422 && /already_exists/.test(JSON.stringify(data || {}))) return "في ملف بنفس الاسم على GitHub في الإصدار ده. غيّر اسم الملف أو رقم الإصدار.";
    return "GitHub رفض الطلب" + (m ? ": " + m : "") + " (" + status + ")";
  }
  function ghApi(path, method, body) {
    var headers = { Authorization: "Bearer " + ghToken(), Accept: "application/vnd.github+json" };
    if (body) headers["Content-Type"] = "application/json";
    return fetch("https://api.github.com" + path, { method: method || "GET", headers: headers, body: body ? JSON.stringify(body) : undefined }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; });
    });
  }
  function ghRelease(tag, name, notes) {
    return ghApi("/repos/" + GH_REPO + "/releases", "POST", { tag_name: tag, name: name, body: notes || "", target_commitish: "main" }).then(function (r) {
      if (r.ok) return r.data;
      if (r.status !== 422) throw new Error(ghErr(r.status, r.data));
      /* a release with this tag already exists: reuse it */
      return ghApi("/repos/" + GH_REPO + "/releases/tags/" + encodeURIComponent(tag)).then(function (g) {
        if (!g.ok) throw new Error(ghErr(r.status, r.data));
        return g.data;
      });
    });
  }
  function ghUpload(release, file, onProgress) {
    return new Promise(function (res, rej) {
      var url = String(release.upload_url).replace(/\{.*$/, "") + "?name=" + encodeURIComponent(file.name);
      var xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Authorization", "Bearer " + ghToken());
      xhr.setRequestHeader("Accept", "application/vnd.github+json");
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
      xhr.onload = function () {
        var d = {};
        try { d = JSON.parse(xhr.responseText); } catch (e) {}
        if (xhr.status === 201 && d.browser_download_url) res(d); else rej(new Error(ghErr(xhr.status, d)));
      };
      xhr.onerror = function () { rej(new Error("الرفع من المتصفح اتمنع أو النت فصل. ارفع الملف يدويًا على GitHub Releases والصق الرابط.")); };
      xhr.send(file);
    });
  }
  function b64utf8(str) { return btoa(unescape(encodeURIComponent(str))); }
  function ghPut(path, b64, msg) {
    var p = "/repos/" + GH_REPO + "/contents/" + path;
    return ghApi(p).then(function (cur) {
      var body = { message: msg, content: b64, branch: "main" };
      if (cur.ok && cur.data && cur.data.sha) body.sha = cur.data.sha;
      return ghApi(p, "PUT", body);
    });
  }
  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  var SITE = "https://maro2611.github.io/Web-Games/";
  /* a tiny static page per game so WhatsApp / Facebook show its name, text and picture when the link is shared */
  function sharePage(s, t, d, img) {
    var url = SITE + "game.html?g=" + encodeURIComponent(s), desc = d.replace(/\s+/g, " ").slice(0, 160);
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + esc(t) + ' | Marcelino Games</title><meta name="description" content="' + esc(desc) + '">' +
      '<meta property="og:type" content="website"><meta property="og:title" content="' + esc(t) + '"><meta property="og:description" content="' + esc(desc) + '">' +
      '<meta property="og:image" content="' + esc(img) + '"><meta property="og:url" content="' + esc(SITE + "g/" + s + ".html") + '"><meta name="twitter:card" content="summary_large_image">' +
      '<link rel="canonical" href="' + esc(url) + '"><meta http-equiv="refresh" content="0;url=' + esc(url) + '"></head>' +
      '<body><p><a href="' + esc(url) + '">' + esc(t) + '</a></p><script>location.replace(' + JSON.stringify(url) + ')</script></body></html>\n';
  }
  function publishSharePage(s, t, d, wallpaper) {
    if (!ghToken()) return Promise.resolve("no-token");
    var img = SITE + "images/banner.jpg", pre = Promise.resolve();
    var m = /^data:image\/jpeg;base64,(.+)$/.exec(wallpaper || "");
    if (m) { img = SITE + "images/games/" + s + ".jpg"; pre = ghPut("images/games/" + s + ".jpg", m[1], "Share image for " + s); }
    return pre.then(function () { return ghPut("g/" + s + ".html", b64utf8(sharePage(s, t, d, img)), "Share page for " + s); })
      .then(function (r) { return r.ok ? "ok" : "fail"; }, function () { return "fail"; });
  }
  function relTag(slug, version) { return (slug + "-v" + version).replace(/[^A-Za-z0-9._-]/g, "-"); }
  function fmtSize(b) { var mb = b / 1048576; return (mb < 10 ? mb.toFixed(1) : String(Math.round(mb))) + " MB"; }

  function ghPanel() {
    var state = h("p", { class: "note", role: "status" });
    var input = h("input", { type: "password", placeholder: "github_pat_...", dir: "ltr", autocomplete: "off" });
    var save = h("button", { class: "btn", type: "button", text: "ربط" });
    var off = h("button", { class: "btn secondary", type: "button", text: "فصل" });
    function show() {
      var on = !!ghToken();
      state.classList.remove("mg-busy");
      state.textContent = on ? "GitHub متربط في الجلسة دي. تقدر ترفع ملفات الألعاب من نموذج اللعبة." : "GitHub مش متربط.";
      off.hidden = !on;
    }
    save.addEventListener("click", function () {
      var t = input.value.trim();
      if (!t) return;
      setGhToken(t);
      state.textContent = "بتأكد من التوكن..."; state.classList.add("mg-busy");
      ghApi("/repos/" + GH_REPO).then(function (r) {
        if (!r.ok) { setGhToken(""); state.classList.remove("mg-busy"); state.textContent = ghErr(r.status, r.data); return; }
        input.value = "";
        show();
        if (r.data.permissions && r.data.permissions.push === false) state.textContent += " تنبيه: التوكن ده للقراءة بس ومش هيرفع.";
      }, function () { setGhToken(""); state.classList.remove("mg-busy"); state.textContent = "ماقدرتش أوصل لـ GitHub. اتأكد من النت."; });
    });
    off.addEventListener("click", function () { setGhToken(""); show(); });
    show();
    return h("details", { class: "panel" }, [
      h("summary", { text: "رفع ملفات الألعاب على GitHub (مجاني)" }),
      h("p", { class: "muted", text: "عشان ترفع الملف من هنا محتاج توكن GitHub مرة في كل جلسة (بيتمسح لما تقفل التبويب)." }),
      h("ol", null, [
        h("li", null, [h("a", { href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener", text: "افتح صفحة إنشاء التوكن" }), " واكتب أي اسم، واختار مدة (مثلًا 30 يوم)."]),
        h("li", { text: "في Repository access اختار Only select repositories واختار Web-Games." }),
        h("li", { text: "في Repository permissions خلي Contents على Read and write، واضغط Generate token." }),
        h("li", { text: "انسخ التوكن والصقه هنا واضغط ربط." })
      ]),
      h("div", { class: "field" }, [h("label", { text: "توكن GitHub" }), input]),
      h("div", { class: "actions" }, [save, off]),
      state
    ]);
  }

  MG.loadFirebase(["auth", "firestore"]).then(function (fb) {
    var auth = fb.auth();
    var db = fb.firestore();

    /* Extra password screen shown after the Google account is chosen.
       Only a salted SHA-256 of the password is kept here, not the password itself.
       This is a convenience gate: the real protection is the owner Google account + firestore.rules. */
    var PW_HASH = "743a323b9bab591ad63c86900e3d3a3d0bf83a4a29fd6038b3cc104c45b4856a";
    var memUnlocked = {};
    function unlockKey(u) { return "mg-admin-unlocked:" + u.uid; }
    function isUnlocked(u) {
      try { if (sessionStorage.getItem(unlockKey(u)) === "1") return true; } catch (e) {}
      return !!memUnlocked[u.uid];
    }
    function markUnlocked(u) {
      memUnlocked[u.uid] = true;
      try { sessionStorage.setItem(unlockKey(u), "1"); } catch (e) {}
    }
    function signOut() {
      var u = auth.currentUser;
      if (u) {
        delete memUnlocked[u.uid];
        try { sessionStorage.removeItem(unlockKey(u)); } catch (e) {}
      }
      auth.signOut();
    }
    function sha256(text) {
      if (!window.crypto || !window.crypto.subtle) return Promise.reject(new Error("no crypto"));
      return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode("mg-admin:" + text)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
      });
    }

    function render(u) {
      box.textContent = "";
      if (!u) return signIn();
      var ok = (u.email || "").toLowerCase() === OWNER && u.emailVerified;
      if (!ok) return denied(u);
      if (!isUnlocked(u)) return askPassword(u);
      dashboard(u);
    }

    /* After a wrong password the form is locked for 10 seconds. The end time is kept
       in localStorage so a page refresh doesn't skip the wait. */
    var LOCK_MS = 10000;
    var LOCK_KEY = "mg-admin-lock-until";
    var memLockUntil = 0;
    function lockUntil() {
      var t = memLockUntil;
      try { t = Math.max(t, Number(localStorage.getItem(LOCK_KEY)) || 0); } catch (e) {}
      return t;
    }
    function startLock() {
      memLockUntil = Date.now() + LOCK_MS;
      try { localStorage.setItem(LOCK_KEY, String(memLockUntil)); } catch (e) {}
    }
    function clearLock() {
      memLockUntil = 0;
      try { localStorage.removeItem(LOCK_KEY); } catch (e) {}
    }

    function askPassword(u) {
      var input = h("input", { type: "password", id: "admin-pw", autocomplete: "current-password" });
      var go = h("button", { class: "btn", type: "submit", text: "دخول" });
      var note = h("p", { class: "note", hidden: "hidden", role: "alert" });
      var form = h("form", { class: "panel" }, [
        h("h3", { text: "ادخل الباسوورد" }),
        h("p", { class: "muted", text: "الحساب: " + u.email + ". اكتب الباسوورد عشان تفتح لوحة التحكم." }),
        h("div", { class: "field" }, [h("label", { for: "admin-pw", text: "الباسوورد" }), input]),
        note,
        h("div", { class: "actions" }, [
          go,
          h("button", { class: "btn secondary", type: "button", text: "تسجيل الخروج", onclick: signOut })
        ])
      ]);

      var timer = null;
      function secondsLeft() { return Math.ceil((lockUntil() - Date.now()) / 1000); }
      function tick(prefix) {
        if (!document.body.contains(form)) { clearInterval(timer); return; }
        var left = secondsLeft();
        if (left > 0) {
          input.disabled = true; go.disabled = true;
          note.hidden = false;
          note.textContent = (prefix || "") + "استنى " + left + " ثواني وجرّب تاني.";
        } else {
          clearInterval(timer); timer = null;
          input.disabled = false; go.disabled = false;
          note.hidden = true;
          input.focus();
        }
      }
      function startCountdown(prefix) {
        clearInterval(timer);
        tick(prefix);
        timer = setInterval(function () { tick(prefix); }, 250);
      }

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (secondsLeft() > 0) return;
        sha256(input.value).then(function (hex) {
          if (hex === PW_HASH) { clearLock(); markUnlocked(u); render(u); return; }
          input.value = "";
          startLock();
          startCountdown("الباسوورد غلط. ");
        }, function () {
          note.hidden = false;
          note.textContent = "المتصفح مش بيدعم التحقق من الباسوورد. جرّب متصفح تاني.";
        });
      });
      box.appendChild(form);
      if (secondsLeft() > 0) startCountdown(""); else input.focus();
    }

    auth.onAuthStateChanged(function (u) { render(u); });

    function signIn() {
      var note = h("p", { class: "note", hidden: "hidden" });
      var btn = h("button", { class: "btn", type: "button", text: "تسجيل الدخول بحساب جوجل" });
      btn.addEventListener("click", function () {
        auth.signInWithPopup(new fb.auth.GoogleAuthProvider()).catch(function (e) {
          var code = (e && e.code) || "unknown";
          var why = {
            "auth/unauthorized-domain": "الدومين مش متضاف في Firebase: Authentication ثم Settings ثم Authorized domains، وضيف maro2611.github.io",
            "auth/operation-not-allowed": "تسجيل الدخول بجوجل مش متفعّل: Authentication ثم Sign-in method ثم Google ثم Enable",
            "auth/configuration-not-found": "خدمة Authentication لسه ما اتفعّلتش في مشروع Firebase: افتح Build ثم Authentication واضغط Get started، وبعدها Sign-in method ثم Google ثم Enable",
            "auth/popup-blocked": "المتصفح قفل النافذة المنبثقة. اسمح بالـ popups للموقع وجرّب تاني",
            "auth/popup-closed-by-user": "النافذة اتقفلت قبل ما تخلّص الدخول",
            "auth/cancelled-popup-request": "النافذة اتقفلت قبل ما تخلّص الدخول",
            "auth/network-request-failed": "مشكلة في الإنترنت. جرّب تاني",
            "auth/invalid-api-key": "مفتاح Firebase غلط في ملف data/firebase-config.js"
          }[code] || "ماتمش تسجيل الدخول. جرّب تاني.";
          note.hidden = false;
          note.textContent = why + " (" + code + ")";
        });
      });
      box.appendChild(h("div", { class: "panel" }, [
        h("h3", { text: "دخول صاحب الموقع" }),
        h("p", { class: "muted", text: "سجّل دخول بحساب جوجل بتاع صاحب الموقع." }),
        btn, note
      ]));
    }

    function denied(u) {
      box.appendChild(h("div", { class: "panel" }, [
        h("h3", { text: "مفيش صلاحية" }),
        h("p", { class: "muted", text: "الحساب ده (" + u.email + ") مش صاحب الموقع." }),
        h("button", { class: "btn secondary", type: "button", text: "تسجيل الخروج", onclick: signOut })
      ]));
    }

    function dashboard(u) {
      var games = [];
      var msg = h("p", { class: "note", hidden: "hidden", role: "status" });
      var list = h("div", { class: "stack" });
      var formBox = h("div");

      function say(t) { msg.hidden = false; msg.textContent = t; }

      box.appendChild(h("div", { class: "tools" }, [
        h("span", { class: "muted", text: u.email }),
        h("button", { class: "btn secondary", type: "button", text: "تسجيل الخروج", onclick: signOut })
      ]));
      box.appendChild(h("div", { class: "actions" }, [
        h("button", { class: "btn", type: "button", text: "إضافة لعبة", onclick: function () { openForm(null, false); } })
      ]));
      box.appendChild(ghPanel());
      box.appendChild(msg);
      box.appendChild(formBox);
      box.appendChild(h("h2", { text: "الألعاب" }));
      box.appendChild(importBox);
      box.appendChild(list);

      /* ---- statistics: downloads and ratings per game, and the site rating ---- */
      var statBox = h("div", { class: "stack" });
      function loadStats() {
        statBox.textContent = ""; statBox.appendChild(h("p", { class: "muted mg-busy", text: "بحمّل الإحصائيات..." }));
        db.collection("stats").get().then(function (snap) {
          statBox.textContent = "";
          var by = {}; snap.docs.forEach(function (d) { by[d.id] = d.data(); });
          function avg(x) { return x && x.ratingCount ? ((x.ratingSum || 0) + (x.halfSum || 0) / 2) / x.ratingCount : 0; }
          var total = 0; Object.keys(by).forEach(function (k) { if (k !== "_site") total += by[k].downloads || 0; });
          var site = by._site;
          statBox.appendChild(h("div", { class: "panel" }, [
            h("p", { class: "num", text: String(total) }), h("p", { class: "muted", text: "إجمالي التحميلات" }),
            h("p", { text: site && site.ratingCount ? "تقييم الموقع: " + avg(site).toFixed(1) + " من 5 (" + site.ratingCount + " تقييم)" : "تقييم الموقع: لسه مفيش تقييمات" })
          ]));
          var rows = games.slice().sort(function (a, b) { return ((by[b.slug] || {}).downloads || 0) - ((by[a.slug] || {}).downloads || 0); }).map(function (g) {
            var x = by[g.slug] || {};
            return h("tr", null, [h("td", { text: g.title }), h("td", { text: String(x.downloads || 0) }), h("td", { text: x.ratingCount ? avg(x).toFixed(1) + " (" + x.ratingCount + ")" : "-" })]);
          });
          if (rows.length) statBox.appendChild(h("div", { class: "table-scroll" }, [h("table", null, [h("tr", null, [h("th", { text: "اللعبة" }), h("th", { text: "التحميلات" }), h("th", { text: "التقييم" })])].concat(rows))]));
        }).catch(function () { statBox.textContent = ""; statBox.appendChild(h("p", { class: "empty", text: "ماقدرتش أحمّل الإحصائيات." })); });
      }
      box.appendChild(h("h2", { text: "الإحصائيات" }));
      box.appendChild(h("div", { class: "actions" }, [h("button", { class: "btn secondary", type: "button", text: "تحديث الإحصائيات", onclick: loadStats })]));
      box.appendChild(statBox);

      /* ---- complaints moderation: read everything, delete any complaint or comment ---- */
      var FV = window.firebase.firestore.FieldValue;
      var cList = h("div", { class: "stack" });
      function when(ts) { try { return (ts && ts.toDate ? ts.toDate() : new Date()).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } }
      function deleteRefs(refs) {              // batches of 400
        if (!refs.length) return Promise.resolve();
        var b = db.batch(); refs.slice(0, 400).forEach(function (r) { b.delete(r); });
        return b.commit().then(function () { return deleteRefs(refs.slice(400)); });
      }
      function loadComplaints() {
        cList.textContent = "";
        cList.appendChild(h("p", { class: "muted mg-busy", text: "بحمّل الشكاوى..." }));
        db.collection("complaints").orderBy("created", "desc").limit(100).get().then(function (snap) {
          cList.textContent = "";
          if (snap.empty) cList.appendChild(h("p", { class: "empty", text: "مفيش شكاوى." }));
          snap.docs.forEach(function (d) { cList.appendChild(complaintRow(d)); });
        }).catch(function () { cList.textContent = ""; cList.appendChild(h("p", { class: "empty", text: "ماقدرتش أحمّل الشكاوى. اتأكد إن القواعد الجديدة اتنشرت." })); });
      }
      function complaintRow(d) {
        var c = d.data(), actions = h("div", { class: "actions" }), cbox = h("div", { class: "stack", hidden: "hidden" }), loaded = false;
        var cnt = h("span", { class: "muted", text: "👍 " + (c.likes || 0) + "  👎 " + (c.dislikes || 0) + "  💬 " + (c.comments || 0) });
        function showComments() {
          cbox.hidden = !cbox.hidden;
          if (cbox.hidden || loaded) return;
          loaded = true;
          d.ref.collection("comments").orderBy("created", "asc").get().then(function (snap) {
            if (snap.empty) cbox.appendChild(h("p", { class: "muted", text: "مفيش تعليقات." }));
            snap.docs.forEach(function (cd) {
              var cm = cd.data(), row = h("div", { class: "comment" });
              row.appendChild(h("strong", { text: cm.name })); row.appendChild(h("span", { class: "muted", text: " · " + when(cm.created) }));
              row.appendChild(h("p", { text: cm.text }));
              row.appendChild(h("button", { class: "btn secondary", type: "button", text: "حذف التعليق", onclick: function () {
                var b = db.batch(); b.delete(cd.ref); b.update(d.ref, { comments: FV.increment(-1) });
                b.commit().then(function () { row.remove(); say("اتحذف التعليق."); }, function () { say("ماتحذفش."); });
              } }));
              cbox.appendChild(row);
            });
          }).catch(function () { cbox.appendChild(h("p", { class: "muted", text: "ماقدرتش أحمّل التعليقات." })); });
        }
        var del = h("button", { class: "btn secondary", type: "button", text: "حذف الشكوى" });
        del.addEventListener("click", function () {
          actions.textContent = "";
          actions.appendChild(h("span", { class: "muted", text: "تأكيد حذف الشكوى وكل تعليقاتها؟" }));
          actions.appendChild(h("button", { class: "btn", type: "button", text: "أيوه احذف", onclick: function () {
            d.ref.collection("comments").get().then(function (snap) {
              return deleteRefs(snap.docs.map(function (x) { return x.ref; }));
            }).then(function () { return d.ref.delete(); }).then(function () { say("اتحذفت الشكوى."); loadComplaints(); }, function () { say("ماتحذفتش."); });
          } }));
          actions.appendChild(h("button", { class: "btn secondary", type: "button", text: "إلغاء", onclick: loadComplaints }));
        });
        actions.appendChild(h("button", { class: "btn secondary", type: "button", text: "التعليقات", onclick: showComments }));
        actions.appendChild(h("button", { class: "btn secondary", type: "button", text: c.hidden ? "إظهار للزوار" : "إخفاء عن الزوار", onclick: function () {
          d.ref.update({ hidden: !c.hidden }).then(function () { say(c.hidden ? "ظهرت للزوار." : "اتخفت عن الزوار."); loadComplaints(); }, function () { say("ماتحدّثتش."); });
        } }));
        actions.appendChild(del);
        return h("div", { class: "panel" }, [
          h("h3", { text: c.name + (c.game ? " · " + c.game : "") + (c.hidden ? " (مخفية)" : "") }),
          h("p", { class: "muted" }, [when(c.created) + "  ", cnt]),
          h("p", { text: c.text, style: "white-space:pre-wrap;overflow-wrap:anywhere" }),
          actions, cbox
        ]);
      }
      box.appendChild(h("h2", { text: "الشكاوى" }));
      box.appendChild(h("div", { class: "actions" }, [h("button", { class: "btn secondary", type: "button", text: "تحديث الشكاوى", onclick: loadComplaints })]));
      box.appendChild(cList);
      loadComplaints();

      var importBox = h("div", { class: "stack" });
      function showImport() {
        importBox.textContent = "";
        fetch("data/games.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (file) {
          var have = {}; games.forEach(function (x) { have[x.slug] = 1; });
          var missing = file.filter(function (x) { return !have[x.slug]; });
          if (!missing.length) return;
          importBox.appendChild(h("div", { class: "panel" }, [
            h("h3", { text: "ألعاب لسه مش في قاعدة البيانات" }),
            h("p", { class: "muted", text: "الألعاب دي موجودة في ملفات الموقع بس (" + missing.map(function (x) { return x.title; }).join("، ") + "). استوردها عشان تظهر هنا وتقدر تعدّلها وتحط لها صورة." }),
            h("button", { class: "btn", type: "button", text: "استيراد الألعاب دي", onclick: function () {
              var b = db.batch();
              missing.forEach(function (x) { var o = Object.assign({}, x); delete o.slug; delete o.example; if (typeof o.hidden !== "boolean") o.hidden = false; b.set(db.collection("games").doc(x.slug), o); });
              b.commit().then(function () { say("اتستوردت. اضغط تعديل على اللعبة عشان تحط الصورة."); refresh(); }, function () { say("الاستيراد فشل. اتأكد من قواعد Firestore."); });
            } })
          ]));
        }).catch(function () {});
      }
      function refresh() {
        return db.collection("games").get().then(function (snap) {
          games = snap.docs.map(function (d) { var o = d.data(); o.slug = d.id; return o; })
            .sort(function (a, b) { return String(b.added).localeCompare(String(a.added)); });
          draw(); showImport();
        }).catch(function () { say("ماقدرتش أحمّل الألعاب. اتأكد من قواعد Firestore."); });
      }

      function draw() {
        list.textContent = "";
        if (!games.length) list.appendChild(h("p", { class: "empty", text: "مفيش ألعاب لسه. اضغط إضافة لعبة." }));
        games.forEach(function (g) {
          var v = (g.versions && g.versions[0]) || {};
          var actions = h("div", { class: "actions" });
          var del = h("button", { class: "btn secondary", type: "button", text: "حذف" });
          del.addEventListener("click", function () {
            actions.textContent = "";
            actions.appendChild(h("span", { class: "muted", text: "تأكيد حذف " + g.title + "؟" }));
            actions.appendChild(h("button", { class: "btn", type: "button", text: "أيوه احذف", onclick: function () {
              db.collection("games").doc(g.slug).delete().then(function () { say("اتحذفت."); refresh(); }, function () { say("ماتحذفتش."); });
            } }));
            actions.appendChild(h("button", { class: "btn secondary", type: "button", text: "إلغاء", onclick: draw }));
          });
          actions.appendChild(h("button", { class: "btn secondary", type: "button", text: "تعديل", onclick: function () { openForm(g, false); } }));
          actions.appendChild(h("button", { class: "btn secondary", type: "button", text: "إصدار جديد", onclick: function () { openForm(g, true); } }));
          actions.appendChild(h("button", { class: "btn secondary", type: "button", text: g.hidden ? "إظهار" : "إخفاء", onclick: function () {
            db.collection("games").doc(g.slug).update({ hidden: !g.hidden }).then(function () { say(g.hidden ? "اتظهرت." : "اتخفت."); refresh(); }, function () { say("ماتحدّثتش."); });
          } }));
          actions.appendChild(del);
          list.appendChild(h("div", { class: "panel" }, [
            h("h3", { text: g.title }),
            h("p", { class: "muted" }, [g.platform + " · إصدار ", h("span", { class: "ltr", text: v.version || "-" }), g.hidden ? " · مخفية (مسودة)" : " · منشورة"]),
            actions
          ]));
        });
      }

      function openForm(g, newVersion) {
        var isEdit = !!g;
        var st = {
          wallpaper: (g && g.wallpaper) || "",
          shots: ((g && g.screenshots) || []).slice(),
          versions: ((g && g.versions) || [{ version: "1.0", date: today(), size: "", changelog: "", url: "" }]).map(function (x) { return Object.assign({}, x); })
        };
        if (newVersion) st.versions.unshift({ version: "", date: today(), size: "", changelog: "", url: "" });

        var title = h("input", { type: "text", value: g ? g.title : "" });
        var slug = h("input", { type: "text", value: g ? g.slug : "", dir: "ltr", placeholder: "my-game" });
        if (isEdit) slug.setAttribute("disabled", "disabled");
        var desc = h("textarea", { rows: "4" }); desc.value = g ? g.desc : "";
        var platform = h("select", null, [h("option", { value: "Android", text: "Android" }), h("option", { value: "Windows", text: "Windows" })]);
        platform.value = g ? g.platform : "Android";
        var CATS = ["", "أكشن", "ألغاز", "سباق", "مغامرات", "استراتيجية", "رعب", "أطفال", "أخرى"];
        var category = h("select", null, CATS.map(function (c) { return h("option", { value: c, text: c || "بدون تصنيف" }); }));
        category.value = g && g.category ? g.category : "";
        var minA = h("input", { type: "text", value: g ? (g.minAndroid || "") : "8.0", dir: "ltr" });
        var ram = h("input", { type: "text", value: g ? (g.ram || "") : "2 GB", dir: "ltr" });

        var wallPrev = h("div");
        var wallIn = h("input", { type: "file", accept: "image/*" });
        function drawWall() {
          wallPrev.textContent = "";
          if (st.wallpaper) {
            wallPrev.appendChild(h("img", { src: st.wallpaper, alt: "", style: "max-width:260px;border-radius:8px;border:1px solid var(--line)" }));
            wallPrev.appendChild(h("button", { class: "btn secondary", type: "button", text: "حذف الصورة", onclick: function () { st.wallpaper = ""; drawWall(); } }));
          }
        }
        wallIn.addEventListener("change", function () {
          if (wallIn.files[0]) resize(wallIn.files[0], 1100, 0.8).then(function (d) { st.wallpaper = d; drawWall(); }, function () { say("الصورة دي مش مقبولة."); });
        });
        drawWall();

        var shotsPrev = h("div", { class: "shots" });
        var shotsIn = h("input", { type: "file", accept: "image/*", multiple: "multiple" });
        function drawShots() {
          shotsPrev.textContent = "";
          st.shots.forEach(function (s, i) {
            shotsPrev.appendChild(h("div", { class: "stack", style: "flex:none" }, [
              h("img", { src: s, alt: "", style: "height:120px;width:auto;border-radius:8px;border:1px solid var(--line)" }),
              h("button", { class: "btn secondary", type: "button", text: "حذف", onclick: function () { st.shots.splice(i, 1); drawShots(); } })
            ]));
          });
        }
        shotsIn.addEventListener("change", function () {
          var files = Array.prototype.slice.call(shotsIn.files).slice(0, Math.max(0, 4 - st.shots.length));
          Promise.all(files.map(function (f) { return resize(f, 720, 0.72); })).then(function (arr) {
            st.shots = st.shots.concat(arr); drawShots(); shotsIn.value = "";
          }, function () { say("واحدة من الصور مش مقبولة."); });
        });
        drawShots();

        var versBox = h("div", { class: "stack" });
        function doUpload(x, fileEl, statusEl, btn) {
          var f = fileEl.files[0];
          var s = slug.value.trim().toLowerCase();
          function note(t) { statusEl.hidden = false; statusEl.textContent = t; statusEl.classList.toggle("mg-busy", /^(بجهّز|بيترفع)/.test(t)); }
          if (!ghToken()) return note("اربط GitHub الأول من الجزء اللي فوق (رفع ملفات الألعاب على GitHub).");
          if (!s) return note("اكتب الرابط (slug) بتاع اللعبة الأول.");
          if (!(x.version || "").trim()) return note("اكتب رقم الإصدار الأول.");
          if (!f) return note("اختار الملف الأول.");
          btn.disabled = true;
          note("بجهّز الإصدار على GitHub...");
          ghRelease(relTag(s, x.version.trim()), (title.value.trim() || s) + " " + x.version.trim(), x.changelog)
            .then(function (rel) { return ghUpload(rel, f, function (p) { note("بيترفع... " + p + "%"); }); })
            .then(function (asset) {
              x.url = asset.browser_download_url;
              x.size = fmtSize(f.size);
              say("الملف اترفع واتحط رابطه والحجم. اضغط نشر أو حفظ كمسودة عشان تحفظ التغييرات.");
              drawVers();
            })
            .catch(function (e) { btn.disabled = false; note(e.message); });
        }
        function drawVers() {
          versBox.textContent = "";
          st.versions.forEach(function (x, i) {
            function bind(key, ph, type) {
              var inp = h("input", { type: type || "text", value: x[key] || "", placeholder: ph, dir: "ltr" });
              inp.addEventListener("input", function () { x[key] = inp.value; });
              return inp;
            }
            var ch = h("textarea", { rows: "2", placeholder: "إيه اللي اتغير" }); ch.value = x.changelog || "";
            ch.addEventListener("input", function () { x.changelog = ch.value; });
            var fileIn = h("input", { type: "file" });
            var upStatus = h("p", { class: "note", hidden: "hidden", role: "status" });
            var upBtn = h("button", { class: "btn", type: "button", text: "ارفع الملف على GitHub" });
            upBtn.addEventListener("click", function () { doUpload(x, fileIn, upStatus, upBtn); });
            versBox.appendChild(h("div", { class: "panel" }, [
              h("div", { class: "tools" }, [bind("version", "رقم الإصدار 1.0"), bind("date", "", "date"), bind("size", "الحجم 45 MB")]),
              bind("url", "رابط التحميل المباشر (GitHub Releases)", "url"),
              h("div", { class: "field" }, [h("label", { text: "أو ارفع ملف اللعبة من هنا (الرابط والحجم بيتملوا لوحدهم)" }), fileIn, upBtn, upStatus]),
              h("a", { class: "muted", href: "https://github.com/" + GH_REPO + "/releases/new", target: "_blank", rel: "noopener", text: "بديل: ارفع الملف يدويًا على GitHub Releases والصق الرابط فوق." }),
              ch,
              st.versions.length > 1 ? h("button", { class: "btn secondary", type: "button", text: "حذف الإصدار ده", onclick: function () { st.versions.splice(i, 1); drawVers(); } }) : null
            ]));
          });
        }
        drawVers();

        function save(hidden) {
          var t = title.value.trim();
          var s = slug.value.trim().toLowerCase();
          if (!t || !desc.value.trim()) return say("اكتب اسم اللعبة والوصف.");
          if (!isEdit && !s) s = "game-" + Date.now().toString(36);
          if (!/^[a-z0-9-]+$/.test(s)) return say("الرابط (slug) حروف إنجليزي صغيرة وأرقام وشرطة بس.");
          if (!isEdit && games.some(function (x) { return x.slug === s; })) return say("في لعبة بنفس الـ slug.");
          var vers = st.versions.filter(function (x) { return (x.version || "").trim(); }).map(function (x) {
            return { version: x.version.trim(), date: x.date || today(), size: (x.size || "").trim(), changelog: (x.changelog || "").trim(), url: (x.url || "").trim() };
          });
          if (!vers.length) return say("لازم إصدار واحد على الأقل برقمه.");
          var doc = {
            title: t, desc: desc.value.trim(), platform: platform.value, category: category.value,
            wallpaper: st.wallpaper, screenshots: st.shots,
            minAndroid: minA.value.trim(), ram: ram.value.trim(),
            hue: g && g.hue ? g.hue : Math.floor(Math.random() * 360),
            added: g && g.added ? g.added : today(),
            hidden: !!hidden, versions: vers
          };
          if (JSON.stringify(doc).length > 950000) return say("الصور كبيرة أوي. قلّل عدد اللقطات أو شيل صورة.");
          db.collection("games").doc(s).set(doc).then(function () {
            say(hidden ? "اتحفظت كمسودة." : "اتنشرت.");
            formBox.textContent = "";
            refresh();
            if (!hidden) publishSharePage(s, t, doc.desc, doc.wallpaper).then(function (r) {
              if (r === "ok") say("اتنشرت، ومعاينة الرابط على واتساب اتجهزت.");
              else if (r === "no-token") say("اتنشرت. اربط GitHub وعدّل واحفظ تاني عشان تظهر معاينة الرابط على واتساب.");
              else say("اتنشرت، بس معاينة الرابط ماتجهزتش (صلاحية GitHub).");
            });
          }, function () { say("ماتحفظتش. اتأكد من قواعد Firestore وإنك داخل بحساب صاحب الموقع."); });
        }

        formBox.textContent = "";
        formBox.appendChild(h("div", { class: "panel" }, [
          h("h2", { text: isEdit ? "تعديل: " + g.title : "لعبة جديدة" }),
          field("اسم اللعبة", title, "f-title"),
          field("الرابط (slug)", slug, "f-slug"),
          field("الوصف", desc, "f-desc"),
          field("المنصة", platform, "f-platform"),
          field("التصنيف", category, "f-category"),
          field("أقل إصدار أندرويد", minA, "f-min"),
          field("الرام المناسب", ram, "f-ram"),
          h("div", { class: "field" }, [h("label", { text: "صورة اللعبة (الوول بيبر)" }), wallIn, wallPrev]),
          h("div", { class: "field" }, [h("label", { text: "لقطات من اللعبة (لحد 4)" }), shotsIn, shotsPrev]),
          h("h3", { text: "الإصدارات (الأحدث الأول)" }),
          versBox,
          h("button", { class: "btn secondary", type: "button", text: "إضافة إصدار", onclick: function () {
            st.versions.unshift({ version: "", date: today(), size: "", changelog: "", url: "" }); drawVers();
          } }),
          h("div", { class: "actions" }, [
            h("button", { class: "btn", type: "button", text: "نشر", onclick: function () { save(false); } }),
            h("button", { class: "btn secondary", type: "button", text: "حفظ كمسودة", onclick: function () { save(true); } }),
            h("button", { class: "btn secondary", type: "button", text: "إلغاء", onclick: function () { formBox.textContent = ""; } })
          ])
        ]));
        formBox.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      refresh().then(loadStats);
    }
  }).catch(function () {
    box.appendChild(h("p", { class: "empty", text: "ماقدرتش أحمّل Firebase. جرّب تحدّث الصفحة." }));
  });
};
