const APP_VERSION = '2.15.0';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const view=$('#view');
let indexData=null,currentStory=null,currentTab='read',installPrompt=null,resumeOnOpen=false,storyInitialOpen=false,lastReadingSaveAt=0,bookAssets={};
let sagasData={schema:1,sagas:[]},timelineData={schema:1,orders:{}},extrasData={schema:1,extras:[]},playerCatalogData={schema:1,tracks:[]};
let lastRandomStoryId='',randomSpinTimer=0,randomSpinRunning=false,randomSpinCurrent=null,randomSpinPool=[],tutorialActive=null,introPlayed=false,suppressNewClearOnceId='';
const unlockSecretsKey='disturbing_unlock_secrets_v2';
const readKey='disturbing_read_v2';
const coverCacheKey='disturbing_cover_cache_v1';
const storiesViewKey='disturbing_stories_view_v1';
const readProgressKey='disturbing_read_progress_v1';
const readingStateKey='disturbing_read_state_v1';
const storiesSortKey='disturbing_stories_sort_v1';
const playerStateKey='disturbing_player_state_v1';
const playerDurationKey='disturbing_player_duration_v1';
const newAcquiredKey='disturbing_new_acquired_v2';
const firstOpenedKey='disturbing_first_opened_v2';
const newBaselineKey='disturbing_new_baseline_v2';
const newV21InitKey='disturbing_new_v21_init';
const PLAYER_MANIFEST='https://raw.githubusercontent.com/JosepMSole/DisturbingPlayer/main/music/manifest.json';
const PLAYER_MUSIC_BASE='https://josepmsole.github.io/DisturbingPlayer/music/';
let playerTracks=[],playerIndex=0,playerShuffle=false,playerRepeatMode='off',playerActivated=false,playerManifestLoading=null,playerDurationLoading=null,playerWasPlayingBeforeMedia=false;
let navHistory=[],navGoingBack=false,storyTransitionBusy=false;

const store={get(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}},set(k,v){localStorage.setItem(k,JSON.stringify(v))}};

async function boot(){
  showLoading();
  try{
    const r=await fetch('./data/stories.json',{cache:'no-store'});if(!r.ok)throw new Error(`stories.json: HTTP ${r.status}`);
    indexData=await r.json();indexData.stories=(indexData.stories||[]).sort((a,b)=>new Date(b.published)-new Date(a.published));
    try{const br=await fetch('./data/books.json',{cache:'no-store'});if(br.ok)bookAssets=(await br.json()).books||{}}catch{}
    [sagasData,timelineData,extrasData,playerCatalogData]=await Promise.all([
      loadOptionalJson('./data/sagas.json',{schema:1,sagas:[]}),
      loadOptionalJson('./data/timeline.json',{schema:1,orders:{}}),
      loadOptionalJson('./data/extras.json',{schema:1,extras:[]}),
      loadOptionalJson('./data/player.json',{schema:1,tracks:[]})
    ]);
    initialiseNewState();
    bindShell();initMotionSystem();initPlayer();
    await playEntryIntro();
    if(currentHash()!=='#/home'){location.hash='#/home'}else routeFromHash();
    updateAppBadge();registerSW();
  }catch(e){view.innerHTML=`<div class="empty"><h2>No se pudieron cargar las Stories</h2><p>${escapeHtml(e.message)}</p><p>Usa el lanzador local incluido en el paquete.</p></div>`;}
}

async function loadOptionalJson(url,fallback){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)return JSON.parse(JSON.stringify(fallback));return await r.json()}catch{return JSON.parse(JSON.stringify(fallback))}}
function isStandaloneInstall(){try{return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}catch{return false}}
function isIOSInstall(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent||'') || (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
}
function updateInstallButton(){
  const btn=$('#installBtn');if(!btn)return;
  btn.classList.toggle('hidden',isStandaloneInstall());
}
function closeInstallGuide(){document.querySelector('.install-guide')?.remove()}
function showInstallGuide(kind='ios'){
  closeInstallGuide();
  const ios=kind==='ios',desktop=kind==='desktop';
  const modal=document.createElement('div');
  modal.className='install-guide';
  modal.innerHTML=`<div class="install-guide-scrim" data-install-close></div><section class="install-guide-card hud-static" role="dialog" aria-modal="true" aria-label="Instalar Disturbing Stories APP"><button class="install-guide-close" data-install-close aria-label="Cerrar">×</button><div class="eyebrow">INSTALAR APP</div><h2>Disturbing Stories APP</h2>${ios?`<p>En iPhone y iPad Apple requiere confirmar la instalación desde Safari. Solo son 3 pasos:</p><div class="install-steps"><div><b>1</b><span>Pulsa <strong>COMPARTIR</strong> <em>↥</em></span></div><div><b>2</b><span>Elige <strong>AÑADIR A PANTALLA DE INICIO</strong></span></div><div><b>3</b><span>Pulsa <strong>AÑADIR</strong></span></div></div><small>Después la app aparecerá en tu dispositivo con su icono de Disturbing Stories.</small>`:desktop?`<p>Si tu navegador permite instalación, al pulsar el botón se abrirá directamente el diálogo de instalar la app.</p><small>Si el navegador no lo muestra, usa el menú del navegador y elige <strong>Instalar app</strong>.</small>`:`<p>Abre el menú del navegador y selecciona <strong>Instalar app</strong> o <strong>Añadir a pantalla de inicio</strong>.</p>`}</section>`;
  document.body.append(modal);
  modal.querySelectorAll('[data-install-close]').forEach(el=>el.onclick=closeInstallGuide);
}
async function handleInstallApp(){
  const btn=$('#installBtn');if(!btn)return;
  if(isStandaloneInstall()){btn.classList.add('hidden');return}
  if(installPrompt){
    try{
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt=null;
      updateInstallButton();
      return;
    }catch{}
  }
  if(isIOSInstall()){
    showInstallGuide('ios');
  }else{
    const desktop=!(/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent||''));
    showInstallGuide(desktop?'desktop':'other');
  }
}

function goHomeTop(){persistCurrentReadingPosition();if(currentHash()==='#/home'){scrollTo({top:0,behavior:'smooth'});return}navigateHash('#/home');requestAnimationFrame(()=>scrollTo({top:0,behavior:'auto'}))}
function bindShell(){$('#brandBtn').onclick=goHomeTop;$('#backBtn').onclick=navigateBack;$('#toTopHeaderBtn').onclick=()=>scrollTo({top:0,behavior:'smooth'});$('#menuBtn').onclick=openDrawer;$('#closeDrawer').onclick=closeDrawer;$('#scrim').onclick=closeDrawer;$$('.nav-btn').forEach(b=>b.onclick=()=>footerGo(b.dataset.route));$$('[data-drawer-route]').forEach(b=>b.onclick=()=>{closeDrawer();if(b.dataset.drawerRoute==='home')goHomeTop();else go(b.dataset.drawerRoute)});$('#miniPlayerOpen').onclick=()=>go('player');$('#miniPrev').onclick=()=>playerStep(-1,true);$('#miniPlay').onclick=()=>playerToggle();$('#miniNext').onclick=()=>playerStep(1,true);$('#scanBtn').onclick=()=>{closeDrawer();showUnlock()};$('#installBtn').onclick=handleInstallApp;updateInstallButton();addEventListener('hashchange',routeFromHash);addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;updateInstallButton()});addEventListener('appinstalled',()=>{installPrompt=null;updateInstallButton()});addEventListener('scroll',updateProgress,{passive:true});addEventListener('pagehide',persistCurrentReadingPosition);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistCurrentReadingPosition()});addEventListener('blur',()=>setTimeout(()=>{if(currentStory&&document.activeElement?.tagName==='IFRAME')playerPauseForStoryMedia()},0));addEventListener('resize',()=>{updateInstallButton();if(routeName()==='collection')requestAnimationFrame(fitCollectionShelf)},{passive:true});}
function currentHash(){return location.hash||'#/home'}
function navigateHash(target){const cur=currentHash();if(cur===target)return;navHistory.push(cur);if(navHistory.length>5)navHistory=navHistory.slice(-5);location.hash=target}
function go(r){navigateHash(`#/${r}`)}
function footerGo(r){const target=`#/${r}`;persistCurrentReadingPosition();scrollTo({top:0,behavior:'auto'});if(currentHash()===target){routeFromHash();requestAnimationFrame(()=>scrollTo({top:0,behavior:'auto'}));return}navigateHash(target);requestAnimationFrame(()=>scrollTo({top:0,behavior:'auto'}))}
function routeFallback(){const p=currentHash().replace(/^#\//,'').split('/'),route=p[0]||'home';if(route==='story')return '#/stories';if(route==='saga')return '#/sagas';if(route==='extra')return '#/extras';if(route==='collection'&&p[1])return '#/collection';if(['sagas','timeline','random','cassettes','tapes','extras','games','micro-pesadillas'].includes(route))return '#/stories';if(route!=='home')return '#/home';return ''}
function updateBackButton(){const btn=$('#backBtn'),fallback=routeFallback();if(!btn)return;const can=navHistory.length>0||!!fallback;btn.classList.toggle('hidden',!can);btn.disabled=!can}
function navigateBack(){if(navHistory.length){const target=navHistory.pop();navGoingBack=true;location.hash=target;return}const fallback=routeFallback();if(fallback){navGoingBack=true;location.hash=fallback}}
function fiveFrameHaptic(){try{if('vibrate' in navigator)navigator.vibrate([24,26,24,26,24,26,24,26,24])}catch{}}
function playStoryEnterTransition(id,sourceEl=null){if(storyTransitionBusy){return}const target=`#/story/${encodeURIComponent(id)}`;if(matchMedia('(prefers-reduced-motion: reduce)').matches){navigateHash(target);return}storyTransitionBusy=true;fiveFrameHaptic();const shell=$('#app');let card=sourceEl&&sourceEl.nodeType===1?sourceEl:null;if(!card)card=document.querySelector(`[data-story-id="${CSS.escape(id)}"]`);if(!card&&routeName()==='home')card=$('.hero.latest-storm');card?.classList.add('story-enter-target');shell?.classList.add('story-entering');setTimeout(()=>{card?.classList.remove('story-enter-target');shell?.classList.remove('story-entering');storyTransitionBusy=false;navigateHash(target)},270)}
function storyGo(id,resume=false,sourceEl=null){if(resume){navigateHash(`#/story/${encodeURIComponent(id)}/resume`);return}playStoryEnterTransition(id,sourceEl)}
function routeFromHash(){persistCurrentReadingPosition();stopQrScanner();stopRandomSpin(false);const p=currentHash().replace(/^#\//,'').split('/'),route=p[0]||'home',storyMode=route==='story'?(p[2]||''):'',isResume=storyMode==='resume',storyTab=(!isResume&&storyMode)?decodeURIComponent(storyMode):'';if(!isResume)scrollTo({top:0,behavior:'auto'});view.classList.toggle('home-view',route==='home');setNav(route);updateBackButton();$('#toTopHeaderBtn').classList.remove('hidden');if(route==='home')return renderHome();if(route==='stories')return renderStories('all');if(route==='unlocked')return renderMyStories();if(route==='collection')return renderCollection(decodeURIComponent(p[1]||''));if(route==='player')return renderPlayer();if(route==='story')return renderStory(decodeURIComponent(p[1]||''),isResume,storyTab);if(route==='sagas')return renderSagas();if(route==='saga')return renderSaga(decodeURIComponent(p[1]||''));if(route==='timeline')return renderTimeline();if(route==='random')return renderRandom();if(route==='cassettes')return renderMediaCollection('audio');if(route==='tapes')return renderMediaCollection('video');if(route==='extras')return renderExtras();if(route==='extra')return renderExtra(decodeURIComponent(p[1]||''));if(route==='games')return renderFuturePlaceholder('GAMES','rosa');if(route==='micro-pesadillas')return renderFuturePlaceholder('MICRO-PESADILLAS','rojo-blanco');renderHome()}
function sectionIndicatorMarkup(route){
  if(route==='unlock')return `<span class="section-indicator-qr" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM17 17h3v3h-3z"/></svg></span>`;
  if(route==='home')return `<span class="section-indicator-home" aria-hidden="true">⌂</span>`;
  if(route==='unlocked')return `<span class="section-indicator-watcher" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3.2 12s3.2-5.2 8.8-5.2S20.8 12 20.8 12s-3.2 5.2-8.8 5.2S3.2 12 3.2 12Z"/><circle cx="12" cy="12" r="2.15"/><circle class="watcher-pupil" cx="12.7" cy="11.3" r=".45"/></svg></span>`;
  if(route==='collection')return `<span class="section-indicator-collection" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
  if(route==='player')return `<span class="section-indicator-player" aria-hidden="true">♫</span>`;
  if(route==='sagas'||route==='saga')return `<span class="section-indicator-saga" aria-hidden="true">◈</span>`;
  if(route==='timeline')return `<span class="section-indicator-timeline" aria-hidden="true">${timelinePortalSvg()}</span>`;
  if(route==='random')return `<span class="section-indicator-random" aria-hidden="true">◎</span>`;
  if(route==='extras'||route==='extra')return `<span class="section-indicator-extras" aria-hidden="true">＋</span>`;
  if(route==='cassettes')return `<span class="section-indicator-cassette" aria-hidden="true">${mediaIconSvg('audio')}</span>`;
  if(route==='tapes')return `<span class="section-indicator-tape" aria-hidden="true">${mediaIconSvg('video')}</span>`;
  if(route==='games')return `<span class="section-indicator-games" aria-hidden="true">${gamepadPortalSvg()}</span>`;
  if(route==='micro-pesadillas')return `<span class="section-indicator-micro" aria-hidden="true"><i class="nightmare-diamond"></i></span>`;
  if(route==='stories'||route==='story')return `<span class="section-indicator-grid" aria-hidden="true">${'<i></i>'.repeat(9)}</span>`;
  return''
}
function updateSectionIndicator(route){const el=$('#sectionIndicator');if(!el)return;el.innerHTML=sectionIndicatorMarkup(route);el.dataset.section=route||'';el.classList.toggle('hidden',!el.innerHTML)}
function setNav(route){const storyRoutes=new Set(['stories','story','sagas','saga','timeline','random','cassettes','tapes','extras','extra','games','micro-pesadillas']);$$('.nav-btn').forEach(b=>b.classList.toggle('active',(b.dataset.route==='stories'&&storyRoutes.has(route))||b.dataset.route===route));updateSectionIndicator(route);updateMiniPlayerVisibility(route)}
function showLoading(){view.innerHTML='';view.append($('#loadingTemplate').content.cloneNode(true))}
function secretMap(){return store.get(unlockSecretsKey,{})}function coverCache(){return store.get(coverCacheKey,{})}
function readList(){return store.get(readKey,[])}function isRead(id){return readList().includes(id)}function readProgressMap(){return store.get(readProgressKey,{})}
function readingStateMap(){return store.get(readingStateKey,{})}
function storyProgress(id){if(isRead(id))return 1;const state=readingStateMap()[id];if(state&&Number.isFinite(Number(state.progress)))return Math.max(0,Math.min(1,Number(state.progress)));return Math.max(0,Math.min(1,Number(readProgressMap()[id]||0)))}
function accessibleStory(s){return s.access==='public'||!isLocked(s)}
function inProgressStories(){const states=readingStateMap();return (indexData?.stories||[]).filter(s=>accessibleStory(s)&&!isRead(s.id)&&storyProgress(s.id)>.015).sort((a,b)=>Number(states[b.id]?.updated||0)-Number(states[a.id]?.updated||0)||new Date(b.published)-new Date(a.published))}
function latestInProgress(){return inProgressStories()[0]||null}
function publishedReadCount(){const ids=new Set((indexData?.stories||[]).map(s=>s.id));return readList().filter(id=>ids.has(id)).length}
function availableStoryCount(){return (indexData?.stories||[]).filter(accessibleStory).length}
function availableUnreadCount(){return (indexData?.stories||[]).filter(s=>accessibleStory(s)&&!isRead(s.id)).length}
function lockedExclusiveCount(){return (indexData?.stories||[]).filter(s=>s.access==='exclusive'&&isLocked(s)).length}
function acquiredMap(){return store.get(newAcquiredKey,{})}
function openedMap(){return store.get(firstOpenedKey,{})}
function initialiseNewState(){
  const acquired=acquiredMap(),opened=openedMap(),now=Date.now(),baseline=store.get(newBaselineKey,false),latest=indexData?.stories?.[0];
  if(!baseline){for(const st of indexData?.stories||[]){if(accessibleStory(st)||st.id===latest?.id){acquired[st.id]=acquired[st.id]||now;if(st.id!==latest?.id&&accessibleStory(st))opened[st.id]=opened[st.id]||now}}store.set(newBaselineKey,true)}
  else{for(const st of indexData?.stories||[]){if((st.access==='public'||(st.access==='exclusive'&&!isLocked(st))||st.id===latest?.id)&&!acquired[st.id])acquired[st.id]=now}}
  if(!store.get(newV21InitKey,false)){if(latest){acquired[latest.id]=acquired[latest.id]||now;delete opened[latest.id]}store.set(newV21InitKey,true)}
  store.set(newAcquiredKey,acquired);store.set(firstOpenedKey,opened)
}
function markStoryAcquired(id,forceNew=false){const a=acquiredMap(),o=openedMap();if(!a[id])a[id]=Date.now();if(forceNew&&o[id])delete o[id];store.set(newAcquiredKey,a);store.set(firstOpenedKey,o)}
function markStoryOpened(id){const st=indexData?.stories?.find(x=>x.id===id);if(!st)return;const latest=indexData?.stories?.[0];if(!accessibleStory(st)&&st.id!==latest?.id)return;const a=acquiredMap(),o=openedMap();if(!a[id])a[id]=Date.now();/* v2.5: una exclusiva recién desbloqueada conserva NEW hasta alcanzar el 25% de lectura. */if(st.access==='exclusive'&&accessibleStory(st)&&storyProgress(id)<.25){store.set(newAcquiredKey,a);return}if(!o[id])o[id]=Date.now();store.set(newAcquiredKey,a);store.set(firstOpenedKey,o)}
function isNewStory(s){if(!s)return false;const latest=indexData?.stories?.[0],a=acquiredMap(),o=openedMap();if(s.access==='exclusive'&&accessibleStory(s)&&storyProgress(s.id)>=.25)return false;if(s.id===latest?.id)return !!a[s.id]&&!o[s.id];if(!accessibleStory(s))return false;return !!a[s.id]&&!o[s.id]}
function newStoryBadge(s){return isNewStory(s)?`<span class="new-story-badge ${s?.access==='exclusive'?'new-has-lock':''}">NEW</span>`:''}
async function updateAppBadge(){const n=availableUnreadCount();try{if(isIOSInstall()&&'Notification' in window&&Notification.permission!=='granted')return n;if(n>0&&typeof navigator.setAppBadge==='function')await navigator.setAppBadge(n);else if(n===0&&typeof navigator.clearAppBadge==='function')await navigator.clearAppBadge()}catch{}return n}
function badgePermissionPanel(){if(!isIOSInstall()||!isStandaloneInstall()||!('Notification' in window)||Notification.permission==='granted')return'';return `<div class="badge-permission-panel"><strong>BADGE DEL ICONO</strong><span>Activa el permiso para mostrar en el icono las Stories pendientes.</span><button id="enableAppBadge" class="secondary-btn">ACTIVAR BADGE</button></div>`}
async function requestBadgePermission(){const el=$('#enableAppBadge');if(el)el.disabled=true;try{const p=await Notification.requestPermission();if(p==='granted'){await updateAppBadge();document.querySelector('.badge-permission-panel')?.remove();toast('Badge del icono activado')}else toast('Permiso de badge no concedido')}catch{toast('No se pudo solicitar el permiso')}finally{if(el)el.disabled=false}}

function exclusiveState(s){if(s?.access!=='exclusive')return'';return isLocked(s)?'locked':'unlocked'}
function lockSvg(open=false){return open?`<svg class="lock-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 10V7.5a4.2 4.2 0 0 1 7.8-2.2"/><rect x="5.2" y="10" width="13.6" height="10.2" rx="2.2"/><circle cx="12" cy="15.1" r="1.15"/></svg>`:`<svg class="lock-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.7 10V7.4a4.3 4.3 0 0 1 8.6 0V10"/><rect x="5.2" y="10" width="13.6" height="10.2" rx="2.2"/><circle cx="12" cy="15.1" r="1.15"/></svg>`}
function exclusiveBadge(s,kind='cover'){if(s?.access!=='exclusive')return'';const state=exclusiveState(s),open=state==='unlocked';return `<span class="ex-badge ex-${state} ${kind==='inline'?'ex-inline':''}" title="Exclusiva ${open?'desbloqueada':'bloqueada'}" aria-label="Exclusiva ${open?'desbloqueada':'bloqueada'}">${lockSvg(open)}</span>`}
function readCornerBadge(s){return isRead(s?.id)?'<span class="read-corner" aria-hidden="true"></span>':''}
function pct(n){return `${Math.round(Math.max(0,Math.min(1,Number(n)||0))*100)}%`}
function normalizedText(v=''){return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function storyFeatures(s){
  const set=new Set(s?.features||[]),labels=(s?.tabLabels||[]).map(x=>String(x).toLowerCase());
  if(labels.some(x=>/(audio|escuchar|listen)/.test(x)))set.add('audio');
  if(labels.some(x=>/(video|vídeo|corto|film)/.test(x)))set.add('video');
  return set
}
function storyHasFeature(s,f){return storyFeatures(s).has(f)}
function mediaIconSvg(type){if(type==='audio')return `<svg class="media-feature-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="12" width="4" height="7" rx="1.5"/><rect x="17" y="12" width="4" height="7" rx="1.5"/></svg>`;return `<svg class="media-feature-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg>`}
function storyMediaBadges(s){const badges=[];if(storyHasFeature(s,'audio'))badges.push(`<span class="media-badge media-audio" title="Incluye audio" aria-label="Incluye audio">${mediaIconSvg('audio')}</span>`);if(storyHasFeature(s,'video'))badges.push(`<span class="media-badge media-video" title="Incluye vídeo" aria-label="Incluye vídeo">${mediaIconSvg('video')}</span>`);return badges.length?`<span class="story-media-badges ${s?.access==='exclusive'?'has-exclusive':''}">${badges.join('')}</span>`:''}
function storySortBadge(s,sortMode=''){let value='';if(sortMode==='id-asc'||sortMode==='id-desc')value=String(s.id||'').padStart(3,'0');else if(sortMode==='year-asc'||sortMode==='year-desc')value=String(s.year||'—');else if(sortMode==='readtime-asc'||sortMode==='readtime-desc')value=storyReadTimeText(s)||'—';if(!value||sortMode==='title-asc'||sortMode==='published-desc'||sortMode==='published-asc')return'';const classes=['sort-badge'];if(s?.access==='exclusive')classes.push('sort-has-lock');if(isNewStory(s))classes.push('sort-has-new');return `<span class="${classes.join(' ')}" aria-hidden="true">${escapeHtml(value)}</span>`}
function bookFeatureSummary(stories,interactive=false){const audio=stories.filter(s=>storyHasFeature(s,'audio')).length,video=stories.filter(s=>storyHasFeature(s,'video')).length,exclusive=stories.filter(s=>s.access==='exclusive').length;const a=interactive?`<button class="book-feature-count audio clickable" type="button" data-book-feature-jump="audio" title="Mostrar ${audio} Stories con audio" aria-label="Mostrar ${audio} Stories con audio">${mediaIconSvg('audio')}<b>${audio}</b></button>`:`<span class="book-feature-count audio" title="${audio} audios">${mediaIconSvg('audio')}<b>${audio}</b></span>`;const v=interactive?`<button class="book-feature-count video clickable" type="button" data-book-feature-jump="video" title="Mostrar ${video} Stories con vídeo" aria-label="Mostrar ${video} Stories con vídeo">${mediaIconSvg('video')}<b>${video}</b></button>`:`<span class="book-feature-count video" title="${video} vídeos">${mediaIconSvg('video')}<b>${video}</b></span>`;const x=interactive?`<button class="book-feature-count exclusive clickable" type="button" data-book-feature-jump="exclusive" title="Mostrar ${exclusive} Stories exclusivas" aria-label="Mostrar ${exclusive} Stories exclusivas">${lockSvg(false)}<b>${exclusive}</b></button>`:`<span class="book-feature-count exclusive" title="${exclusive} exclusivas">${lockSvg(false)}<b>${exclusive}</b></span>`;return `<div class="book-feature-counts" aria-label="Contenido publicado de este libro">${a}${v}${x}</div>`}

function isLocked(s){return s.access==='exclusive'&&!secretMap()[s.id]}
function displayCover(s){if(!s)return'';return s.cover||coverCache()[s.id]||''}
function heroMedia(s){const image=displayFeatured(s);return `<div class="hero-media hero-story-media">${image?`<img class="hero-backdrop" src="${escAttr(image)}" alt="" aria-hidden="true" loading="eager" referrerpolicy="no-referrer"><img class="hero-rgb-ghost hero-rgb-red" src="${escAttr(image)}" alt="" aria-hidden="true" loading="eager" referrerpolicy="no-referrer"><img class="hero-rgb-ghost hero-rgb-cyan" src="${escAttr(image)}" alt="" aria-hidden="true" loading="eager" referrerpolicy="no-referrer"><img class="hero-main-image" src="${escAttr(image)}" alt="" loading="eager" referrerpolicy="no-referrer">`:`<div class="hero-placeholder">${escapeHtml(s.id||'')}</div>`}${newStoryBadge(s)}${exclusiveBadge(s,'cover')}${storyMediaBadges(s)}</div>`}
function displayFeatured(s){if(!s)return'';return s.featuredImage||displayCover(s)||''}
function storyFeaturedMedia(s,locked=false){const image=locked?displayCover(s):displayFeatured(s);return `<div class="story-featured">${image?`<img src="${escAttr(image)}" alt="${escAttr(s.title||'')}" loading="eager" decoding="async" referrerpolicy="no-referrer">`:`<div class="story-featured-placeholder">${escapeHtml(s.id||'')}</div>`}${newStoryBadge(s)}${locked?'':exclusiveBadge(s,'cover')}${storyMediaBadges(s)}</div>`}

function renderHome(){
  currentStory=null;
  const latest=indexData.stories[0];
  if(!latest){view.innerHTML='<div class="empty">Todavía no hay Stories publicadas.</div>';return}
  const reading=latestInProgress(),readCount=publishedReadCount(),total=indexData.stories.length,global=total?readCount/total:0;
  const continueCover=reading?displayCover(reading):'',continueHtml=reading?`<section class="home-continue home-continue-v21"><div class="home-continue-cover story-thumb-wrap">${continueCover?`<img src="${escAttr(continueCover)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span>${escapeHtml(reading.id)}</span>`}${exclusiveBadge(reading,'cover')}${storyMediaBadges(reading)}</div><div class="home-continue-copy"><div class="eyebrow">Continuar leyendo</div><strong>STORY ${escapeHtml(reading.id)} · ${escapeHtml(reading.title)}</strong><div class="mini-progress"><span style="width:${pct(storyProgress(reading.id))}"></span></div><small>${pct(storyProgress(reading.id))}</small></div><button id="continueReading" class="continue-btn">CONTINUAR</button></section>`:'';
  view.innerHTML=`<section class="hero latest-storm">${heroMedia(latest)}<div class="home-signal-fx" aria-hidden="true"><span class="signal-darken"></span><span class="signal-scanlines"></span><span class="signal-noise"></span><span class="signal-tracking"></span><span class="signal-ghost signal-ghost-red"></span><span class="signal-ghost signal-ghost-cold"></span><span class="signal-slice signal-slice-a"></span><span class="signal-slice signal-slice-b"></span><span class="signal-red-pulse"></span><span class="signal-vignette"></span></div><div class="hero-content"><div class="eyebrow">ÚLTIMA PUBLICACIÓN · ${formatDate(latest.published)} · #${escapeHtml(latest.id)}</div><h1>${escapeHtml(latest.title)}</h1><div class="meta-row">${latest.access==='exclusive'?'<span class="pill red">EXCLUSIVA</span>':'<span class="pill">GRATIS</span>'}${latest.readTime?`<span class="pill">${escapeHtml(latest.readTime)} min</span>`:''}${isRead(latest.id)?'<span class="pill read-pill">✓ LEÍDA</span>':''}</div><button class="cta" id="openLatest">${isLocked(latest)?'VER STORY':'ENTRAR'}</button></div></section>${continueHtml}<section class="home-progress"><div class="home-progress-copy"><div class="eyebrow">Tu progreso</div><strong>${readCount} / ${total} STORIES LEÍDAS</strong></div><div class="collection-progress"><span style="width:${pct(global)}"></span></div><button id="openMyStories" class="link-btn">VER MIS STORIES ›</button></section><section class="section home-previous"><div class="section-title"><h2>Publicadas anteriormente</h2></div><div class="story-list">${indexData.stories.slice(1,3).map(storyCard).join('')}</div><button id="openAllStories" class="cta secondary-home-cta">ACCEDE A TODAS LAS STORIES</button></section>`;
  $('#openLatest').onclick=e=>storyGo(latest.id,false,$('.hero.latest-storm')||e.currentTarget);
  $('#openMyStories').onclick=()=>go('unlocked');
  const allBtn=$('#openAllStories');if(allBtn)allBtn.onclick=()=>go('stories');
  if(reading)$('#continueReading').onclick=()=>storyGo(reading.id,true);
  bindStoryCards();bindBrokenImages();
}
function renderStories(initial='all'){
  currentStory=null;
  const savedView=store.get(storiesViewKey,'covers'),validViews=['covers','grid','list'];
  let viewMode=validViews.includes(savedView)?savedView:'covers',currentFilter=initial,search='',sortMode='published-desc',feature='all',category='all',book='all';
  const categories=[...new Set(indexData.stories.flatMap(s=>s.categories||[]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'es',{sensitivity:'base'}));
  const books=[...new Set(indexData.stories.map(s=>String(s.book||'').trim()).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  const readCount=publishedReadCount(),available=availableStoryCount(),total=indexData.stories.length,explorer=storiesExplorerHtml();
  view.innerHTML=`<section class="section stories-section stories-v22-enter"><div class="section-title"><div><div class="eyebrow">TODAS LAS</div><h1>Stories</h1></div></div><div class="library-stats" aria-label="Estado de la biblioteca"><button type="button" data-library-stat="read"><strong>${readCount}</strong><span>LEÍDAS</span></button><button type="button" data-library-stat="available"><strong>${available}</strong><span>DISPONIBLES PARA TI</span></button><button type="button" data-library-stat="all"><strong>${total}</strong><span>PUBLICADAS</span></button></div>${explorer}<div class="library-controls"><label class="story-search"><span>⌕</span><input id="storySearch" type="search" placeholder="Buscar título o número…" autocomplete="off"></label><select id="storySort" class="story-select" aria-label="Ordenar Stories"><option value="published-desc">Más recientes</option><option value="published-asc">Más antiguas</option><option value="id-asc">Número · 001 → 300</option><option value="id-desc">Número · 300 → 001</option><option value="year-asc">Año historia · menor</option><option value="year-desc">Año historia · mayor</option><option value="readtime-asc">Tiempo de lectura · menor → mayor</option><option value="readtime-desc">Tiempo de lectura · mayor → menor</option><option value="title-asc">Título · A → Z</option></select></div><div class="story-control-strip"><select id="statusFilter" class="story-select" aria-label="Filtrar por estado"><option value="all">Todas las Stories</option><option value="public">Gratis</option><option value="exclusive">Exclusivas</option><option value="unlocked">Desbloqueadas</option><option value="read">Leídas</option><option value="unread">No leídas</option></select><button id="toggleAdvancedFilters" class="advanced-toggle" type="button" aria-expanded="false">MÁS FILTROS ▾</button><div class="view-modes" role="group" aria-label="Modo de visualización"><button class="view-mode" data-view="covers" title="Solo portadas" aria-label="Solo portadas">▦</button><button class="view-mode" data-view="grid" title="Mosaico" aria-label="Mosaico">▤</button><button class="view-mode" data-view="list" title="Lista" aria-label="Lista">☷</button></div></div><div id="advancedFilters" class="advanced-filters hidden"><select id="categoryFilter" class="story-select" aria-label="Filtrar por categoría"><option value="all">Todas las categorías</option>${categories.map(c=>`<option value="${escAttr(c)}">${escapeHtml(c)}</option>`).join('')}</select><select id="bookFilter" class="story-select" aria-label="Filtrar por libro"><option value="all">Todos los libros</option>${books.map(b=>`<option value="${escAttr(b)}">Libro ${escapeHtml(b)}</option>`).join('')}</select><select id="featureFilter" class="story-select" aria-label="Filtrar por contenido"><option value="all">Todo el contenido</option><option value="audio">Con audio</option><option value="video">Con vídeo</option><option value="extra">Con extras</option></select></div><div id="storiesCount" class="results-count"></div><div id="storiesList"></div></section>`;
  $('#storySort').value=sortMode;$('#statusFilter').value=currentFilter;
  const draw=()=>{
    $$('.view-mode').forEach(b=>b.classList.toggle('active',b.dataset.view===viewMode));
    const read=readList(),secrets=secretMap(),q=normalizedText(search.trim());let a=[...indexData.stories];
    if(currentFilter==='public')a=a.filter(s=>s.access==='public');
    if(currentFilter==='exclusive')a=a.filter(s=>s.access==='exclusive');
    if(currentFilter==='unlocked')a=a.filter(s=>s.access==='exclusive'&&secrets[s.id]);
    if(currentFilter==='read')a=a.filter(s=>read.includes(s.id));
    if(currentFilter==='unread')a=a.filter(s=>!read.includes(s.id));
    if(feature!=='all')a=a.filter(s=>storyHasFeature(s,feature));
    if(category!=='all')a=a.filter(s=>(s.categories||[]).includes(category));
    if(book!=='all')a=a.filter(s=>String(s.book||'')===book);
    if(q)a=a.filter(s=>normalizedText(`${s.id} ${s.title||''} ${(s.categories||[]).join(' ')} ${s.book||''} ${s.year||''}`).includes(q));
    a.sort(storySorter(sortMode));
    const list=$('#storiesList');list.className=`stories-view stories-view-${viewMode}`;list.innerHTML=a.length?a.map(s=>storyCard(s,viewMode,sortMode)).join(''):'<div class="empty">No hay Stories con estos criterios.</div>';
    $('#storiesCount').textContent=`${a.length} ${a.length===1?'Story':'Stories'}`;
    bindStoryCards();bindBrokenImages();
  };
  $('#storySearch').oninput=e=>{search=e.target.value;draw()};
  $('#storySort').onchange=e=>{sortMode=e.target.value;draw()};
  $('#statusFilter').onchange=e=>{currentFilter=e.target.value;draw()};
  $('#categoryFilter').onchange=e=>{category=e.target.value;draw()};
  $('#bookFilter').onchange=e=>{book=e.target.value;draw()};
  $('#featureFilter').onchange=e=>{feature=e.target.value;draw()};
  $('#toggleAdvancedFilters').onclick=()=>{const box=$('#advancedFilters'),open=box.classList.toggle('hidden')===false;$('#toggleAdvancedFilters').setAttribute('aria-expanded',String(open));$('#toggleAdvancedFilters').textContent=open?'MENOS FILTROS ▴':'MÁS FILTROS ▾'};
  $$('.view-mode').forEach(b=>b.onclick=()=>{viewMode=b.dataset.view;store.set(storiesViewKey,viewMode);draw()});
  const scrollStoryFiltersToHeader=()=>requestAnimationFrame(()=>{const bar=$('.story-control-strip');if(!bar)return;const headerH=$('.topbar')?.getBoundingClientRect().height||70;const y=Math.max(0,scrollY+bar.getBoundingClientRect().top-headerH-2);scrollTo({top:y,behavior:'smooth'})});
  $$('[data-library-stat]').forEach(btn=>btn.onclick=()=>{const mode=btn.dataset.libraryStat;if(mode==='available'){sessionStorage.setItem('disturbing_my_jump_v26','unread');go('unlocked');return}currentFilter=mode==='read'?'read':'all';$('#statusFilter').value=currentFilter;draw();scrollStoryFiltersToHeader()});
  bindStoryExplorer();draw();requestAnimationFrame(()=>requestAnimationFrame(()=>view.querySelector('.stories-section')?.classList.add('stories-v22-on')));
}
function storySorter(mode){
  if(mode==='published-asc')return(a,b)=>new Date(a.published)-new Date(b.published);
  if(mode==='id-asc')return(a,b)=>Number(a.id)-Number(b.id);
  if(mode==='id-desc')return(a,b)=>Number(b.id)-Number(a.id);
  if(mode==='year-asc')return(a,b)=>(Number(a.year)||999999)-(Number(b.year)||999999)||Number(a.id)-Number(b.id);
  if(mode==='year-desc')return(a,b)=>(Number(b.year)||-999999)-(Number(a.year)||-999999)||Number(a.id)-Number(b.id);
  if(mode==='readtime-asc')return(a,b)=>storyReadMinutes(a)-storyReadMinutes(b)||Number(a.id)-Number(b.id);
  if(mode==='readtime-desc')return(a,b)=>storyReadMinutes(b)-storyReadMinutes(a)||Number(a.id)-Number(b.id);
  if(mode==='title-asc')return(a,b)=>String(a.title||'').localeCompare(String(b.title||''),'es',{sensitivity:'base'});
  return(a,b)=>new Date(b.published)-new Date(a.published);
}function storyReadMinutes(s){const raw=s?.readTimeMinutes??s?.readTime??0;if(typeof raw==='number')return Math.max(0,raw);const m=String(raw||'').match(/[\d.,]+/);return m?Math.max(0,Number(m[0].replace(',','.'))||0):0}
function storyReadTimeText(s){const n=storyReadMinutes(s);return n?`${Number.isInteger(n)?n:n.toFixed(1)} MIN`:''}
function storyReadTimeBadge(s){const t=storyReadTimeText(s);return t?`<span class="story-read-time-badge" title="Tiempo de lectura" aria-label="Tiempo de lectura ${escAttr(t)}">◷ ${escapeHtml(t)}</span>`:''}

function renderMyStories(){
  currentStory=null;
  scrollTo({top:0,behavior:'auto'});requestAnimationFrame(()=>scrollTo({top:0,behavior:'auto'}));
  const readIds=new Set(readList()),secrets=secretMap(),progress=inProgressStories(),readCount=publishedReadCount(),available=availableStoryCount(),unlocked=indexData.stories.filter(s=>s.access==='exclusive'&&secrets[s.id]),unreadAccessible=indexData.stories.filter(s=>accessibleStory(s)&&!readIds.has(s.id)),blocked=indexData.stories.filter(s=>s.access==='exclusive'&&!secrets[s.id]),qrPending=blocked.length;
  view.innerHTML=`<section class="section my-stories"><div class="section-title my-stories-title"><div><div class="eyebrow my-stories-eyebrow">Tu colección personal</div><h1>Mis Stories</h1></div><button class="unread-callout stat-action" type="button" data-my-jump="unread"><strong><b>${unreadAccessible.length}</b> Stories todavía por leer</strong></button></div>${badgePermissionPanel()}<button class="progress-dashboard stat-action" type="button" data-my-jump="read"><div class="progress-big"><strong>${readCount}</strong><span class="progress-denom">de ${available}</span><em>DISPONIBLES LEÍDAS</em></div><div class="progress-side"><div class="collection-progress large"><span style="width:${pct(available?readCount/available:0)}"></span></div><p>${readCount===available&&available?'✓ Has leído todas las Stories que tienes disponibles.':'Completa las Stories que tienes disponibles y haz crecer tu colección.'}</p></div></button><div class="personal-stats"><div class="stat-action" role="button" tabindex="0" data-my-jump="progress"><strong>${progress.length}</strong><span>EN PROGRESO</span></div><div class="stat-action" role="button" tabindex="0" data-my-jump="unlocked"><strong>${unlocked.length}</strong><span>DESBLOQUEADAS</span></div><div class="stat-action" role="button" tabindex="0" data-my-jump="blocked"><strong>${qrPending}</strong><span>SIN QR SCAN</span></div></div>${progress.length?`<section class="my-group my-continue-group" id="myContinueGroup"><div class="section-title compact"><h2>Continuar leyendo</h2><small>${progress.length}</small></div><div class="continue-list">${progress.slice(0,6).map(continueCard).join('')}</div></section>`:''}<section class="my-group my-results-group" id="myResultsGroup"><div class="my-tabs" id="myFilterBar"><button class="my-filter" data-my="read">LEÍDAS</button><button class="my-filter" data-my="unlocked">DESBLOQUEADAS</button><button class="my-filter active" data-my="unread">NO LEÍDAS</button><button class="my-filter" data-my="blocked">BLOQUEADAS</button></div><div id="myStoriesGrid" class="stories-view stories-view-covers"></div></section></section>`;
  const draw=(mode='unread')=>{ $$('.my-filter').forEach(b=>b.classList.toggle('active',b.dataset.my===mode));let a=[];if(mode==='read')a=indexData.stories.filter(s=>accessibleStory(s)&&readIds.has(s.id));if(mode==='unlocked')a=unlocked;if(mode==='unread')a=unreadAccessible;if(mode==='blocked')a=blocked;a.sort((x,y)=>new Date(y.published)-new Date(x.published));$('#myStoriesGrid').innerHTML=a.length?a.map(s=>storyCard(s,'covers')).join(''):'<div class="empty my-empty">Todavía no hay Stories en esta sección.</div>';bindStoryCards();bindBrokenImages();};
  const scrollResultsToHeader=()=>requestAnimationFrame(()=>{const bar=$('#myFilterBar');if(!bar)return;const headerH=$('.topbar')?.getBoundingClientRect().height||70;const y=Math.max(0,scrollY+bar.getBoundingClientRect().top-headerH-2);scrollTo({top:y,behavior:'smooth'})});
  const jumpToResults=mode=>{draw(mode);scrollResultsToHeader()};
  $$('.my-filter').forEach(b=>b.onclick=()=>draw(b.dataset.my));
  $$('[data-my-jump]').forEach(el=>{const run=()=>{const mode=el.dataset.myJump;if(mode==='progress'){const c=$('#myContinueGroup');if(c){c.scrollIntoView({behavior:'smooth',block:'center'});requestAnimationFrame(()=>{c.querySelectorAll('.continue-card').forEach((card,i)=>{card.classList.remove('progress-jump-flash');void card.offsetWidth;setTimeout(()=>card.classList.add('progress-jump-flash'),i*55);setTimeout(()=>card.classList.remove('progress-jump-flash'),1600+i*55)})})}return}jumpToResults(mode)};el.onclick=run;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();run()}}});
  $$('[data-resume-id]').forEach(b=>b.onclick=()=>storyGo(b.dataset.resumeId,true));
  const badgeBtn=$('#enableAppBadge');if(badgeBtn)badgeBtn.onclick=requestBadgePermission;
  const externalJump=sessionStorage.getItem('disturbing_my_jump_v26');if(externalJump){sessionStorage.removeItem('disturbing_my_jump_v26');draw(externalJump);scrollResultsToHeader()}else draw('unread');bindBrokenImages();
}
function continueCard(s){const pr=storyProgress(s.id),cover=displayCover(s);return `<article class="continue-card"><button class="continue-cover story-thumb-wrap" data-resume-id="${escAttr(s.id)}">${cover?`<img src="${escAttr(cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span>${escapeHtml(s.id)}</span>`}</button><div class="continue-copy"><div class="story-number">STORY ${escapeHtml(s.id)}</div><strong>${escapeHtml(s.title)}</strong><div class="continue-inline-icons">${exclusiveBadge(s,'inline')}${storyMediaBadges(s)}</div><div class="mini-progress"><span style="width:${pct(pr)}"></span></div><small>${pct(pr)}</small></div><button class="resume-arrow" data-resume-id="${escAttr(s.id)}" aria-label="Continuar Story ${escAttr(s.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button></article>`}

function storyCard(s,mode='list',sortMode=''){
  const locked=isLocked(s),read=isRead(s.id),cover=displayCover(s),pr=storyProgress(s.id),ex=exclusiveBadge(s,'cover'),media=storyMediaBadges(s),sortBadge=storySortBadge(s,sortMode),readCorner=readCornerBadge(s),fresh=newStoryBadge(s),rt=storyReadTimeText(s),rtBadge=storyReadTimeBadge(s);
  const image=cover?`<img class="story-thumb" src="${escAttr(cover)}" alt="${escAttr(s.title||('Story '+s.id))}" loading="lazy" referrerpolicy="no-referrer">`:`<div class="story-thumb story-thumb-placeholder">${escapeHtml(s.id)}</div>`;
  const thumb=`<div class="story-thumb-wrap">${image}${readCorner}${sortBadge}${fresh}${ex}${media}${rtBadge}</div>`;
  if(mode==='covers')return `<article class="story-cover-card" data-story-id="${escAttr(s.id)}" aria-label="Story ${escAttr(s.id)} · ${escAttr(s.title||'')}">${image}${readCorner}${sortBadge}${fresh}${read?'<span class="cover-read">✓ LEÍDA</span>':pr>.015?`<span class="cover-progress">${pct(pr)}</span>`:''}${ex}${media}${rtBadge}</article>`;
  if(mode==='grid')return `<article class="story-grid-card" data-story-id="${escAttr(s.id)}"><div class="story-grid-poster">${image}${readCorner}${sortBadge}${fresh}${ex}${media}${rtBadge}</div><div class="story-grid-copy"><div class="story-number">STORY ${escapeHtml(s.id)}</div><h3>${escapeHtml(s.title)}</h3><p>${s.access==='exclusive'?(locked?'EXCLUSIVA · BLOQUEADA':'EXCLUSIVA · DESBLOQUEADA'):'GRATIS'}${read?' · LEÍDA':''}</p></div></article>`;
  return `<article class="story-card" data-story-id="${escAttr(s.id)}">${thumb}<div class="story-copy"><div class="story-number">STORY ${escapeHtml(s.id)} · ${formatDate(s.published)}</div><h3>${escapeHtml(s.title)}</h3><p>${s.access==='exclusive'?(locked?'Exclusiva · bloqueada':'Exclusiva · desbloqueada'):'Gratis'}${read?' · Leída':''}</p></div><div class="story-state">${read?'✓':'›'}</div></article>`;
}
function bindStoryCards(){$$('[data-story-id]').forEach(el=>el.onclick=e=>storyGo(el.dataset.storyId,false,e.currentTarget))}

function bookAsset(book){const k=String(Number(book)||book);return bookAssets?.[k]||{}}
function bookLabel(book){return `Book#${Number(book)||book}`}
function forcePageTop(){try{history.scrollRestoration='manual'}catch{};document.documentElement.scrollTop=0;document.body.scrollTop=0;scrollTo({top:0,left:0,behavior:'auto'});requestAnimationFrame(()=>{document.documentElement.scrollTop=0;document.body.scrollTop=0;scrollTo({top:0,left:0,behavior:'auto'});setTimeout(()=>scrollTo({top:0,left:0,behavior:'auto'}),80)})}
function fitCollectionShelf(){
  const shelf=$('.book-shelf');if(!shelf)return;const items=[...shelf.querySelectorAll('.shelf-book')];if(!items.length)return;
  const target=Math.max(1,shelf.getBoundingClientRect().width),maxH=Math.min(430,Math.max(270,innerHeight*.54));
  const ratios=items.map(item=>{const img=item.querySelector('img');if(img){if(!img.complete||!img.naturalHeight){img.addEventListener('load',fitCollectionShelf,{once:true});return .066}return Math.max(.025,Math.min(.18,img.naturalWidth/img.naturalHeight))}return .075});
  const sum=ratios.reduce((a,b)=>a+b,0),fitH=Math.max(96,target/Math.max(.01,sum)),h=Math.min(maxH,fitH);
  shelf.style.setProperty('--shelf-h',`${Math.round(h)}px`);shelf.style.gap='0px';
}
function renderCollection(bookId=''){
  currentStory=null;scrollTo({top:0,behavior:'auto'});
  const published=indexData.stories||[],readIds=new Set(readList());
  const books=new Map();for(const st of published){const raw=String(st.book||'').trim(),b=raw&&Number(raw)?String(Number(raw)):raw;if(!b)continue;if(!books.has(b))books.set(b,[]);books.get(b).push(st)}
  const ordered=[...books.entries()].sort((a,b)=>Number(a[0])-Number(b[0]));
  if(bookId&&books.has(bookId)){
    const stories=[...books.get(bookId)].sort((a,b)=>new Date(b.published)-new Date(a.published)),read=stories.filter(s=>readIds.has(s.id)).length,available=stories.filter(accessibleStory).length,asset=bookAsset(bookId),hasAudio=stories.some(s=>storyHasFeature(s,'audio')),hasVideo=stories.some(s=>storyHasFeature(s,'video')),hasExclusive=stories.some(s=>s.access==='exclusive');
    const covers=[asset.front&&`<figure class="book-cover-side"><img class="book-product-front" src="${escAttr(asset.front)}" alt="Portada ${escAttr(bookLabel(bookId))}"><figcaption>PORTADA</figcaption></figure>`,asset.back&&`<figure class="book-cover-side"><img class="book-product-back" src="${escAttr(asset.back)}" alt="Contraportada ${escAttr(bookLabel(bookId))}"><figcaption>CONTRAPORTADA</figcaption></figure>`].filter(Boolean).join('');
    view.innerHTML=`<section class="section collection-section"><button class="collection-back" id="collectionBack">‹ COLECCIÓN</button><div class="book-detail-head"><div><div class="eyebrow">Tu colección</div><div class="book-detail-title-row"><h1>${escapeHtml(bookLabel(bookId))}</h1>${bookFeatureSummary(stories,true)}</div>${asset.pages?`<div class="book-pages-detail">${escapeHtml(asset.pages)} PÁGINAS</div>`:''}</div>${covers?`<div class="book-cover-spread ${asset.back?'':'single'}">${covers}</div>`:''}</div>${asset.amazon?`<a class="amazon-buy-btn" href="${escAttr(asset.amazon)}" target="_blank" rel="noopener noreferrer"><span class="amazon-buy-copy">COMPRAR EN <span class="amazon-wordmark">AMAZON</span></span></a>`:''}<div class="book-detail-stats"><div><strong>${read}</strong><span>LEÍDAS</span></div><div><strong>${available}</strong><span>DISPONIBLES</span></div><div><strong>${stories.length}</strong><span>PUBLICADAS</span></div></div><div class="collection-progress large"><span style="width:${pct(stories.length?read/stories.length:0)}"></span></div><div class="book-story-filters"><button class="book-story-filter active" data-book-feature="all">TODAS</button><button class="book-story-filter" data-book-feature="audio">CON AUDIO</button><button class="book-story-filter" data-book-feature="video">CON VÍDEO</button><button class="book-story-filter" data-book-feature="exclusive">EXCLUSIVAS</button></div><div id="bookStoriesGrid" class="stories-view stories-view-covers collection-story-grid"></div></section>`;
    const draw=(feature='all')=>{let a=stories;if(feature==='audio'||feature==='video')a=stories.filter(st=>storyHasFeature(st,feature));if(feature==='exclusive')a=stories.filter(st=>st.access==='exclusive');$('#bookStoriesGrid').innerHTML=a.map(st=>storyCard(st,'covers')).join('')||'<div class="empty">No hay Stories con este contenido.</div>';$$('.book-story-filter').forEach(b=>b.classList.toggle('active',b.dataset.bookFeature===feature));bindStoryCards();bindBrokenImages()};
    $$('.book-story-filter').forEach(b=>b.onclick=()=>draw(b.dataset.bookFeature));$$('[data-book-feature-jump]').forEach(b=>b.onclick=()=>{const feature=b.dataset.bookFeatureJump;draw(feature);requestAnimationFrame(()=>$('#bookStoriesGrid')?.scrollIntoView({behavior:'smooth',block:'start'}))});$('#collectionBack').onclick=()=>go('collection');draw();forcePageTop();return;
  }
  const shelf=ordered.map(([book])=>{const a=bookAsset(book),has=!!a.spine;return `<button class="shelf-book ${has?'has-spine':'fallback-spine'}" data-book-scroll="${escAttr(book)}" aria-label="Ir a ${escAttr(bookLabel(book))}">${has?`<img src="${escAttr(a.spine)}" alt="${escAttr(bookLabel(book))}">`:`<span>${escapeHtml(bookLabel(book))}</span>`}</button>`}).join('');
  const cards=ordered.map(([book,stories])=>{stories.sort((a,b)=>new Date(b.published)-new Date(a.published));const read=stories.filter(s=>readIds.has(s.id)).length,asset=bookAsset(book),thumbs=stories.slice(0,3).map(s=>displayCover(s)).filter(Boolean);const visual=asset.front?`<div class="book-front"><img src="${escAttr(asset.front)}" alt="${escAttr(bookLabel(book))}" loading="lazy"></div>`:`<div class="book-thumbs">${thumbs.length?thumbs.map(src=>`<img src="${escAttr(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join(''):`<div class="book-placeholder">${escapeHtml(book)}</div>`}</div>`;return `<article id="book-${escAttr(book)}" class="book-card" data-book-id="${escAttr(book)}">${visual}<div class="book-copy"><h2>${escapeHtml(bookLabel(book))}</h2><div class="book-numbers-row"><div class="book-numbers"><strong>${read}/15</strong><span>LEÍDAS</span></div>${bookFeatureSummary(stories)}</div>${asset.pages?`<div class="book-pages"><strong>${escapeHtml(asset.pages)}</strong><span>PÁGINAS</span></div>`:''}<div class="collection-progress"><span style="width:${pct(read/15)}"></span></div><span class="book-open">VER STORIES ›</span></div></article>`}).join('');
  view.innerHTML=`<section class="section collection-section"><div class="section-title collection-title"><div><div class="eyebrow collection-eyebrow">BIBLIOTECA DE LA</div><h1>Colección</h1></div></div>${shelf?`<div class="book-shelf-wrap"><div class="book-shelf-title">ESTANTERÍA</div><div class="book-shelf">${shelf}</div><div class="shelf-board"></div></div>`:''}<div class="books-grid">${cards||'<div class="empty">Todavía no hay libros con Stories publicadas.</div>'}</div></section>`;
  $$('[data-book-id]').forEach(el=>el.onclick=()=>{if(el.classList.contains('book-card-opening'))return;el.classList.add('book-card-opening');setTimeout(()=>go(`collection/${el.dataset.bookId}`),motionReduced()?20:360)});
  $$('[data-book-scroll]').forEach(el=>el.onclick=()=>{const target=document.getElementById(`book-${el.dataset.bookScroll}`);if(!target)return;target.scrollIntoView({behavior:'smooth',block:'center'});const delay=motionReduced()?20:360;setTimeout(()=>{target.classList.remove('book-card-flash');void target.offsetWidth;target.classList.add('book-card-flash');setTimeout(()=>target.classList.remove('book-card-flash'),1000)},delay)});
  bindBrokenImages();requestAnimationFrame(fitCollectionShelf);
}
function playerState(){return store.get(playerStateKey,{index:0,shuffle:false,repeatMode:'off',volume:.85})}
function savePlayerState(){const a=$('#globalPlayerAudio');store.set(playerStateKey,{index:playerIndex,shuffle:playerShuffle,repeatMode:playerRepeatMode,volume:a?Number(a.volume):.85})}
function trackNameFromFile(name=''){try{return decodeURIComponent(String(name)).replace(/\.mp3$/i,'')}catch{return String(name).replace(/\.mp3$/i,'')}}
async function ensurePlayerManifest(){if(playerTracks.length)return playerTracks;if(playerManifestLoading)return playerManifestLoading;playerManifestLoading=(async()=>{const r=await fetch(`${PLAYER_MANIFEST}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`PLAYER manifest HTTP ${r.status}`);const j=await r.json(),list=Array.isArray(j)?j:(j.tracks||[]);playerTracks=list.filter(x=>typeof x==='string'&&/\.mp3$/i.test(x)).map(file=>({file,name:trackNameFromFile(file),src:PLAYER_MUSIC_BASE+String(file).split('/').map(encodeURIComponent).join('/')}));const st=playerState();playerIndex=Math.min(Math.max(0,Number(st.index)||0),Math.max(0,playerTracks.length-1));playerShuffle=!!st.shuffle;playerRepeatMode=['off','one','all'].includes(st.repeatMode)?st.repeatMode:'off';playerActivated=false;return playerTracks})().finally(()=>playerManifestLoading=null);return playerManifestLoading}

function playerMediaSessionMetadata(){
  const t=playerTracks[playerIndex];
  if(!t||!('mediaSession' in navigator))return;
  try{
    navigator.mediaSession.metadata=new MediaMetadata({
      title:t.name||'Disturbing Player',
      artist:'Disturbing Stories',
      album:'Disturbing Player'
    });
  }catch{}
}
function playerMediaSessionPosition(){
  const a=$('#globalPlayerAudio');
  if(!a||!('mediaSession' in navigator)||typeof navigator.mediaSession.setPositionState!=='function')return;
  if(!(Number.isFinite(a.duration)&&a.duration>0&&Number.isFinite(a.currentTime)))return;
  try{
    navigator.mediaSession.setPositionState({
      duration:a.duration,
      playbackRate:a.playbackRate||1,
      position:Math.min(a.duration,Math.max(0,a.currentTime))
    });
  }catch{}
}
function setupPlayerBackgroundSupport(){
  const a=$('#globalPlayerAudio');
  if(!a)return;
  a.preload='auto';
  try{
    if('audioSession' in navigator && navigator.audioSession){
      navigator.audioSession.type='playback';
    }
  }catch{}
  if(!('mediaSession' in navigator))return;
  const set=(name,fn)=>{try{navigator.mediaSession.setActionHandler(name,fn)}catch{}};
  set('play',()=>{playerActivated=true;a.play().catch(()=>{})});
  set('pause',()=>a.pause());
  set('previoustrack',()=>playerStep(-1,true));
  set('nexttrack',()=>playerStep(1,true));
  set('seekbackward',details=>{
    const jump=Number(details?.seekOffset)||10;
    if(Number.isFinite(a.currentTime))a.currentTime=Math.max(0,a.currentTime-jump);
  });
  set('seekforward',details=>{
    const jump=Number(details?.seekOffset)||10;
    if(Number.isFinite(a.currentTime)&&Number.isFinite(a.duration))a.currentTime=Math.min(a.duration,a.currentTime+jump);
  });
  set('seekto',details=>{
    if(Number.isFinite(details?.seekTime)){
      a.currentTime=Math.max(0,Math.min(Number.isFinite(a.duration)?a.duration:details.seekTime,details.seekTime));
    }
  });
}

function initPlayer(){const a=$('#globalPlayerAudio');if(!a)return;const st=playerState();a.volume=Math.max(0,Math.min(1,Number(st.volume??.85)));a.preload='auto';playerShuffle=!!st.shuffle;playerRepeatMode=['off','one','all'].includes(st.repeatMode)?st.repeatMode:'off';playerActivated=false;setupPlayerBackgroundSupport();a.addEventListener('timeupdate',()=>{syncPlayerUI();playerMediaSessionPosition()});a.addEventListener('loadedmetadata',()=>{syncPlayerUI();playerMediaSessionMetadata();playerMediaSessionPosition()});a.addEventListener('play',()=>{playerActivated=true;try{if('mediaSession'in navigator)navigator.mediaSession.playbackState='playing'}catch{}savePlayerState();syncPlayerUI();playerMediaSessionMetadata();updateMiniPlayerVisibility(routeName())});a.addEventListener('pause',()=>{try{if('mediaSession'in navigator)navigator.mediaSession.playbackState='paused'}catch{}savePlayerState();syncPlayerUI()});a.addEventListener('ended',playerHandleEnded);ensurePlayerManifest().then(()=>{if(playerTracks.length)loadPlayerTrack(playerIndex,false);syncPlayerUI();playerMediaSessionMetadata();updateMiniPlayerVisibility(routeName())}).catch(()=>syncPlayerUI())}
function routeName(){return(location.hash||'#/home').replace(/^#\//,'').split('/')[0]||'home'}
function loadPlayerTrack(i,autoplay=false){const a=$('#globalPlayerAudio');if(!a||!playerTracks.length)return;playerIndex=(i+playerTracks.length)%playerTracks.length;const t=playerTracks[playerIndex],changed=a.dataset.track!==String(playerIndex);if(changed){a.dataset.track=String(playerIndex);a.preload='auto';a.src=t.src;if(!autoplay){try{a.load()}catch{}}}savePlayerState();playerMediaSessionMetadata();syncPlayerUI();if(autoplay){const p=a.play();if(p&&typeof p.catch==='function')p.catch(()=>{});}}
async function playerToggle(){try{await ensurePlayerManifest()}catch{return}const a=$('#globalPlayerAudio');if(!a||!playerTracks.length)return;playerActivated=true;if(!a.src)loadPlayerTrack(playerIndex,false);if(a.paused)a.play().catch(()=>{});else a.pause();updateMiniPlayerVisibility(routeName())}
async function playerStep(dir,autoplay=true){try{await ensurePlayerManifest()}catch{return}if(!playerTracks.length)return;let n;if(playerShuffle&&playerTracks.length>1){do{n=Math.floor(Math.random()*playerTracks.length)}while(n===playerIndex)}else n=(playerIndex+dir+playerTracks.length)%playerTracks.length;playerActivated=true;loadPlayerTrack(n,autoplay)}
function playerHandleEnded(){const a=$('#globalPlayerAudio');if(!a||!playerTracks.length)return;if(playerRepeatMode==='one'){a.currentTime=0;const p=a.play();if(p&&typeof p.catch==='function')p.catch(()=>{});return}if(playerShuffle){playerStep(1,true);return}if(playerIndex<playerTracks.length-1){loadPlayerTrack(playerIndex+1,true);return}if(playerRepeatMode==='all'){loadPlayerTrack(0,true);return}a.currentTime=0;try{if('mediaSession'in navigator)navigator.mediaSession.playbackState='paused'}catch{}syncPlayerUI()}
function setRepeatMode(mode){playerRepeatMode=playerRepeatMode===mode?'off':mode;playerActivated=true;savePlayerState();syncPlayerUI()}
function playerPauseForStoryMedia(){const a=$('#globalPlayerAudio');if(!a)return;playerWasPlayingBeforeMedia=!a.paused&&!!a.src;if(playerWasPlayingBeforeMedia){a.pause();toast('Player pausado por el contenido de la Story')}}
function bindStoryMediaPause(){$$('#reader audio,#reader video').forEach(m=>m.addEventListener('play',playerPauseForStoryMedia));$$('#reader .reader-media iframe').forEach(m=>m.addEventListener('pointerdown',playerPauseForStoryMedia,{passive:true}))}
function fmtPlayer(sec){if(!Number.isFinite(sec))return'0:00';const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),ss=Math.floor(sec%60);return h?`${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`:`${m}:${String(ss).padStart(2,'0')}`}
function playlistSignature(){return playerTracks.map(t=>t.file).join('|')}
async function ensurePlaylistTotalDuration(){if(!playerTracks.length)return 0;const saved=Array.isArray(playerCatalogData?.tracks)?playerCatalogData.tracks:[],byFile=new Map(saved.map(x=>[String(x.file||''),Number(x.durationSeconds)||0])),durations=playerTracks.map(t=>byFile.get(t.file)||0);if(durations.some(x=>x<=0)||durations.length!==playerTracks.length)return 0;return durations.reduce((a,b)=>a+b,0)}
function syncPlayerUI(){const a=$('#globalPlayerAudio'),t=playerTracks[playerIndex];if(!a)return;const p=a.duration>0?a.currentTime/a.duration:0,name=t?.name||'—';const miniTrack=$('#miniPlayerTrack'),miniProg=$('#miniPlayerProgress'),miniPlay=$('#miniPlay');if(miniTrack)miniTrack.textContent=name;if(miniProg)miniProg.style.width=pct(p);if(miniPlay)miniPlay.textContent=a.paused?'▶':'❚❚';const fullTrack=$('#playerNowTrack'),fullTime=$('#playerTime'),fullProg=$('#playerProgressFill'),fullPlay=$('#playerPlay'),fullShuffle=$('#playerShuffle'),fullRepeatOne=$('#playerRepeatOne'),fullRepeatAll=$('#playerRepeatAll'),fullVol=$('#playerVolume');if(fullTrack)fullTrack.textContent=name;if(fullTime)fullTime.textContent=`${fmtPlayer(a.currentTime)} / ${fmtPlayer(a.duration)}`;if(fullProg)fullProg.style.width=pct(p);if(fullPlay)fullPlay.textContent=a.paused?'▶':'❚❚';if(fullShuffle)fullShuffle.classList.toggle('active',playerShuffle);if(fullRepeatOne)fullRepeatOne.classList.toggle('active',playerRepeatMode==='one');if(fullRepeatAll)fullRepeatAll.classList.toggle('active',playerRepeatMode==='all');if(fullVol){if(document.activeElement!==fullVol)fullVol.value=String(a.volume);fullVol.style.setProperty('--volume-pct',`${Math.round(a.volume*100)}%`)}const wave=$('#playerWave');if(wave)wave.classList.toggle('playing',!a.paused&&!!a.src);$$('[data-player-track]').forEach(el=>el.classList.toggle('active',Number(el.dataset.playerTrack)===playerIndex))}
function updateMiniPlayerVisibility(route=routeName()){const mini=$('#miniPlayer');if(!mini)return;const show=playerActivated&&route!=='player';mini.classList.toggle('hidden',!show);document.body.classList.toggle('player-mini-visible',show)}
function playerSavedDuration(file){const row=(playerCatalogData?.tracks||[]).find(x=>String(x.file||'')===String(file||''));return Number(row?.durationSeconds)||0}
async function renderPlayer(){currentStory=null;scrollTo({top:0,behavior:'auto'});view.innerHTML='<section class="section player-section"><div class="player-title-row"><div><div class="eyebrow">Música del proyecto</div><h1>PLAYER</h1></div><div class="player-summary"><div class="player-summary-row"><span>PISTAS</span><strong>—</strong></div><div class="player-summary-row"><small>TOTAL</small><b>—</b></div></div></div><div class="player-loading">Cargando playlist…</div></section>';try{await ensurePlayerManifest()}catch(e){view.innerHTML=`<section class="section player-section"><h1>PLAYER</h1><div class="empty">No se pudo cargar la playlist.<br>${escapeHtml(e.message)}</div></section>`;return}const a=$('#globalPlayerAudio'),t=playerTracks[playerIndex];view.innerHTML=`<section class="section player-section"><div class="player-title-row"><div><div class="eyebrow">Música del proyecto</div><h1>PLAYER</h1></div><div class="player-summary"><div class="player-summary-row"><span>PISTAS</span><strong>${playerTracks.length}</strong></div><div class="player-summary-row"><small>TOTAL</small><b id="playerTotalDuration">…</b></div></div></div><div class="player-console"><div class="player-console-head"><span>NOW PLAYING</span><strong id="playerNowTrack">${escapeHtml(t?.name||'—')}</strong></div><div class="player-progress-meta"><div class="player-time" id="playerTime">${fmtPlayer(a.currentTime)} / ${fmtPlayer(a.duration)}</div><div id="playerWave" class="player-wave" aria-hidden="true">${Array.from({length:18},(_,i)=>`<i style="--wave-i:${i}"></i>`).join('')}</div></div><button class="player-progress" id="playerProgress" aria-label="Progreso"><span id="playerProgressFill"></span></button><div class="player-controls player-controls-main"><button id="playerPrev" aria-label="Anterior">‹</button><button id="playerPlay" class="player-main-play" aria-label="Play/Pause">${a.paused?'▶':'❚❚'}</button><button id="playerNext" aria-label="Siguiente">›</button></div><div class="player-mode-controls"><button id="playerRepeatOne" class="player-mode ${playerRepeatMode==='one'?'active':''}" type="button">↻ 1</button><button id="playerRepeatAll" class="player-mode ${playerRepeatMode==='all'?'active':''}" type="button">↻ TODOS</button><button id="playerShuffle" class="player-mode ${playerShuffle?'active':''}" type="button">⤨ RANDOM</button></div><div class="player-volume"><span>VOL</span><input id="playerVolume" type="range" min="0" max="1" step="0.01" value="${a.volume}"></div></div>${spotifyCompanionHtml()}<div class="player-list">${playerTracks.map((x,i)=>`<button class="player-track ${i===playerIndex?'active':''}" data-player-track="${i}"><span>${String(i+1).padStart(2,'0')}</span><strong>${escapeHtml(x.name)}</strong><em>${playerSavedDuration(x.file)?fmtPlayer(playerSavedDuration(x.file)):'—'}</em></button>`).join('')}</div><p class="player-note">La música continúa al navegar por la app. Si reproduces un audio o vídeo dentro de una Story, Player se pausa.</p></section>`;$('#playerPrev').onclick=()=>playerStep(-1,true);$('#playerPlay').onclick=()=>playerToggle();$('#playerNext').onclick=()=>playerStep(1,true);$('#playerRepeatOne').onclick=()=>setRepeatMode('one');$('#playerRepeatAll').onclick=()=>setRepeatMode('all');$('#playerShuffle').onclick=()=>{playerShuffle=!playerShuffle;playerActivated=true;savePlayerState();syncPlayerUI()};$('#playerVolume').oninput=e=>{a.volume=Number(e.target.value);playerActivated=true;savePlayerState();syncPlayerUI()};$('#playerProgress').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();if(a.duration>0)a.currentTime=a.duration*((e.clientX-r.left)/r.width)};$$('[data-player-track]').forEach(b=>b.onclick=()=>{playerActivated=true;loadPlayerTrack(Number(b.dataset.playerTrack),true)});syncPlayerUI();updateMiniPlayerVisibility('player');ensurePlaylistTotalDuration().then(total=>{const el=$('#playerTotalDuration');if(el)el.textContent=total>0?fmtPlayer(total):'PENDIENTE'}).catch(()=>{})}

async function renderStory(id,resume=false,requestedTab=''){resumeOnOpen=!!resume;storyInitialOpen=true;scrollTo({top:0,behavior:'auto'});const meta=indexData.stories.find(s=>s.id===id);if(suppressNewClearOnceId===id)suppressNewClearOnceId='';else markStoryOpened(id);if(!meta){view.innerHTML='<div class="empty">Story no encontrada.</div>';return}currentStory={...meta};currentTab=requestedTab||'read';if(isLocked(meta)){drawStory();return}showLoading();try{const data=await loadStoryData(meta);currentStory={...meta,...data};if(currentStory.cover){const c=coverCache();c[id]=currentStory.cover;store.set(coverCacheKey,c)}drawStory()}catch(e){if(meta.access==='exclusive'){const m=secretMap();delete m[id];store.set(unlockSecretsKey,m);currentStory={...meta};drawStory('No se pudo validar el desbloqueo guardado. Escanea de nuevo el QR de esta Story.')}else view.innerHTML=`<div class="empty"><h2>Error cargando Story ${escapeHtml(id)}</h2><p>${escapeHtml(e.message)}</p></div>`}}
async function loadStoryData(meta,secretOverride=''){const r=await fetch(meta.data,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const obj=await r.json();if(obj?.protected){const secret=secretOverride||secretMap()[meta.id];if(!secret)throw new Error('Story bloqueada');return decryptStory(obj,secret)}return obj}
function drawStory(lockMessage=''){const s=currentStory,locked=isLocked(s),tabs=Object.entries(s.tabs||{}).filter(([,v])=>v&&Array.isArray(v.blocks));if(!locked&&!tabs.some(([k])=>k===currentTab)){const target=Object.entries(s.tabs||{}).find(([k,v])=>normalizedText(`${k} ${v?.label||''}`).includes(normalizedText(currentTab)));currentTab=target?.[0]||(tabs.some(([k])=>k==='read')?'read':tabs[0]?.[0]||'read')}const read=isRead(s.id);if(locked){view.innerHTML=`<section class="story-header locked-story-header"><div class="story-header-content"><div class="story-number">STORY ${escapeHtml(s.id)}</div><h1>${escapeHtml(s.title)}</h1><div class="meta-row"><span class="pill">${formatDate(s.published)}</span><span class="pill red">EXCLUSIVA</span></div>${sagaStoryLink(s)}</div></section>${renderLocked(s,lockMessage)}`;bindBrokenImages();bindSagaStoryLinks();bindInlineUnlock(s.id);return}view.innerHTML=`<section class="story-header"><div class="story-header-content"><div class="story-number">STORY ${escapeHtml(s.id)}</div><h1>${escapeHtml(s.title)}</h1><div class="meta-row"><span class="pill">${formatDate(s.published)}</span>${s.access==='exclusive'?'<span class="pill red">EXCLUSIVA</span>':'<span class="pill">GRATIS</span>'}<span id="readStatusPill" class="pill read-pill ${read?'':'hidden'}">✓ LEÍDA</span></div>${sagaStoryLink(s)}</div>${storyFeaturedMedia(s,false)}</section><div class="tabs">${tabs.map(([k,v])=>`<button class="tab ${k===currentTab?'active':''}" data-tab="${escAttr(k)}">${escapeHtml(v.label||k)}</button>`).join('')}</div><div class="progress-wrap"><div id="readProgress" class="progress"></div></div><article id="reader" class="reader"></article>`;bindBrokenImages();bindSagaStoryLinks();$$('.tab').forEach(b=>b.onclick=()=>{currentTab=b.dataset.tab;drawTab()});drawTab()}
function youtubeEmbedUrl(src=''){src=String(src||'').trim();if(!src)return'';if(/youtube\.com\/embed\//i.test(src))return src;try{const u=new URL(src);let id='';if(/youtu\.be$/i.test(u.hostname))id=u.pathname.split('/').filter(Boolean)[0]||'';else if(/youtube\.com$/i.test(u.hostname)||/www\.youtube\.com$/i.test(u.hostname)){id=u.searchParams.get('v')||'';if(!id&&u.pathname.includes('/shorts/'))id=u.pathname.split('/shorts/')[1]?.split('/')[0]||'';if(!id&&u.pathname.includes('/live/'))id=u.pathname.split('/live/')[1]?.split('/')[0]||'';}return id?`https://www.youtube.com/embed/${id}`:src}catch{return src}}
function publicTeaserSource(s){
  const candidates=[s?.publicTeaser,s?.teaserUrl,s?.teaser,s?.mediaYoutube?.teaser,s?.publicMedia?.teaser,s?.tabs?.teaser?.blocks?.find?.(b=>b&&['iframe','video'].includes(b.type)&&b.src)?.src];
  for(const raw of candidates){
    if(typeof raw==='string'&&raw.trim())return raw.trim();
    if(raw&&typeof raw==='object'){const src=String(raw.src||raw.url||raw.embed||'').trim();if(src)return src}
  }
  return'';
}
function lockedTeaserHtml(s,hero=false){const src=publicTeaserSource(s),embed=youtubeEmbedUrl(src);if(!embed)return'';const cls=hero?'locked-hero-teaser':'locked-teaser';return `<section class="${cls}">${hero?'':'<div class="eyebrow">TEASER</div>'}<div class="locked-teaser-video"><iframe src="${escAttr(embed)}" title="Teaser Story ${escAttr(s.id)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="${hero?'eager':'lazy'}" referrerpolicy="strict-origin-when-cross-origin"></iframe></div></section>`}
function lockedHeroMedia(s){const teaser=lockedTeaserHtml(s,true);return teaser||`<section class="locked-hero-teaser teaser-unavailable"><div class="locked-teaser-video teaser-placeholder"><span>TEASER</span><small>Actualiza los metadatos desde el Importer para publicar la excepción pública de esta Story.</small></div></section>`}
function renderLocked(s,msg=''){const book=String(Number(s.book)||s.book||'—');return `<section class="locked-story-page"><div class="locked-main-lock" aria-label="Story bloqueada">${lockSvg(false)}</div>${lockedHeroMedia(s)}${msg?`<p class="locked-error-note">${escapeHtml(msg)}</p>`:''}<section class="unlock-panel locked-inline-unlock"><div class="scanner-instruction story-specific"><strong>SÓLO EN EL LIBRO ${escapeHtml(book)}</strong><p>Esta Story requiere el QR que aparece junto a este relato en el libro físico. Escanéalo para desbloquearla.</p></div>${qrScanControlsHtml()}</section></section>`}
function bindInlineUnlock(prefill){bindQrControls(prefill)}
function drawTab(){const tab=currentStory.tabs?.[currentTab];if(!tab)return;$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===currentTab));const mediaOnly=isVideoOnlyTab(currentTab,tab),isTeaser=/teaser|trailer/i.test(`${currentTab} ${tab?.label||''}`);let blocks=mediaOnly?(tab.blocks||[]).filter(b=>b.type==='iframe'||b.type==='video'):[...(tab.blocks||[])];if(currentTab==='read'&&currentStory.featuredImage)blocks=blocks.filter(b=>!(b.type==='image'&&b.src===currentStory.featuredImage));const reader=$('#reader');reader.classList.toggle('teaser-reader',isTeaser);reader.innerHTML=blocks.length?blocks.map(renderBlock).join(''):'<div class="empty">Esta sección no contiene material.</div>';bindReaderMedia();const topBtn=$('#toTopHeaderBtn');if(topBtn)topBtn.classList.remove('hidden');const progress=$('.progress-wrap');if(progress)progress.classList.toggle('hidden',currentTab!=='read');const header=$('.story-header');if(currentTab==='read'&&resumeOnOpen){resumeOnOpen=false;storyInitialOpen=false;requestAnimationFrame(()=>restoreReadPosition(currentStory.id));}else if(currentTab==='read'&&storyInitialOpen){storyInitialOpen=false;requestAnimationFrame(()=>scrollTo({top:0,behavior:'auto'}));}else if(header)scrollTo({top:Math.max(0,header.offsetHeight-20),behavior:'smooth'});requestAnimationFrame(updateProgress)}
function isVideoOnlyTab(key,tab){const label=`${key} ${tab?.label||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return /(^|\s|[-_/])(audio|video|corto|escuchar|listen)(\s|$|[-_/])/.test(label)}
function renderBlock(b){if(b.type==='p')return `<p>${escapeHtml(b.text)}</p>`;if(b.type==='image_link')return `<a class="reader-linked-image" href="${escAttr(b.href)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir contenido enlazado"><figure class="reader-image linked"><img src="${escAttr(b.src)}" alt="${escAttr(b.alt||'')}" loading="lazy" decoding="async" referrerpolicy="no-referrer">${b.caption?`<figcaption>${escapeHtml(b.caption)}</figcaption>`:''}</figure></a>`;if(b.type==='image')return `<figure class="reader-image"><img src="${escAttr(b.src)}" alt="${escAttr(b.alt||'')}" loading="lazy" decoding="async" referrerpolicy="no-referrer">${b.caption?`<figcaption>${escapeHtml(b.caption)}</figcaption>`:''}</figure>`;if(b.type==='iframe')return `<div class="reader-media"><iframe src="${escAttr(b.src)}" title="${escAttr(b.title||'Contenido multimedia')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;if(b.type==='video')return `<div class="reader-media"><video controls playsinline preload="metadata" src="${escAttr(b.src)}"></video></div>`;if(b.type==='audio')return `<div class="reader-media"><audio controls preload="metadata" src="${escAttr(b.src)}"></audio></div>`;if(b.type==='note')return `<p class="note">${escapeHtml(b.text)}</p>`;if(b.type==='heading')return `<h2>${escapeHtml(b.text)}</h2>`;if(b.type==='quote')return `<blockquote>${escapeHtml(b.text)}</blockquote>`;if(b.type==='link')return `<p><a href="${escAttr(b.href)}" target="_blank" rel="noopener">${escapeHtml(b.text||'Abrir contenido')} ↗</a></p>`;return ''}
function bindReaderMedia(){bindBrokenImages();bindStoryMediaPause();$$('.reader-image:not(.linked) img').forEach(img=>img.onclick=()=>openLightbox(img.src,img.alt))}
function bindBrokenImages(){$$('img').forEach(img=>{if(img.dataset.boundError)return;img.dataset.boundError='1';img.addEventListener('error',()=>{const fig=img.closest('.reader-image');if(fig)fig.remove();else img.style.visibility='hidden'},{once:true})})}
function openLightbox(src,alt=''){const box=document.createElement('div');box.className='lightbox';box.innerHTML=`<button class="lightbox-close" aria-label="Cerrar">×</button><img src="${escAttr(src)}" alt="${escAttr(alt)}">`;box.onclick=e=>{if(e.target===box||e.target.closest('.lightbox-close'))box.remove()};document.body.append(box)}
function markRead(id){const a=readList();if(a.includes(id))return false;a.push(id);store.set(readKey,a);const m=readingStateMap();m[id]={...(m[id]||{}),progress:1,updated:Date.now()};store.set(readingStateKey,m);const p=readProgressMap();p[id]=1;store.set(readProgressKey,p);const pill=$('#readStatusPill');if(pill)pill.classList.remove('hidden');celebrateRead(id);updateAppBadge();return true}
function persistCurrentReadingPosition(){
  const r=$('#reader');if(!r||!currentStory||currentTab!=='read')return;const rect=r.getBoundingClientRect(),top=scrollY+rect.top,h=Math.max(1,r.offsetHeight-innerHeight*.65),x=Math.max(0,Math.min(1,(scrollY-top+innerHeight*.3)/h)),maxProgress=Math.max(storyProgress(currentStory.id),x);saveReadingState(currentStory.id,maxProgress,x,r);
}
function celebrateRead(id){const total=indexData?.stories?.length||0,count=publishedReadCount();document.querySelector('.read-celebration')?.remove();const el=document.createElement('div');el.className='read-celebration';el.innerHTML=`<button class="read-celebration-close" type="button" aria-label="Cerrar">×</button><div class="read-check">✓</div><div class="eyebrow">STORY ${escapeHtml(id)}</div><strong>LEÍDA</strong><small>${count} / ${total} Stories publicadas</small>`;document.body.append(el);let timer;const close=()=>{clearTimeout(timer);el.classList.remove('show');setTimeout(()=>el.remove(),260)};el.querySelector('.read-celebration-close').onclick=close;setTimeout(()=>el.classList.add('show'),20);timer=setTimeout(close,3000)}
function updateProgress(){
  const r=$('#reader'),p=$('#readProgress');if(!r||!p||!currentStory||currentTab!=='read')return;
  const rect=r.getBoundingClientRect(),top=scrollY+rect.top,h=Math.max(1,r.offsetHeight-innerHeight*.65),x=Math.max(0,Math.min(1,(scrollY-top+innerHeight*.3)/h));p.style.width=`${x*100}%`;
  const old=storyProgress(currentStory.id),now=Date.now(),maxProgress=Math.max(old,x);if(x>old+.006){const legacy=readProgressMap();legacy[currentStory.id]=Math.round(maxProgress*1000)/1000;store.set(readProgressKey,legacy)}if(x>old+.006||now-lastReadingSaveAt>700){lastReadingSaveAt=now;saveReadingState(currentStory.id,maxProgress,x,r)}
  const bottomNav=$('.bottom-nav')?.getBoundingClientRect().height||72,mini=document.body.classList.contains('player-mini-visible')?($('#miniPlayer')?.getBoundingClientRect().height||58):0;const reachedBottom=r.getBoundingClientRect().bottom<=innerHeight-bottomNav-mini+18;
  if(currentStory.access==='exclusive'&&maxProgress>=.25){markStoryOpened(currentStory.id);document.querySelectorAll('.new-story-badge').forEach(el=>el.remove())}
  if(reachedBottom&&!isRead(currentStory.id))markRead(currentStory.id);
}
function saveReadingState(id,progress,position,reader){
  const kids=[...reader.children];let anchor=0,best=Infinity;const target=calcFixedReadingTop()+12;
  kids.forEach((el,i)=>{const d=Math.abs(el.getBoundingClientRect().top-target);if(el.getBoundingClientRect().top<=target+80&&d<best){best=d;anchor=i}});
  const states=readingStateMap();states[id]={progress:Math.round(progress*1000)/1000,position:Math.round(position*1000)/1000,anchor,updated:Date.now()};store.set(readingStateKey,states);
}
function calcFixedReadingTop(){const top=$('.topbar')?.getBoundingClientRect().height||70,tabs=$('.tabs')?.getBoundingClientRect().height||0;return top+tabs}
function restoreReadPosition(id){
  const r=$('#reader');if(!r)return;const state=readingStateMap()[id]||{progress:storyProgress(id),position:storyProgress(id)};
  let restored=false;const doRestore=()=>{if(restored)return;restored=true;const kids=[...r.children],fixed=calcFixedReadingTop()+12;if(Number.isInteger(state.anchor)&&kids[state.anchor]){const y=scrollY+kids[state.anchor].getBoundingClientRect().top-fixed;scrollTo({top:Math.max(0,y),behavior:'auto'});}else{const rect=r.getBoundingClientRect(),top=scrollY+rect.top,h=Math.max(1,r.offsetHeight-innerHeight*.65),y=top+(Number(state.position??state.progress)||0)*h-innerHeight*.3;scrollTo({top:Math.max(0,y),behavior:'auto'});}requestAnimationFrame(updateProgress)};
  const images=[...r.querySelectorAll('img')];if(!images.length)return setTimeout(doRestore,30);let left=images.filter(i=>!i.complete).length;if(!left)return setTimeout(doRestore,30);const done=()=>{left--;if(left<=0)setTimeout(doRestore,20)};images.filter(i=>!i.complete).forEach(i=>{i.addEventListener('load',done,{once:true});i.addEventListener('error',done,{once:true})});setTimeout(doRestore,900);
}

function qrScanControlsHtml(){
  return `<div class="scan-zone qr-photo-only"><div id="qr-reader" class="qr-reader"><div class="qr-photo-mode"><div class="qr-ios-photo-mark" aria-hidden="true">QR</div><strong>FOTO DEL QR</strong><span>Haz una foto clara y centrada del código. Disturbing Stories App la analizará automáticamente al volver.</span></div></div><div id="qr-file-reader" class="qr-file-reader" aria-hidden="true"></div><button class="cta" id="photoQr">HACER FOTO DEL QR</button><button class="secondary-btn qr-gallery-btn" id="galleryQr" style="margin-top:8px">ELEGIR FOTO DEL QR</button><input id="qrCameraFile" class="qr-native-input" type="file" accept="image/*" capture="environment"><input id="qrFile" class="qr-native-input" type="file" accept="image/*"><p id="unlockStatus" class="note" style="margin-top:12px"></p></div>`
}
function openQrNativeCamera(){
  const camera=$('#qrCameraFile');if(!camera)return false;
  try{camera.value='';camera.click();return true}catch{return false}
}
function bindQrControls(prefill=''){
  const camera=$('#qrCameraFile'),gallery=$('#qrFile'),photo=$('#photoQr'),galleryBtn=$('#galleryQr');
  if(photo)photo.onclick=()=>{
    unlockStatus('Haz una foto del QR; se analizará automáticamente al volver.');
    if(!openQrNativeCamera())unlockStatus('No se pudo abrir la cámara. Usa «ELEGIR FOTO DEL QR».')
  };
  if(galleryBtn)galleryBtn.onclick=()=>{if(gallery){gallery.value='';gallery.click()}};
  if(camera)camera.onchange=e=>scanQrPhoto(e.target.files?.[0],prefill,'qrCameraFile','camera');
  if(gallery)gallery.onchange=e=>scanQrPhoto(e.target.files?.[0],prefill,'qrFile','album');
  requestAnimationFrame(()=>unlockStatus('Haz una foto del QR. El análisis y el desbloqueo son automáticos.'))
}
function showUnlock(prefill=''){
  const meta=prefill?indexData.stories.find(s=>s.id===prefill):null,book=meta?String(Number(meta.book)||meta.book||'—'):'X';
  updateSectionIndicator('unlock');
  const instruction=meta?`<div class="scanner-instruction story-specific"><strong>SÓLO EN EL LIBRO ${escapeHtml(book)}</strong><p>Esta Story requiere el QR que aparece junto a este relato en el libro físico. Escanéalo para desbloquearla.</p></div>`:`<div class="scanner-instruction general-unlock"><p>Escanea los QR de todas las Stories de los libros físicos, y desbloquéalas aquí.</p></div>`;
  view.innerHTML=`<section class="unlock-panel section"><div class="eyebrow">Acceso mediante QR</div><h1>Desbloquear Story${prefill?' '+escapeHtml(prefill):''}</h1>${instruction}${qrScanControlsHtml()}${meta?lockedTeaserHtml(meta):''}</section>`;
  bindQrControls(prefill)
}
async function ensureQrLibrary(){
  if(typeof Html5Qrcode!=='undefined')return true;
  unlockStatus('Preparando lector QR…');
  return new Promise(resolve=>{
    const old=document.querySelector('script[data-qr-lib]');
    if(old){
      old.addEventListener('load',()=>resolve(typeof Html5Qrcode!=='undefined'),{once:true});
      old.addEventListener('error',()=>resolve(false),{once:true});
      return
    }
    const sc=document.createElement('script');
    sc.src='https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
    sc.async=true;
    sc.dataset.qrLib='1';
    sc.onload=()=>resolve(typeof Html5Qrcode!=='undefined');
    sc.onerror=()=>resolve(false);
    document.head.append(sc)
  })
}
async function ensureJsQrLibrary(){
  if(typeof window.jsQR==='function')return true;
  const sources=[
    'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
    'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js'
  ];
  for(let i=0;i<sources.length;i++){
    if(typeof window.jsQR==='function')return true;
    const src=sources[i];
    document.querySelectorAll(`script[data-jsqr-lib="${i}"]`).forEach(x=>x.remove());
    const ok=await new Promise(resolve=>{
      const sc=document.createElement('script');
      sc.src=src;sc.async=true;sc.dataset.jsqrLib=String(i);
      sc.onload=()=>resolve(typeof window.jsQR==='function');
      sc.onerror=()=>resolve(false);
      document.head.append(sc)
    });
    if(ok)return true
  }
  return false
}
async function loadQrPhotoSource(file){
  let objectUrl='';
  try{
    objectUrl=URL.createObjectURL(file);
    const img=new Image();img.decoding='async';
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('image-decode'));img.src=objectUrl});
    if(img.naturalWidth&&img.naturalHeight)return{source:img,width:img.naturalWidth,height:img.naturalHeight,cleanup:()=>URL.revokeObjectURL(objectUrl)}
  }catch(e){if(objectUrl)URL.revokeObjectURL(objectUrl)}
  if('createImageBitmap'in window){
    try{
      let bitmap;
      try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'})}catch{bitmap=await createImageBitmap(file)}
      if(bitmap?.width&&bitmap?.height)return{source:bitmap,width:bitmap.width,height:bitmap.height,cleanup:()=>{try{bitmap.close()}catch{}}}
    }catch{}
  }
  throw new Error('No se pudo abrir la fotografía')
}
function renderQrCandidate(source,sourceW,sourceH,cropRatio=1,maxSide=1800,rotation=0){
  const crop=Math.max(.45,Math.min(1,cropRatio));
  const sw=Math.max(1,Math.round(sourceW*crop)),sh=Math.max(1,Math.round(sourceH*crop));
  const sx=Math.max(0,Math.round((sourceW-sw)/2)),sy=Math.max(0,Math.round((sourceH-sh)/2));
  const scale=Math.min(1,maxSide/Math.max(sw,sh));
  const dw=Math.max(1,Math.round(sw*scale)),dh=Math.max(1,Math.round(sh*scale));
  const turns=((rotation%360)+360)%360;
  const quarter=turns===90||turns===270;
  const canvas=document.createElement('canvas');canvas.width=quarter?dh:dw;canvas.height=quarter?dw:dh;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
  ctx.imageSmoothingEnabled=true;try{ctx.imageSmoothingQuality='high'}catch{}
  ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(turns*Math.PI/180);ctx.drawImage(source,sx,sy,sw,sh,-dw/2,-dh/2,dw,dh);ctx.restore();
  return canvas
}
function decodeQrCanvasJsQr(canvas){
  if(!canvas||typeof window.jsQR!=='function')return'';
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return'';
  try{
    const frame=ctx.getImageData(0,0,canvas.width,canvas.height);
    const hit=window.jsQR(frame.data,frame.width,frame.height,{inversionAttempts:'attemptBoth'});
    return String(hit?.data||'').trim()
  }catch{return''}
}
async function decodeQrPhotoWithJsQr(file){
  const loaded=await ensureJsQrLibrary();if(!loaded)return'';
  const img=await loadQrPhotoSource(file);
  try{
    const candidates=[
      [1,1600,0],[.82,1800,0],[.62,1800,0],[1,2200,0],
      [1,1400,90],[1,1400,180],[1,1400,270],
      [.78,1700,90],[.78,1700,270]
    ];
    for(const [crop,maxSide,rotation] of candidates){
      const canvas=renderQrCandidate(img.source,img.width,img.height,crop,maxSide,rotation);
      const decoded=decodeQrCanvasJsQr(canvas);if(decoded)return decoded;
      await new Promise(requestAnimationFrame)
    }
    return''
  }finally{try{img.cleanup?.()}catch{}}
}
async function decodeQrPhotoWithHtml5(file){
  if(!await ensureQrLibrary())return'';
  let scanner=null;
  try{
    scanner=new Html5Qrcode('qr-file-reader');
    const decoded=await scanner.scanFile(file,true);
    try{await scanner.clear()}catch{}
    return String(decoded||'').trim()
  }catch(e){try{await scanner?.clear()}catch{};return''}
}
async function scanQrPhoto(file,prefill='',inputId='qrFile',sourceKind='album'){
  if(!file)return;
  await stopQrScanner();
  unlockStatus(sourceKind==='camera'?'Analizando la foto del QR…':'Analizando QR…');
  try{
    let decoded='';
    try{decoded=await decodeQrPhotoWithJsQr(file)}catch(e){console.warn('QR v2.15 jsQR photo',e)}
    if(!decoded)decoded=await decodeQrPhotoWithHtml5(file);
    if(decoded){await tryUnlock(decoded,prefill);return}
    unlockStatus('No se ha detectado un QR válido. Acerca más el QR, céntralo y vuelve a hacer la foto.')
  }finally{
    const f=$('#'+inputId);if(f)f.value=''
  }
}
async function stopQrScanner(){return}
async function tryUnlock(raw,prefill=''){const parsedId=storyIdFromPrivateUrl(raw),id=prefill||parsedId;if(!id){unlockStatus('El QR no corresponde a una Story reconocible.');return}if(prefill&&parsedId&&prefill!==parsedId){unlockStatus(`Ese QR pertenece a la Story ${parsedId}, no a la ${prefill}.`);return}const meta=indexData.stories.find(s=>s.id===id);if(!meta||meta.access!=='exclusive'){unlockStatus('Ese QR no corresponde a una Story exclusiva disponible en la app.');return}const secret=normalizeUnlockSecret(raw,id);if(!secret){unlockStatus('El QR no tiene el formato esperado.');return}unlockStatus('Validando acceso…');try{const data=await loadStoryData(meta,secret);if(data.id!==id)throw new Error('El QR no corresponde a esta Story');const m=secretMap();m[id]=secret;store.set(unlockSecretsKey,m);markStoryAcquired(id,true);updateAppBadge();suppressNewClearOnceId=id;unlockStatus('');await showUnlockReward(id);navigateHash(`#/story/${encodeURIComponent(id)}`)}catch{unlockStatus('QR no válido para esta Story.')}}
function unlockStatus(t){const el=$('#unlockStatus');if(el)el.textContent=t}
function storyIdFromPrivateUrl(raw){try{const u=new URL(raw);const m=u.pathname.match(/\/([0-9]{3})_[^/]+\.html$/i);return m?.[1]||''}catch{return''}}
function normalizeUnlockSecret(raw,id){raw=(raw||'').trim();try{const u=new URL(raw);if(!/^(www\.)?disturbingstories\.com$/i.test(u.hostname))return'';if(id&&!new RegExp(`/${id}_[^/]+\\.html$`,'i').test(u.pathname))return'';u.protocol='https:';u.hostname='www.disturbingstories.com';u.hash='';return u.origin+u.pathname+u.search}catch{return raw}}
async function decryptStory(env,secret){if(!env?.crypto?.ciphertext)throw new Error('Archivo protegido no válido');const c=env.crypto,dec=new TextDecoder(),enc=new TextEncoder(),salt=unb64(c.salt),iv=unb64(c.iv),cipher=unb64(c.ciphertext);const base=await crypto.subtle.importKey('raw',enc.encode(secret),'PBKDF2',false,['deriveKey']);const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:c.iterations||120000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,cipher);return JSON.parse(dec.decode(plain))}
function unb64(s){const raw=atob(s),a=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);return a}

function openDrawer(){$('#drawer').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');$('#scrim').classList.remove('hidden')}function closeDrawer(){$('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true');$('#scrim').classList.add('hidden')}
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.append(t);setTimeout(()=>t.remove(),2200)}
function formatDate(s){if(!s)return'';return new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(s+'T12:00:00'))}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}function escAttr(s=''){return escapeHtml(s)}

/* ===== v1.0 · Holo HUD motion system ===== */
let motionMutationObserver=null,hudIntersectionObserver=null,counterIntersectionObserver=null,readerIntersectionObserver=null,cardIntersectionObserver=null;
const motionReduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function initMotionSystem(){
  if(motionMutationObserver)return;
  hudIntersectionObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){runHoloBox(e.target);hudIntersectionObserver.unobserve(e.target)}}),{threshold:.28});
  counterIntersectionObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){runCounter(e.target);counterIntersectionObserver.unobserve(e.target)}}),{threshold:.5});
  readerIntersectionObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('reader-reveal-live');readerIntersectionObserver.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -7% 0px'});
  cardIntersectionObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('story-list-reveal-live');cardIntersectionObserver.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -4% 0px'});
  motionMutationObserver=new MutationObserver(()=>requestAnimationFrame(enhanceDynamicUI));
  motionMutationObserver.observe(view,{subtree:true,childList:true});
  requestAnimationFrame(enhanceDynamicUI);
}
function enhanceDynamicUI(){
  const boxSelectors=['.library-stats>button','.progress-dashboard','.personal-stats>div','.unread-callout','.home-progress','.home-continue','.book-detail-stats>div','.book-card','.continue-card','.player-summary','.player-console','.lock-screen'];
  view.querySelectorAll(boxSelectors.join(',')).forEach(prepareHoloBox);
  view.querySelectorAll('.library-stats strong,.personal-stats strong,.unread-callout strong b,.progress-big>strong,.book-detail-stats strong').forEach(prepareCounter);
  view.querySelectorAll('.reader p').forEach(p=>{if(p.dataset.readerMotion)return;p.dataset.readerMotion='1';p.classList.add('reader-reveal-pending');if(motionReduced())p.classList.add('reader-reveal-live');else readerIntersectionObserver?.observe(p)});
  view.querySelectorAll('.story-card,.story-grid-card,.story-cover-card,.continue-card').forEach(el=>{if(el.dataset.listMotion)return;el.dataset.listMotion='1';el.classList.add('story-list-reveal');if(motionReduced())el.classList.add('story-list-reveal-live');else cardIntersectionObserver?.observe(el)});
  view.querySelectorAll('.hero-content h1,.section-title h1,.story-header-content h1,.player-title-row h1,.book-detail-head h1,.library-stats span,.personal-stats span,.book-detail-stats span,.home-continue .eyebrow,.my-stories-eyebrow,.my-continue-group .section-title h2,.collection-eyebrow').forEach(prepareTypewriter);
}
function prepareHoloBox(el){
  if(el.dataset.holoMotion)return;el.dataset.holoMotion='1';el.classList.add('hud-motion-box');
  if(el.parentElement?.classList.contains('library-stats')||el.parentElement?.classList.contains('personal-stats'))el.dataset.hudDelay=String([...el.parentElement.children].indexOf(el)*90);if(el.parentElement?.classList.contains('library-stats')||el.classList.contains('home-continue'))el.dataset.hudContentEarly='1';
  ['tl','tr','bl','br'].forEach(pos=>{const c=document.createElement('span');c.className=`hud-corner hud-${pos}`;c.setAttribute('aria-hidden','true');el.append(c)});
  if(motionReduced()){el.classList.add('hud-frame-on','hud-content-on','hud-motion-done','hud-progress-ready');return}
  if(el.classList.contains('progress-dashboard')){el.classList.add('hud-progress-init');hudIntersectionObserver?.observe(el);return}
  el.classList.add('hud-box-pending');hudIntersectionObserver?.observe(el);
}
function runHoloBox(el){
  const delay=Number(el.dataset.hudDelay||0);
  setTimeout(()=>{
    if(el.classList.contains('progress-dashboard')){
      el.classList.add('hud-progress-blink','hud-frame-on','hud-content-on');
      setTimeout(()=>{el.classList.remove('hud-progress-blink');el.classList.add('hud-motion-done','hud-progress-ready')},520);
      return;
    }
    const r=el.getBoundingClientRect(),cx=Math.max(0,r.width/2-8),cy=Math.max(0,r.height/2-8);
    const map={tl:[cx,cy],tr:[-cx,cy],bl:[cx,-cy],br:[-cx,-cy]};
    for(const [k,[x,y]] of Object.entries(map)){const c=el.querySelector(`.hud-${k}`);if(c){c.style.setProperty('--hud-from-x',`${x}px`);c.style.setProperty('--hud-from-y',`${y}px`)}}
    el.classList.add('hud-corners-live');
    if(el.dataset.hudContentEarly==='1'){
      el.classList.add('hud-content-on');
      el.querySelectorAll('[data-counter-early="1"]').forEach(counter=>runCounter(counter,true));
      el.querySelectorAll('[data-type-early="1"]').forEach(text=>runTypewriter(text,0));
    }
    setTimeout(()=>el.classList.add('hud-frame-on'),520);
    setTimeout(()=>{el.classList.add('hud-content-on','hud-motion-done');el.classList.remove('hud-box-pending')},760);
  },delay);
}
function prepareCounter(el){
  if(el.dataset.motionCounter)return;const raw=el.textContent.trim();if(!/^\d+$/.test(raw))return;el.dataset.motionCounter=raw;el.textContent='0';
  if(motionReduced()){el.textContent=raw;return}
  const box=el.closest('.hud-motion-box');
  if(box?.dataset.hudContentEarly==='1'){el.dataset.counterEarly='1';return}
  counterIntersectionObserver?.observe(el);
}
function runCounter(el,forceNow=false){
  if(el.dataset.counterStarted==='1')return;el.dataset.counterStarted='1';
  const target=Number(el.dataset.motionCounter||0),box=el.closest('.hud-motion-box');
  const early=box?.dataset.hudContentEarly==='1',delay=forceNow?0:(box?.classList.contains('progress-dashboard')?620:(early?0:(box&&!box.classList.contains('hud-motion-done')?1050:0))+Number(box?.dataset.hudDelay||0));
  setTimeout(()=>{const start=performance.now(),duration=680;function frame(now){const t=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-t,3);el.textContent=String(Math.round(target*ease));if(t<1)requestAnimationFrame(frame)}requestAnimationFrame(frame)},delay);
}
function runTypewriter(el,delay=0){
  if(el.dataset.typeStarted==='1')return;el.dataset.typeStarted='1';const text=el.dataset.typeText||el.getAttribute('aria-label')||'';if(!text)return;let i=0;
  setTimeout(()=>{const timer=setInterval(()=>{el.textContent=text.slice(0,++i);if(i>=text.length){clearInterval(timer);el.classList.add('typewriter-done')}},Math.max(24,Math.min(46,620/Math.max(1,text.length))))},delay);
}
function prepareTypewriter(el){
  if(el.dataset.typeMotion)return;const text=el.textContent.trim();if(!text)return;el.dataset.typeMotion='1';el.dataset.typeText=text;el.setAttribute('aria-label',text);
  if(motionReduced())return;el.textContent='';el.classList.add('typewriter-motion');const box=el.closest('.hud-motion-box'),early=box?.dataset.hudContentEarly==='1';
  if(early){el.dataset.typeEarly='1';return}
  const delay=box?.classList.contains('progress-dashboard')?620:(box?820+Number(box.dataset.hudDelay||0):(el.closest('.hero')?250:90));runTypewriter(el,delay);
}
async function showUnlockReward(id){
  document.querySelector('.unlock-reward')?.remove();
  const meta=indexData?.stories?.find(s=>s.id===id),poster=meta?displayCover(meta):'';
  const el=document.createElement('div');el.className='unlock-reward';
  el.innerHTML=`<div class="unlock-reward-flash"></div><div class="unlock-reward-stack">${poster?`<div class="unlock-reward-poster"><img src="${escAttr(poster)}" alt="Póster Story ${escapeHtml(id)}"></div>`:''}<div class="unlock-reward-card"><div class="unlock-reward-ring"><span class="unlock-reward-icon">${lockSvg(false)}</span></div><div class="unlock-reward-copy"><small>STORY ${escapeHtml(id)}</small><strong>CONTENIDO EXCLUSIVO</strong><em>ACCESO CONCEDIDO</em></div></div></div>`;
  document.body.append(el);requestAnimationFrame(()=>el.classList.add('show'));if(!motionReduced())fiveFrameHaptic();
  let closed=false,resolveClose;const manual=new Promise(r=>resolveClose=r);const close=()=>{if(closed)return;closed=true;el.classList.remove('show');setTimeout(()=>{el.remove();resolveClose()},260)};el.onclick=close;
  const wait=ms=>Promise.race([new Promise(r=>setTimeout(r,ms)),manual]);
  await wait(motionReduced()?40:500);if(closed)return;const icon=el.querySelector('.unlock-reward-icon');if(icon)icon.innerHTML=lockSvg(true);el.querySelector('.unlock-reward-copy strong').textContent='STORY DESBLOQUEADA';
  await wait(motionReduced()?40:3000);if(closed)return;el.querySelector('.unlock-reward-poster')?.classList.add('fade-poster');
  await wait(motionReduced()?30:1200);if(closed)return;close();await manual;
}
function timelinePortalSvg(){return `<svg class="portal-custom-svg timeline-portal-svg" viewBox="0 0 40 18" aria-hidden="true"><path d="M5 9h30"/><circle cx="5" cy="9" r="3"/><circle cx="20" cy="9" r="3"/><circle cx="35" cy="9" r="3"/></svg>`}
function gamepadPortalSvg(){return `<svg class="portal-custom-svg gamepad-portal-svg" viewBox="0 0 44 30" aria-hidden="true"><path d="M12 8.5h20c4.8 0 8 3.8 8 8.3l-1.2 5.1c-.7 3.1-4.5 4.1-6.6 1.7L28.5 20h-13l-3.7 3.6c-2.1 2.4-5.9 1.4-6.6-1.7L4 16.8c0-4.5 3.2-8.3 8-8.3Z"/><path d="M13 12.5v7M9.5 16h7"/><circle cx="31.5" cy="14" r="1.7"/><circle cx="35.5" cy="18" r="1.7"/><path d="M16 8.5 18 5h8l2 3.5"/></svg>`}
function storiesExplorerHtml(){return `<section class="stories-portals"><div class="stories-portals-group"><div class="portal-label">EXPLORAR</div><div class="portal-grid"><button class="portal-btn" data-portal="sagas"><span>◈</span><strong>SAGAS</strong></button><button class="portal-btn" data-portal="timeline">${timelinePortalSvg()}<strong>TIMELINE</strong></button><button class="portal-btn" data-portal="random"><span>◎</span><strong>RANDOM</strong></button><button class="portal-btn" data-portal="extras"><span>＋</span><strong>EXTRAS</strong></button></div></div><div class="stories-portals-group multimedia"><div class="portal-label">MULTIMEDIA</div><div class="portal-grid portal-grid-4"><button class="portal-btn cassette" data-portal="cassettes">${mediaIconSvg('audio')}<strong>CASSETTES</strong></button><button class="portal-btn tape" data-portal="tapes">${mediaIconSvg('video')}<strong>TAPES</strong></button><button class="portal-btn games" data-portal="games">${gamepadPortalSvg()}<strong>GAMES</strong><small>PRÓXIMAMENTE</small></button><button class="portal-btn nightmares" data-portal="micro-pesadillas"><span class="nightmare-icon-slot"><i class="nightmare-diamond"></i></span><strong>MICRO</strong><small>PRÓXIMAMENTE</small></button></div></div></section>`}
function bindStoryExplorer(){$$('[data-portal]').forEach(b=>b.onclick=()=>go(b.dataset.portal))}

function sagaById(id){return (sagasData?.sagas||[]).find(s=>String(s.id)===String(id))||null}
function sagaMembership(storyId){for(const saga of sagasData?.sagas||[]){const i=(saga.parts||[]).findIndex(p=>String(p.storyId||'')===String(storyId));if(i>=0)return{saga,part:i+1}}return null}
function sagaStoryLink(s){const m=sagaMembership(s?.id);return m?`<button class="story-saga-link" type="button" data-saga-link="${escAttr(m.saga.id)}">PERTENECE A: ${escapeHtml(m.saga.name)} · PARTE ${m.part} DE ${Number(m.saga.totalParts)||m.saga.parts.length}</button>`:''}
function bindSagaStoryLinks(){$$('[data-saga-link]').forEach(b=>b.onclick=()=>go(`saga/${encodeURIComponent(b.dataset.sagaLink)}`))}

function renderSagas(){currentStory=null;const sagas=sagasData?.sagas||[];view.innerHTML=`<section class="section v2-section sagas-section"><div class="section-title"><div><div class="eyebrow">STORIES CONECTADAS</div><h1>Sagas</h1></div></div><div class="saga-list">${sagas.length?sagas.map(sagaCard).join(''):'<div class="empty">Todavía no hay sagas configuradas.</div>'}</div></section>`;$$('[data-saga-id]').forEach(x=>x.onclick=()=>go(`saga/${encodeURIComponent(x.dataset.sagaId)}`));bindBrokenImages();maybeAutoTutorial('sagas')}
function sagaProgressData(saga){const total=Math.max(Number(saga?.totalParts)||0,(saga?.parts||[]).length),publishedStories=(saga?.parts||[]).map(p=>p.storyId?indexData.stories.find(s=>s.id===String(p.storyId)):null).filter(Boolean),published=publishedStories.length,read=publishedStories.filter(s=>isRead(s.id)).length;return{total,published,read,publishedPct:total?Math.round(published/total*100):0,readPct:total?Math.round(read/total*100):0}}
function sagaProgressBars(d){return `<div class="saga-progress"><i class="saga-progress-published" style="width:${d.publishedPct}%"></i><i class="saga-progress-read" style="width:${d.readPct}%"></i></div>`}
function sagaPartFeatureIcons(st){const a=[];if(storyHasFeature(st,'audio'))a.push(`<span class="saga-feature-icon audio" title="Audio">${mediaIconSvg('audio')}</span>`);if(storyHasFeature(st,'video'))a.push(`<span class="saga-feature-icon video" title="Vídeo">${mediaIconSvg('video')}</span>`);if(storyHasFeature(st,'extra'))a.push(`<span class="saga-feature-icon extra" title="Extras">＋</span>`);return a.join('')}
function sagaCard(saga){const d=sagaProgressData(saga);return `<button class="saga-card" data-saga-id="${escAttr(saga.id)}">${saga.banner?`<img src="${escAttr(saga.banner)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<div class="saga-banner-placeholder">SAGA</div>'}<div class="saga-card-shade"></div><div class="saga-card-copy"><span>${d.published}/${d.total} PARTES PUBLICADAS · ${d.read} LEÍDAS</span><h2>${escapeHtml(saga.name||'Saga')}</h2>${sagaProgressBars(d)}<strong>${d.publishedPct}% PUBLICADA · ${d.readPct}% LEÍDA</strong></div></button>`}
function renderSaga(id){currentStory=null;const saga=sagaById(id);if(!saga){view.innerHTML='<div class="empty">Saga no encontrada.</div>';return}const d=sagaProgressData(saga),parts=Array.from({length:d.total},(_,i)=>(saga.parts||[])[i]||{order:i+1});view.innerHTML=`<section class="section v2-section saga-detail ${saga.extraImage?'has-page-bg':''}">${saga.extraImage?`<div class="saga-page-bg" aria-hidden="true"><img src="${escAttr(saga.extraImage)}" alt=""></div>`:''}${saga.banner?`<div class="saga-detail-banner"><img src="${escAttr(saga.banner)}" alt="${escAttr(saga.name||'')}"></div>`:''}<div class="saga-detail-content"><div class="eyebrow">SAGA · ${d.published}/${d.total} PUBLICADAS · ${d.read} LEÍDAS</div><h1>${escapeHtml(saga.name||'Saga')}</h1><p class="saga-synopsis">${escapeHtml(saga.synopsis||'')}</p><div class="saga-percent"><strong>${d.publishedPct}%</strong><span>PUBLICADA · ${d.readPct}% LEÍDA</span>${sagaProgressBars(d)}</div>${saga.extraText?`<p class="saga-extra-text">${escapeHtml(saga.extraText)}</p>`:''}<div class="saga-parts">${parts.map((part,i)=>sagaPartRow(part,i+1,d.total)).join('')}</div></div></section>`;bindStoryCards();bindBrokenImages();maybeAutoTutorial('sagas')}
function sagaPartRow(part,n,total){const st=part.storyId?indexData.stories.find(s=>s.id===String(part.storyId)):null;if(!st)return `<div class="saga-part future-part"><span>PARTE ${n}</span><strong>PRÓXIMAMENTE</strong><em>${escapeHtml(part.label||'Esperando publicación')}</em></div>`;const cover=displayCover(st),read=isRead(st.id),icons=sagaPartFeatureIcons(st);return `<article class="saga-part published-part ${read?'is-read':''}" data-story-id="${escAttr(st.id)}"><span class="saga-part-order">PARTE ${n} DE ${total}</span>${cover?`<div class="saga-part-poster"><img src="${escAttr(cover)}" alt="">${exclusiveBadge(st,'cover')}</div>`:''}<div class="saga-part-copy"><strong>STORY ${escapeHtml(st.id)} · ${escapeHtml(st.title||'')}</strong><em>${bookLabel(st.book||'—')}</em>${read?'<b class="saga-read-mark">✓ LEÍDA</b>':''}</div><div class="saga-part-icons">${icons}</div></article>`}

function parseStoryYear(s){const n=Number(String(s?.year??'').replace(',','.'));return Number.isFinite(n)?n:null}
function eraForYear(y){if(y===null)return'FECHA DESCONOCIDA';if(y<-3300)return'PREHISTORIA';if(y<476)return'EDAD ANTIGUA';if(y<1453)return'EDAD MEDIA';if(y<1789)return'EDAD MODERNA';if(y<2100)return'EDAD CONTEMPORÁNEA';if(y<2150)return'NUEVO RENACIMIENTO';if(y<2400)return'NUEVOS AVANCES';return'EDAD ESPACIAL'}
function timelineYearLabel(y){if(y===null)return'—';return y<0?`${Math.abs(y)} a. C.`:`${y}`}
function timelineOrderedStories(desc=false){const groups=new Map();for(const st of (indexData.stories||[]).filter(accessibleStory)){const y=parseStoryYear(st),k=y===null?'unknown':String(y);if(!groups.has(k))groups.set(k,{year:y,stories:[]});groups.get(k).stories.push(st)}for(const g of groups.values()){const manual=(timelineData?.orders||{})[String(g.year)]||[];const pos=new Map(manual.map((id,i)=>[String(id),i]));g.stories.sort((a,b)=>{const pa=pos.has(a.id)?pos.get(a.id):9999,pb=pos.has(b.id)?pos.get(b.id):9999;return pa-pb||new Date(a.published)-new Date(b.published)})}return [...groups.values()].sort((a,b)=>{if(a.year===null)return 1;if(b.year===null)return-1;return desc?b.year-a.year:a.year-b.year})}
const timelineEraClasses={'PREHISTORIA':'era-prehistory','EDAD ANTIGUA':'era-ancient','EDAD MEDIA':'era-medieval','EDAD MODERNA':'era-modern','EDAD CONTEMPORÁNEA':'era-contemporary','NUEVO RENACIMIENTO':'era-renaissance','NUEVOS AVANCES':'era-advances','EDAD ESPACIAL':'era-space','FECHA DESCONOCIDA':'era-unknown'};
function renderTimeline(desc=false){
  currentStory=null;const groups=timelineOrderedStories(desc),total=(indexData.stories||[]).length,eras=[];
  for(const g of groups){const era=eraForYear(g.year);let block=eras.find(x=>x.era===era);if(!block){block={era,groups:[]};eras.push(block)}block.groups.push(g)}
  const html=eras.map((block,ei)=>`<section class="timeline-era-block ${timelineEraClasses[block.era]||'era-unknown'}" data-era-block><button class="timeline-era" type="button" data-era-toggle aria-expanded="true"><span>${escapeHtml(block.era)}</span><b>−</b></button><div class="timeline-era-body">${block.groups.map(g=>`<div class="timeline-year-group ${g.stories.length>1?'timeline-multi':''}"><div class="timeline-year">${escapeHtml(timelineYearLabel(g.year))}</div><div class="timeline-year-axis" aria-hidden="true"><i></i></div><div class="timeline-items">${g.stories.map(timelineItem).join('')}</div></div>`).join('')}</div></section>`).join('');
  view.innerHTML=`<section class="section v2-section timeline-section"><div class="section-title timeline-title"><div><div class="eyebrow">TIMELINE</div><h1>CRONOLOGÍA DE LAS ${total} STORIES PUBLICADAS</h1></div></div><button class="timeline-order" id="timelineOrder">${desc?'↑ FUTURO':'↓ PASADO'}</button><div class="timeline-list">${html||'<div class="empty">No hay Stories disponibles para el Timeline.</div>'}</div></section>`;
  $('#timelineOrder').onclick=()=>renderTimeline(!desc);
  $$('[data-era-toggle]').forEach(btn=>btn.onclick=()=>{const block=btn.closest('[data-era-block]'),body=block?.querySelector('.timeline-era-body'),open=btn.getAttribute('aria-expanded')==='true';btn.setAttribute('aria-expanded',String(!open));btn.querySelector('b').textContent=open?'+':'−';body?.classList.toggle('collapsed',open)});
  bindStoryCards();bindBrokenImages();
}
function timelineItem(s){const cover=displayCover(s),icons=[],read=isRead(s.id);if(storyHasFeature(s,'audio'))icons.push(`<span class="timeline-icon audio">${mediaIconSvg('audio')}</span>`);if(storyHasFeature(s,'video'))icons.push(`<span class="timeline-icon video">${mediaIconSvg('video')}</span>`);return `<article class="timeline-item ${read?'timeline-read':''}"><span class="timeline-node" aria-hidden="true"></span><button class="timeline-poster" data-story-id="${escAttr(s.id)}">${cover?`<img src="${escAttr(cover)}" alt="Story ${escAttr(s.id)}">`:`<span>${escapeHtml(s.id)}</span>`}${exclusiveBadge(s,'cover')}</button><div class="timeline-copy"><span>STORY ${escapeHtml(s.id)}</span><strong>${escapeHtml(s.title||'')}</strong>${read?'<em>✓ LEÍDA</em>':''}</div><div class="timeline-icons">${icons.join('')}</div></article>`}

function renderRandom(filter='unread'){
  stopRandomSpin(false);currentStory=null;const available=(indexData.stories||[]).filter(accessibleStory);const pool=filter==='read'?available.filter(s=>isRead(s.id)):filter==='all'?available:available.filter(s=>!isRead(s.id));const first=pool[0]||available[0];
  view.innerHTML=`<section class="section v2-section random-section"><div class="random-head"><div class="eyebrow">DEJA QUE DISTURBING STORIES DECIDA POR TI</div><h1>Ruleta Random</h1></div><div class="random-filters"><button data-random-filter="all" class="${filter==='all'?'active':''}">TODAS</button><button data-random-filter="unread" class="${filter==='unread'?'active':''}">NO LEÍDAS</button><button data-random-filter="read" class="${filter==='read'?'active':''}">LEÍDAS</button></div><div class="random-stage"><div class="random-energy" aria-hidden="true"><i></i><i></i><i></i><i></i><span></span><b></b></div><div id="randomPosterRoll" class="random-poster-roll">${first?randomPosterOnly(first):'<div class="empty">SIN STORIES</div>'}</div></div><button id="spinRandom" class="cta random-spin-btn" ${pool.length?'':'disabled'}>GIRAR RANDOM</button><div id="randomResult" class="random-result-slot"></div></section>`;
  $$('[data-random-filter]').forEach(b=>b.onclick=()=>renderRandom(b.dataset.randomFilter));$('#spinRandom').onclick=()=>randomSpinRunning?stopRandomSpin(true):spinRandom(pool);bindBrokenImages()
}
function randomPosterOnly(s){const cover=displayCover(s);return `<div class="random-roll-card">${cover?`<img src="${escAttr(cover)}" alt="Story ${escAttr(s.id)}">`:`<span>${escapeHtml(s.id)}</span>`}<b>STORY ${escapeHtml(s.id)}</b></div>`}
function spinRandom(pool){
  if(!pool.length||randomSpinRunning)return;let candidates=pool.filter(s=>s.id!==lastRandomStoryId);if(!candidates.length)candidates=pool;randomSpinPool=pool;randomSpinCurrent=candidates[Math.floor(Math.random()*candidates.length)];const stage=$('#randomPosterRoll'),result=$('#randomResult'),btn=$('#spinRandom');if(!stage||!btn)return;result.innerHTML='';result.classList.remove('reward-in');randomSpinRunning=true;btn.disabled=false;btn.textContent='DETENER RULETA';btn.classList.add('stop-mode');stage.classList.add('rolling');document.querySelector('.random-energy')?.classList.add('active');let ticks=0;
  const tick=()=>{if(!randomSpinRunning)return;let options=pool.filter(s=>s.id!==randomSpinCurrent?.id);if(!options.length)options=pool;randomSpinCurrent=options[Math.floor(Math.random()*options.length)];stage.innerHTML=randomPosterOnly(randomSpinCurrent);bindBrokenImages();ticks++;const delay=Math.max(52,92-Math.min(32,ticks));randomSpinTimer=setTimeout(tick,delay);if(ticks>=34)stopRandomSpin(true)};tick()
}
function stopRandomSpin(showResult=true){clearTimeout(randomSpinTimer);randomSpinTimer=0;if(!randomSpinRunning&&!showResult)return;const wasRunning=randomSpinRunning;randomSpinRunning=false;const stage=$('#randomPosterRoll'),btn=$('#spinRandom');if(btn){btn.textContent='GIRAR RANDOM';btn.classList.remove('stop-mode');btn.disabled=showResult||!randomSpinPool.length}document.querySelector('.random-energy')?.classList.remove('active');if(!wasRunning||!showResult||!randomSpinCurrent||!stage)return;lastRandomStoryId=randomSpinCurrent.id;stage.innerHTML=randomPosterOnly(randomSpinCurrent);stage.classList.remove('rolling');stage.classList.add('winner');setTimeout(()=>{stage.classList.remove('winner');showRandomResult(randomSpinCurrent);if(btn)btn.disabled=false},720)}
function randomResultHaptic(){try{if('vibrate' in navigator)navigator.vibrate(1000)}catch{}}
function showRandomResult(s){const el=$('#randomResult');if(!el)return;const rt=Number(s?.readTime||0);el.innerHTML=`<article class="random-result random-result-v25"><div><div class="eyebrow">RESULTADO</div><h2>${escapeHtml(s.id)} - ${escapeHtml(s.title||'')}</h2><p><span>${escapeHtml(timelineYearLabel(parseStoryYear(s)))}</span>${rt?`<span>${rt} MIN LECTURA</span>`:''}</p></div><div class="random-actions"><button class="cta" id="randomRead">LEER<br>STORY</button><button class="secondary-btn" id="randomAgain">VOLVER A<br>GIRAR</button></div></article>`;el.classList.remove('reward-in');void el.offsetWidth;el.classList.add('reward-in');randomResultHaptic();$('#randomRead').onclick=()=>storyGo(s.id);$('#randomAgain').onclick=()=>$('#spinRandom').click()}

function mediaDuration(s,type){return Number(s?.mediaDurations?.[type]||0)}
function fmtLong(seconds){seconds=Math.max(0,Math.round(Number(seconds)||0));const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),sec=seconds%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${m}:${String(sec).padStart(2,'0')}`}
function fmtTotalDuration(seconds){seconds=Math.max(0,Math.round(Number(seconds)||0));const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),sec=seconds%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`}
function renderMediaCollection(type){currentStory=null;const isAudio=type==='audio',items=(indexData.stories||[]).filter(s=>accessibleStory(s)&&storyHasFeature(s,type)),durations=items.map(s=>mediaDuration(s,type)),complete=items.length>0&&durations.every(x=>x>0),total=complete?durations.reduce((a,b)=>a+b,0):0;view.innerHTML=`<section class="section v2-section media-collection ${isAudio?'cassettes':'tapes'}"><div class="media-section-head"><div>${mediaIconSvg(type)}<div><div class="eyebrow">DISTURBING STORIES</div><h1>${isAudio?'Disturbing Cassettes':'Disturbing Tapes'}</h1></div></div><div class="media-summary"><div><span>TOTAL</span><strong>${items.length}</strong><em>${isAudio?'CASSETTES':'TAPES'}</em></div><div><span>DURACIÓN TOTAL</span><strong>${complete?fmtTotalDuration(total):'PENDIENTE'}</strong></div></div></div><div class="media-catalog">${items.length?items.map(s=>mediaCollectionItem(s,type)).join(''):'<div class="empty">No hay contenido disponible en esta sección.</div>'}</div></section>`;$$('[data-media-story]').forEach(el=>el.onclick=()=>navigateHash(`#/story/${encodeURIComponent(el.dataset.mediaStory)}/${encodeURIComponent(el.dataset.mediaTab)}`));bindBrokenImages()}
function mediaCollectionItem(s,type){const cover=displayCover(s),d=mediaDuration(s,type);return `<article class="media-collection-card" data-media-story="${escAttr(s.id)}" data-media-tab="${escAttr(type)}">${cover?`<div class="media-collection-poster"><img src="${escAttr(cover)}" alt="">${readCornerBadge(s)}${newStoryBadge(s)}${exclusiveBadge(s,'cover')}</div>`:''}<div class="media-collection-copy"><span>STORY ${escapeHtml(s.id)}</span><strong>${escapeHtml(s.title||'')}</strong><em>${d?fmtLong(d):'DURACIÓN PENDIENTE'}</em></div></article>`}

function renderExtras(){currentStory=null;const items=[...(extrasData?.extras||[])].sort((a,b)=>Number(a.number)-Number(b.number));view.innerHTML=`<section class="section v2-section extras-section"><div class="section-title"><div><div class="eyebrow">COLECCIÓN INDEPENDIENTE</div><h1>Extras</h1></div></div><div class="extras-grid">${items.length?items.map(extraCard).join(''):'<div class="empty">Todavía no hay Extras configurados.</div>'}</div></section>`;$$('[data-extra-id]').forEach(b=>b.onclick=()=>go(`extra/${encodeURIComponent(b.dataset.extraId)}`));bindBrokenImages()}
function extraCard(x){const physical=x.availability==='physical';return `<button class="extra-card" data-extra-id="${escAttr(x.id||x.number)}">${x.poster?`<img src="${escAttr(x.poster)}" alt="">`:'<div class="extra-poster-placeholder">EXTRA</div>'}<div><span>EXTRA ${String(x.number||'').padStart(2,'0')} · LIBRO ${escapeHtml(x.book||'—')}</span><strong>${escapeHtml(x.title||'')}</strong>${physical?'<em>▣ CONTENIDO EXCLUSIVO DE LA EDICIÓN FÍSICA</em>':'<em>APP / DIGITAL</em>'}</div></button>`}
function renderExtra(id){currentStory=null;const x=(extrasData?.extras||[]).find(e=>String(e.id||e.number)===String(id));if(!x){view.innerHTML='<div class="empty">Extra no encontrado.</div>';return}const physical=x.availability==='physical';view.innerHTML=`<section class="section v2-section extra-detail"><div class="eyebrow">EXTRA ${String(x.number||'').padStart(2,'0')} · LIBRO ${escapeHtml(x.book||'—')}</div><h1>${escapeHtml(x.title||'Extra')}</h1>${x.poster?`<img class="extra-main-poster" src="${escAttr(x.poster)}" alt="">`:''}${physical?'<div class="physical-extra-notice"><strong>▣ CONTENIDO EXCLUSIVO DE LA EDICIÓN FÍSICA</strong><p>Este Extra forma parte del libro físico y no tiene versión digital en la app.</p></div>':`${x.image?`<img class="extra-additional-image" src="${escAttr(x.image)}" alt="">`:''}${x.text?`<div class="extra-text">${escapeHtml(x.text).replace(/\n/g,'<br>')}</div>`:''}`}${x.link?`<a class="cta extra-destination" href="${escAttr(x.link)}" target="_blank" rel="noopener noreferrer">ABRIR CONTENIDO ›</a>`:''}</section>`;bindBrokenImages()}

function spotifyCompanionHtml(){return `<a class="spotify-companion" href="https://open.spotify.com/playlist/6iBml49G6knFOOAW0wy1dW" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M7.5 9.3c3.3-1 7.2-.65 9.65.75M8.1 12.2c2.7-.75 6-.45 8.35.65M8.7 15c2.2-.55 4.7-.3 6.65.55"/></svg><span><strong>SPOTIFY · DISTURBING COMPANION</strong></span><b>↗</b></a>`}

function maybeAutoTutorial(){return}

function renderFuturePlaceholder(title,tone){currentStory=null;view.innerHTML=`<section class="section v2-section future-placeholder ${escAttr(tone)}"><div class="eyebrow">PREPARADO PARA FUTURA ITERACIÓN</div><h1>${escapeHtml(title)}</h1><div class="future-placeholder-box"><strong>PRÓXIMAMENTE</strong><p>La entrada visual ya forma parte de Disturbing Stories App v2.15. Su contenido se desarrollará en una iteración posterior.</p></div></section>`}

async function playEntryIntro(){const onceKey='disturbing_intro_played_session_v26';if(introPlayed||sessionStorage.getItem(onceKey)==='1')return;introPlayed=true;sessionStorage.setItem(onceKey,'1');const layer=$('#introLayer'),video=$('#introVideo');if(!layer||!video)return;layer.classList.remove('hidden');layer.setAttribute('aria-hidden','false');let finished=false;try{video.currentTime=0}catch{}return new Promise(resolve=>{const done=()=>{if(finished)return;finished=true;clearTimeout(fallback);try{video.pause()}catch{}layer.classList.add('intro-out');setTimeout(()=>{layer.classList.add('hidden');layer.classList.remove('intro-out');layer.setAttribute('aria-hidden','true');resolve()},220)};const start=()=>{clearTimeout(fallback);const p=video.play();if(p&&typeof p.catch==='function')p.catch(done)};const fallback=setTimeout(done,2500);layer.onclick=done;video.addEventListener('ended',done,{once:true});video.addEventListener('error',done,{once:true});if(video.readyState>=3)start();else video.addEventListener('canplay',start,{once:true})})}

async function registerSW(){if('serviceWorker'in navigator){try{let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload()});const reg=await navigator.serviceWorker.register('./sw.js?v=2.15.0',{updateViaCache:'none'});try{await reg.update()}catch{} }catch(e){console.warn('SW',e)}}}
boot();
