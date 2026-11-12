/* Sends a push notification to subscribers stored in Firestore (collection "subscribers").
   game = "all"  -> everyone who turned notifications on
   game = <slug> -> subscribers with mode "all", plus mode "mine" who downloaded that game */
const admin = require("firebase-admin");

const SITE = "https://maro2611.github.io/Web-Games/";
const title = (process.env.N_TITLE || "").trim();
const body = (process.env.N_BODY || "").trim();
const game = (process.env.N_GAME || "all").trim();
let link = (process.env.N_LINK || "").trim();

(async () => {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error("Missing secret FIREBASE_SERVICE_ACCOUNT");
  if (!title || !body) throw new Error("title and body are required");
  if (!link) link = game === "all" ? SITE : SITE + "game.html?g=" + encodeURIComponent(game);
  if (link.indexOf(SITE) !== 0) throw new Error("link must start with " + SITE);

  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = admin.firestore();
  const snap = await db.collection("subscribers").get();

  const tokens = [];
  snap.forEach((d) => {
    const s = d.data();
    if (game === "all" || s.mode === "all" || (Array.isArray(s.games) && s.games.includes(game))) tokens.push(d.id);
  });
  console.log(`subscribers: ${snap.size}, matching: ${tokens.length}`);

  let ok = 0, failed = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const res = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      webpush: {
        notification: { icon: SITE + "images/icon-192.png", badge: SITE + "images/icon-192.png" },
        fcmOptions: { link }
      }
    });
    ok += res.successCount; failed += res.failureCount;
    const dead = [];
    res.responses.forEach((r, idx) => {
      const c = r.error && r.error.code;
      if (c === "messaging/registration-token-not-registered" || c === "messaging/invalid-registration-token") dead.push(chunk[idx]);
    });
    await Promise.all(dead.map((t) => db.collection("subscribers").doc(t).delete()));
    if (dead.length) console.log(`removed ${dead.length} dead tokens`);
  }
  console.log(`sent: ${ok}, failed: ${failed}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
