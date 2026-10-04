/* =========================================================================
   عبور إكسبريس — Service Worker
   مسؤول عن: تخزين الملفات الأساسية (Cache) للعمل بدون اتصال، وجعل
   التطبيق قابلاً للتثبيت (PWA). عند تحديث الإصدار، غيّر قيمة CACHE_VERSION
   ليقوم المتصفح بتحميل الملفات الجديدة تلقائياً بدل النسخة القديمة المخزّنة.
   ========================================================================= */

const CACHE_VERSION = 'ubour-v3.4.1'; // مطابقة مسارات الأيقونات مع هيكل الملفات المرفوع (بدون مجلد icons/)
const RUNTIME_CACHE = 'ubour-runtime';

// الملفات الأساسية التي يجب تخزينها فوراً عند التثبيت لتشغيل التطبيق دون اتصال
// ملاحظة: بعد الدمج، أصبح index.html يحتوي كل الـ CSS/JS داخلياً، فلم تعد
// هناك ملفات css/js منفصلة يلزم تخزينها — هذا يقلّل احتمالية أي عطل يتعلق
// بمسارات الملفات عند الاستضافة، ويجعل التطبيق يعمل دون اتصال بثقة أعلى.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './logo-mark.png',
  './logo-full.png'
];

// ---- التثبيت: تخزين هيكل التطبيق الأساسي ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ---- التفعيل: حذف أي نسخ كاش قديمة من إصدارات سابقة ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ---- الجلب: استراتيجية Cache-First مع تحديث في الخلفية ----
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // تجاهل الطلبات من نوع POST أو الطلبات الخارجية (مثل خطوط Google Fonts) عن استراتيجية cache-first الصارمة
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          // خزّن نسخة من أي استجابة ناجحة لاستخدامها لاحقاً دون اتصال
          if (response && response.status === 200 && request.url.startsWith(self.location.origin)) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached); // بدون اتصال: استخدم الكاش إن وُجد

      // أعِد النسخة المخزّنة فوراً إن وُجدت (سرعة)، وإلا انتظر الشبكة
      return cached || networkFetch;
    })
  );
});
