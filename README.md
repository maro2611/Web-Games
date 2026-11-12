# Marcelino Games

موقع ثابت (من غير سيرفر) لعرض وتحميل الألعاب، بيشتغل على GitHub Pages.

## إزاي تضيف لعبة
1. ارفع الـ APK في **Releases** (Releases ثم Draft a new release ثم ارفع الملف ثم Publish).
2. انسخ رابط الملف (كليك يمين على اسم الملف ثم Copy link address).
3. افتح `data/games.json` وانسخ كتلة اللعبة التجريبية وغيّر بياناتها، وحط الرابط في `"url"`.
4. ارفع صورة اللعبة في فولدر `images/` وحط مسارها في `"wallpaper"` (مثلًا `"images/mygame.jpg"`).
5. اعمل Commit، والموقع يتحدث لوحده بعد دقيقة.

## إزاي تضيف إصدار جديد
حط إصدار جديد **في أول** قايمة `"versions"` للعبة. الإصدارات القديمة تفضل تحتيه في سجل التحديثات.

## تشغيل الموقع (مرة واحدة)
Settings ثم Pages ثم Source: **GitHub Actions**.
لازم الـ Repository يكون Public على الخطة المجانية.

## إعدادات الموقع
`data/site.json`: النص التعريفي، رقم واتساب، الإعلان العلوي، وبيانات "ادعمني".

## لوحة التحكم (دخول جوجل، إضافة وتعديل وحذف)
اللوحة على `admin.html` (من زرار "لوحة التحكم" في الإعدادات). بتشتغل بـ Firebase المجاني:

1. console.firebase.google.com ثم Add project.
2. Build ثم Authentication ثم Get started ثم Sign-in method ثم Google ثم Enable.
3. Authentication ثم Settings ثم Authorized domains ثم Add domain: `maro2611.github.io`.
4. Build ثم Firestore Database ثم Create database (Production mode). من تبويب Rules الصق محتوى ملف `firestore.rules` واضغط Publish.
5. Project settings (الترس) ثم Your apps ثم Web (`</>`) ثم Register. انسخ `firebaseConfig` وحطه في `data/firebase-config.js`.

الصور بتترفع من اللوحة وبتتصغّر تلقائيًا. ملفات الـ APK بتترفع في GitHub Releases. تقدر ترفعها من اللوحة نفسها: اربط توكن GitHub (Fine-grained، ريبو Web-Games، Contents: Read and write) من قسم "رفع ملفات الألعاب على GitHub"، وبعدها من خانة أي إصدار اختار الملف واضغط "ارفع الملف على GitHub" والرابط والحجم بيتملوا لوحدهم. التوكن بيتخزن في جلسة التبويب بس. أو ارفع الملف يدويًا في Releases والصق رابطه في خانة الإصدار.
بعد ربط Firebase الموقع بيقرأ الألعاب من Firestore، وملف `data/games.json` بيفضل احتياطي لو Firebase مش متاح.

## التطبيق والإشعارات
- الموقع قابل للتثبيت كتطبيق (PWA) باسم Marcelino Games وأيقونته الدراع اللي عليه M. ملفاته: `manifest.webmanifest` و`firebase-messaging-sw.js` و`images/icon-*.png`.
- أول ما حد يفتح الموقع بتظهر له رسالة بتسأله يفعّل الإشعارات: **لكل الألعاب** أو **للألعاب اللي نزّلها بس**. اختياره بيتسجل في Firestore (collection `subscribers`)، ويقدر يغيّره من صفحة الإعدادات.
- تفعيل الإشعارات (مرة واحدة):
  1. Firebase console ثم Project settings ثم Cloud Messaging ثم Web Push certificates ثم Generate key pair، وانسخ المفتاح في `window.VAPID_KEY` داخل `data/firebase-config.js`.
  2. الصق `firestore.rules` الجديد في Firestore ثم Rules ثم Publish.
  3. Project settings ثم Service accounts ثم Generate new private key. افتح الملف وانسخ محتواه كله، وضيفه في GitHub: Settings ثم Secrets and variables ثم Actions ثم New repository secret باسم `FIREBASE_SERVICE_ACCOUNT`.
- إرسال إشعار: تبويب Actions ثم **Send notification** ثم Run workflow، واكتب العنوان والنص و`game` (slug اللعبة أو `all`).
- على آيفون الإشعارات بتشتغل بعد إضافة الموقع للشاشة الرئيسية.
