/* Marcelino Games service worker: makes the site installable, keeps the pages working
   offline, and shows push notifications sent through Firebase Cloud Messaging. */
try {
  importScripts(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"
  );
  firebase.initializeApp({
    apiKey: "AIzaSyBwhKCEP9mjbWqZ4xfx9LOuGCiiBn2kSxg",
    authDomain: "marcelino-games.firebaseapp.com",
    projectId: "marcelino-games",
    storageBucket: "marcelino-games.firebasestorage.app",
    messagingSenderId: "451098458088",
    appId: "1:451098458088:web:2afa29da464e5b5731965d"
  });
  /* messages that carry a "notification" field are displayed by the SDK itself */
  firebase.messaging();
} catch (e) { /* offline install: the app shell below still works */ }

var CACHE = "mg-shell-v2";
var SHELL = [
  "./", "index.html", "games.html", "game.html", "settings.html",
  "assets/style.css", "assets/app.js", "assets/notify.js",
  "images/icon-192.png", "images/banner.jpg", "images/bg.jpg"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* network first, cached copy only when offline. Game files are never cached. */
self.addEventListener("fetch", function (e) {
  var r = e.request;
  if (r.method !== "GET") return;
  var u = new URL(r.url);
  if (u.origin !== location.origin) return;
  if (u.pathname.indexOf("/downloads/") >= 0 || /\.(apk|exe|zip)$/i.test(u.pathname)) return;
  e.respondWith(fetch(r).then(function (res) {
    if (res && res.status === 200) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { return c.put(r, copy); }).catch(function () {});
    }
    return res;
  }).catch(function () {
    return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || caches.match("index.html", { ignoreSearch: true }); });
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var link = (e.notification.data && (e.notification.data.FCM_MSG && e.notification.data.FCM_MSG.fcmOptions && e.notification.data.FCM_MSG.fcmOptions.link)) ||
             (e.notification.data && e.notification.data.link) || "./";
  e.waitUntil(clients.openWindow(new URL(link, self.registration.scope).href));
});
