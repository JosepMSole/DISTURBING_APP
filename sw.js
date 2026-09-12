// v4.9: UX USER/LOGROS + animación PRÓXIMA STORY por viewport; SW estable sin reinicios automáticos.
const CACHE='disturbing-pwa-v4.9.0';
const CORE=['./','./index.html','./styles.css?v=4.9.0','./app.js?v=4.9.0','./manifest.webmanifest','./data/stories.json','./data/books.json','./data/sagas.json','./data/timeline.json','./data/extras.json','./data/player.json','./data/home.json','./data/avatars.json','./data/user.json','./supabase-config.js','./assets/app-icon.png','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-180.png','./favicon.ico','https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js','https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js','https://unpkg.com/jsqr@1.4.0/dist/jsQR.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(CORE.map(x=>c.add(x)))))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))});
function networkFirst(req){return fetch(req,{cache:'no-store'}).then(r=>{if(r.ok||r.type==='opaque'){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c))}return r}).catch(()=>caches.match(req))}
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);
 if(u.origin===location.origin){
   const isData=u.pathname.includes('/data/');
   const isIcon=/\/(?:assets\/app-icon\.(?:png|ico)|icons\/icon-(?:180|192|512)\.png|favicon\.ico)$/.test(u.pathname);
   const isCore=e.request.mode==='navigate'||/\/(?:index\.html|app\.js|styles\.css|manifest\.webmanifest|sw\.js|favicon\.ico)$/.test(u.pathname);
   if(isIcon){e.respondWith(networkFirst(e.request));return;}
   if(isData||isCore){e.respondWith(networkFirst(e.request));return;}
 }
 if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){
   e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r})));return;
 }
 e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{if((r.ok||r.type==='opaque')&&u.origin===location.origin){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return r})));
});
