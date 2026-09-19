const CACHE='rts-mobile-v3';
const APP=['/','/index.html','/manifest.webmanifest','/icon.svg','/icon-192.svg','/icon-512.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(c=>c.put(event.request,copy));
    return response;
  }).catch(()=>caches.match('/index.html'))));
});