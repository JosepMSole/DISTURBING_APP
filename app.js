const APP_VERSION = '1.10.0';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const view=$('#view');
let indexData=null,currentStory=null,currentTab='read',installPrompt=null,qrScanner=null,qrScanBusy=false,resumeOnOpen=false,storyInitialOpen=false,lastReadingSaveAt=0,bookAssets={};
const unlockSecretsKey='disturbing_unlock_secrets_v2';
const readKey='disturbing_read_v2';
const coverCacheKey='disturbing_cover_cache_v1';
const storiesViewKey='disturbing_stories_view_v1';
const readProgressKey='disturbing_read_progress_v1';
const readingStateKey='disturbing_read_state_v1';
const storiesSortKey='disturbing_stories_sort_v1';
const playerStateKey='disturbing_player_state_v1';
const playerDurationKey='disturbing_player_duration_v1';
const PLAYER_MANIFEST='https://raw.githubusercontent.com/JosepMSole/DisturbingPlayer/main/music/manifest.json';
const PLAYER_MUSIC_BASE='https://josepmsole.github.io/DisturbingPlayer/music/';
let playerTracks=[],playerIndex=0,playerShuffle=false,playerRepeatMode='off',playerActivated=false,playerManifestLoading=null,playerDurationLoading=null,playerWasPlayingBeforeMedia=false;
let navHistory=[],navGoingBack=false,storyTransitionBusy=false;

const store={get(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}},set(k,v){localStorage.setItem(k,JSON.stringify(v))}};

async function boot(){showLoading();try{const r=await fetch('./data/stories.json',{cache:'no-store'});if(!r.ok)throw new Error(`stories.json: HTTP ${r.status}`);indexData=await r.json();indexData.stories=(indexData.stories||[]).sort((a,b)=>new Date(b.published)-new Date(a.published));try{const br=await fetch('./data/books.json',{cache:'no-store'});if(br.ok)bookAssets=(await br.json()).books||{}}catch{}bindShell();initMotionSystem();initPlayer();routeFromHash();registerSW();}catch(e){view.innerHTML=`<div class="empty"><h2>No se pudieron cargar las Stories</h2><p>${escapeHtml(e.message)}</p><p>Usa el lanzador local incluido en el paquete.</p></div>`;}}
function bindShell(){$('#brandBtn').onclick=()=>go('home');$('#backBtn').onclick=navigateBack;$('#headerPlayerBtn').onclick=()=>go('player');$('#toTopHeaderBtn').onclick=()=>scrollTo({top:0,behavior:'smooth'});$('#menuBtn').onclick=openDrawer;$('#closeDrawer').onclick=closeDrawer;$('#scrim').onclick=closeDrawer;$$('.nav-btn').forEach(b=>b.onclick=()=>go(b.dataset.route));$$('[data-drawer-route]').forEach(b=>b.onclick=()=>{closeDrawer();go(b.dataset.drawerRoute)});$('#miniPlayerOpen').onclick=()=>go('player');$('#miniPrev').onclick=()=>playerStep(-1,true);$('#miniPlay').onclick=()=>playerToggle();$('#miniNext').onclick=()=>playerStep(1,true);$('#scanBtn').onclick=()=>{closeDrawer();showUnlock()};$('#installBtn').onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$('#installBtn').classList.add('hidden')}};addEventListener('hashchange',routeFromHash);addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('#installBtn').classList.remove('hidden')});addEventListener('scroll',updateProgress,{passive:true});addEventListener('pagehide',persistCurrentReadingPosition);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistCurrentReadingPosition()});addEventListener('blur',()=>setTimeout(()=>{if(currentStory&&document.activeElement?.tagName==='IFRAME')playerPauseForStoryMedia()},0));addEventListener('resize',()=>{if(routeName()==='collection')requestAnimationFrame(fitCollectionShelf)},{passive:true});}
function currentHash(){return location.hash||'#/home'}
function navigateHash(target){const cur=currentHash();if(cur===target)return;navHistory.push(cur);if(navHistory.length>5)navHistory=navHistory.slice(-5);location.hash=target}
function go(r){navigateHash(`#/${r}`)}
function routeFallback(){const p=currentHash().replace(/^#\//,'').split('/'),route=p[0]||'home';if(route==='story')return '#/stories';if(route==='collection'&&p[1])return '#/collection';if(route!=='home')return '#/home';return ''}
function updateBackButton(){const btn=$('#backBtn'),fallback=routeFallback();if(!btn)return;const can=navHistory.length>0||!!fallback;btn.classList.toggle('hidden',!can);btn.disabled=!can}
function navigateBack(){if(navHistory.length){const target=navHistory.pop();navGoingBack=true;location.hash=target;return}const fallback=routeFallback();if(fallback){navGoingBack=true;location.hash=fallback}}
function fiveFrameHaptic(){try{if('vibrate' in navigator)navigator.vibrate([24,26,24,26,24,26,24,26,24])}catch{}}
function playStoryEnterTransition(id){if(storyTransitionBusy){return}const target=`#/story/${encodeURIComponent(id)}`;if(matchMedia('(prefers-reduced-motion: reduce)').matches){navigateHash(target);return}storyTransitionBusy=true;fiveFrameHaptic();const shell=$('#app'),card=document.querySelector(`[data-story-id="${CSS.escape(id)}"]`);card?.classList.add('story-enter-target');shell?.classList.add('story-entering');setTimeout(()=>{card?.classList.remove('story-enter-target');shell?.classList.remove('story-entering');storyTransitionBusy=false;navigateHash(target)},270)}
function storyGo(id,resume=false){if(resume){navigateHash(`#/story/${encodeURIComponent(id)}/resume`);return}playStoryEnterTransition(id)}
function routeFromHash(){persistCurrentReadingPosition();stopQrScanner();const p=currentHash().replace(/^#\//,'').split('/'),route=p[0]||'home',isResume=route==='story'&&p[2]==='resume';if(!isResume)scrollTo({top:0,behavior:'auto'});setNav(route);updateBackButton();$('#headerPlayerBtn').classList.toggle('hidden',route!=='home');$('#toTopHeaderBtn').classList.add('hidden');if(route==='home')return renderHome();if(route==='stories')return renderStories('all');if(route==='unlocked')return renderMyStories();if(route==='collection')return renderCollection(decodeURIComponent(p[1]||''));if(route==='player')return renderPlayer();if(route==='story')return renderStory(decodeURIComponent(p[1]||''),isResume);renderHome();}
function setNav(route){$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.route===route||(route==='story'&&b.dataset.route==='stories')));updateMiniPlayerVisibility(route)}
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
function exclusiveState(s){if(s?.access!=='exclusive')return'';return isLocked(s)?'locked':'unlocked'}
function lockSvg(open=false){return open?`<svg class="lock-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 10V7.5a4.2 4.2 0 0 1 7.8-2.2"/><rect x="5.2" y="10" width="13.6" height="10.2" rx="2.2"/><circle cx="12" cy="15.1" r="1.15"/></svg>`:`<svg class="lock-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.7 10V7.4a4.3 4.3 0 0 1 8.6 0V10"/><rect x="5.2" y="10" width="13.6" height="10.2" rx="2.2"/><circle cx="12" cy="15.1" r="1.15"/></svg>`}
function exclusiveBadge(s,kind='cover'){if(s?.access!=='exclusive')return'';const state=exclusiveState(s),open=state==='unlocked';return `<span class="ex-badge ex-${state} ${kind==='inline'?'ex-inline':''}" title="Exclusiva ${open?'desbloqueada':'bloqueada'}" aria-label="Exclusiva ${open?'desbloqueada':'bloqueada'}">${lockSvg(open)}</span>`}
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
function storySortBadge(s,sortMode=''){let value='';if(sortMode==='published-desc'||sortMode==='published-asc')value=formatDate(s.published);else if(sortMode==='id-asc'||sortMode==='id-desc')value=String(s.id||'').padStart(3,'0');else if(sortMode==='year-asc'||sortMode==='year-desc')value=String(s.year||'—');if(!value||sortMode==='title-asc')return'';return `<span class="sort-badge" aria-hidden="true">${escapeHtml(value)}</span>`}
function bookFeatureSummary(stories){const audio=stories.filter(s=>storyHasFeature(s,'audio')).length,video=stories.filter(s=>storyHasFeature(s,'video')).length,exclusive=stories.filter(s=>s.access==='exclusive').length;return `<div class="book-feature-counts" aria-label="Contenido publicado de este libro"><span class="book-feature-count audio" title="${audio} audios">${mediaIconSvg('audio')}<b>${audio}</b></span><span class="book-feature-count video" title="${video} vídeos">${mediaIconSvg('video')}<b>${video}</b></span><span class="book-feature-count exclusive" title="${exclusive} exclusivas">${lockSvg(false)}<b>${exclusive}</b></span></div>`}

function isLocked(s){return s.access==='exclusive'&&!secretMap()[s.id]}
function displayCover(s){if(!s)return'';return s.cover||coverCache()[s.id]||''}
function heroMedia(s){const image=displayFeatured(s);return `<div class="hero-media hero-story-media">${image?`<img class="hero-backdrop" src="${escAttr(image)}" alt="" aria-hidden="true" loading="eager" referrerpolicy="no-referrer"><img class="hero-main-image" src="${escAttr(image)}" alt="" loading="eager" referrerpolicy="no-referrer">`:`<div class="hero-placeholder">${escapeHtml(s.id||'')}</div>`}${storyMediaBadges(s)}</div>}`}
function displayFeatured(s){if(!s)return'';return s.featuredImage||displayCover(s)||''}
function storyFeaturedMedia(s,locked=false){const image=locked?displayCover(s):displayFeatured(s);return `<div class="story-featured">${image?`<img src="${escAttr(image)}" alt="${escAttr(s.title||'')}" loading="eager" decoding="async" referrerpolicy="no-referrer">`:`<div class="story-featured-placeholder">${escapeHtml(s.id||'')}</div>`}${storyMediaBadges(s)}</div>`}

function renderHome(){
  currentStory=null;
  const latest=indexData.stories[0];
  if(!latest){view.innerHTML='<div class="empty">Todavía no hay Stories publicadas.</div>';return}
  const reading=latestInProgress(),readCount=publishedReadCount(),total=indexData.stories.length,global=total?readCount/total:0;
  const continueCover=reading?displayCover(reading):'',continueHtml=reading?`<section class="home-continue"><div class="home-continue-cover story-thumb-wrap">${continueCover?`<img src="${escAttr(continueCover)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span>${escapeHtml(reading.id)}</span>`}${exclusiveBadge(reading,'cover')}${storyMediaBadges(reading)}</div><div class="home-continue-copy"><div class="eyebrow">Continuar leyendo</div><strong>STORY ${escapeHtml(reading.id)} · ${escapeHtml(reading.title)}</strong><div class="mini-progress"><span style="width:${pct(storyProgress(reading.id))}"></span></div><small>${pct(storyProgress(reading.id))}</small></div><button id="continueReading" class="continue-btn">CONTINUAR</button></section>`:'';
  view.innerHTML=`<section class="hero latest-storm">${heroMedia(latest)}<div class="storm-fx" aria-hidden="true"><span class="storm-cloud storm-cloud-a"></span><span class="storm-cloud storm-cloud-b"></span><span class="storm-cloud storm-cloud-c"></span><span class="storm-glow"></span><span class="storm-flash storm-flash-a"></span><span class="storm-flash storm-flash-b"></span><span class="lightning lightning-a"></span><span class="lightning lightning-b"></span></div><div class="hero-content"><div class="eyebrow">ÚLTIMA PUBLICACIÓN · ${formatDate(latest.published)}</div><div class="story-number">STORY ${escapeHtml(latest.id)}</div><h1>${escapeHtml(latest.title)}</h1><div class="meta-row">${latest.access==='exclusive'?'<span class="pill red">EXCLUSIVA</span>':'<span class="pill">GRATIS</span>'}${latest.readTime?`<span class="pill">${escapeHtml(latest.readTime)} min</span>`:''}${isRead(latest.id)?'<span class="pill read-pill">✓ LEÍDA</span>':''}</div><button class="cta" id="openLatest">${isLocked(latest)?'VER STORY':'ENTRAR'}</button></div></section>${continueHtml}<section class="home-progress"><div class="home-progress-copy"><div class="eyebrow">Tu progreso</div><strong>${readCount} / ${total} STORIES LEÍDAS</strong></div><div class="collection-progress"><span style="width:${pct(global)}"></span></div><button id="openMyStories" class="link-btn">VER MIS STORIES ›</button></section><section class="section home-previous"><div class="section-title"><h2>Publicadas anteriormente</h2><small>4 anteriores</small></div><div class="story-list">${indexData.stories.slice(1,5).map(storyCard).join('')}</div></section>`;
  $('#openLatest').onclick=()=>storyGo(latest.id);
  $('#openMyStories').onclick=()=>go('unlocked');
  if(reading)$('#continueReading').onclick=()=>storyGo(reading.id,true);
  bindStoryCards();bindBrokenImages();
}

function renderStories(initial='all'){
  currentStory=null;
  const savedView=store.get(storiesViewKey,'covers'),validViews=['covers','grid','list'];
  let viewMode=validViews.includes(savedView)?savedView:'covers',currentFilter=initial,search='',sortMode=store.get(storiesSortKey,'published-desc'),feature='all',category='all',book='all';
  const categories=[...new Set(indexData.stories.flatMap(s=>s.categories||[]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'es',{sensitivity:'base'}));
  const books=[...new Set(indexData.stories.map(s=>String(s.book||'').trim()).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  const readCount=publishedReadCount(),available=availableStoryCount(),total=indexData.stories.length;
  view.innerHTML=`<section class="section stories-section"><div class="section-title"><div><div class="eyebrow">TODAS LAS</div><h1>Stories</h1></div></div><div class="library-stats" aria-label="Estado de la biblioteca"><div><strong>${readCount}</strong><span>LEÍDAS</span></div><div><strong>${available}</strong><span>DISPONIBLES PARA TI</span></div><div><strong>${total}</strong><span>PUBLICADAS</span></div></div><div class="library-controls"><label class="story-search"><span>⌕</span><input id="storySearch" type="search" placeholder="Buscar título o número…" autocomplete="off"></label><select id="storySort" class="story-select" aria-label="Ordenar Stories"><option value="published-desc">Más recientes</option><option value="published-asc">Más antiguas</option><option value="id-asc">Número · 001 → 300</option><option value="id-desc">Número · 300 → 001</option><option value="year-asc">Año historia · menor</option><option value="year-desc">Año historia · mayor</option><option value="title-asc">Título · A → Z</option></select></div><div class="story-control-strip"><select id="statusFilter" class="story-select" aria-label="Filtrar por estado"><option value="all">Todas las Stories</option><option value="public">Gratis</option><option value="exclusive">Exclusivas</option><option value="unlocked">Desbloqueadas</option><option value="read">Leídas</option><option value="unread">No leídas</option></select><button id="toggleAdvancedFilters" class="advanced-toggle" type="button" aria-expanded="false">MÁS FILTROS ▾</button><div class="view-modes" role="group" aria-label="Modo de visualización"><button class="view-mode" data-view="covers" title="Solo portadas" aria-label="Solo portadas">▦</button><button class="view-mode" data-view="grid" title="Mosaico" aria-label="Mosaico">▤</button><button class="view-mode" data-view="list" title="Lista" aria-label="Lista">☷</button></div></div><div id="advancedFilters" class="advanced-filters hidden"><select id="categoryFilter" class="story-select" aria-label="Filtrar por categoría"><option value="all">Todas las categorías</option>${categories.map(c=>`<option value="${escAttr(c)}">${escapeHtml(c)}</option>`).join('')}</select><select id="bookFilter" class="story-select" aria-label="Filtrar por libro"><option value="all">Todos los libros</option>${books.map(b=>`<option value="${escAttr(b)}">Libro ${escapeHtml(b)}</option>`).join('')}</select><select id="featureFilter" class="story-select" aria-label="Filtrar por contenido"><option value="all">Todo el contenido</option><option value="audio">Con audio</option><option value="video">Con vídeo</option><option value="extra">Con extras</option></select></div><div id="storiesCount" class="results-count"></div><div id="storiesList"></div></section>`;
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
  $('#storySort').onchange=e=>{sortMode=e.target.value;store.set(storiesSortKey,sortMode);draw()};
  $('#statusFilter').onchange=e=>{currentFilter=e.target.value;draw()};
  $('#categoryFilter').onchange=e=>{category=e.target.value;draw()};
  $('#bookFilter').onchange=e=>{book=e.target.value;draw()};
  $('#featureFilter').onchange=e=>{feature=e.target.value;draw()};
  $('#toggleAdvancedFilters').onclick=()=>{const box=$('#advancedFilters'),open=box.classList.toggle('hidden')===false;$('#toggleAdvancedFilters').setAttribute('aria-expanded',String(open));$('#toggleAdvancedFilters').textContent=open?'MENOS FILTROS ▴':'MÁS FILTROS ▾'};
  $$('.view-mode').forEach(b=>b.onclick=()=>{viewMode=b.dataset.view;store.set(storiesViewKey,viewMode);draw()});
  draw();
}
function storySorter(mode){
  if(mode==='published-asc')return(a,b)=>new Date(a.published)-new Date(b.published);
  if(mode==='id-asc')return(a,b)=>Number(a.id)-Number(b.id);
  if(mode==='id-desc')return(a,b)=>Number(b.id)-Number(a.id);
  if(mode==='year-asc')return(a,b)=>(Number(a.year)||999999)-(Number(b.year)||999999)||Number(a.id)-Number(b.id);
  if(mode==='year-desc')return(a,b)=>(Number(b.year)||-999999)-(Number(a.year)||-999999)||Number(a.id)-Number(b.id);
  if(mode==='title-asc')return(a,b)=>String(a.title||'').localeCompare(String(b.title||''),'es',{sensitivity:'base'});
  return(a,b)=>new Date(b.published)-new Date(a.published);
}
function renderMyStories(){
  currentStory=null;
  scrollTo({top:0,behavior:'auto'});requestAnimationFrame(()=>scrollTo({top:0,behavior:'auto'}));
  const readIds=new Set(readList()),secrets=secretMap(),progress=inProgressStories(),readCount=publishedReadCount(),total=indexData.stories.length,available=availableStoryCount(),unlocked=indexData.stories.filter(s=>s.access==='exclusive'&&secrets[s.id]),unreadAccessible=indexData.stories.filter(s=>accessibleStory(s)&&!readIds.has(s.id));
  view.innerHTML=`<section class="section my-stories"><div class="section-title my-stories-title"><div><div class="eyebrow">Tu colección personal</div><h1>Mis Stories</h1></div><div class="unread-callout"><strong><b>${unreadAccessible.length}</b> Stories todavía por leer</strong></div></div><div class="progress-dashboard"><div class="progress-big"><strong>${readCount}</strong><span class="progress-denom">de ${available}</span><em>DISPONIBLES LEÍDAS</em></div><div class="progress-side"><div class="collection-progress large"><span style="width:${pct(available?readCount/available:0)}"></span></div><p>${readCount===available&&available?'✓ Has leído todas las Stories que tienes disponibles.':'Completa las Stories que tienes disponibles y haz crecer tu colección.'}</p></div></div><div class="personal-stats"><div><strong>${progress.length}</strong><span>EN PROGRESO</span></div><div><strong>${unlocked.length}</strong><span>DESBLOQUEADAS</span></div><div><strong>${unreadAccessible.length}</strong><span>PENDIENTES</span></div></div>${progress.length?`<section class="my-group"><div class="section-title compact"><h2>Continuar leyendo</h2><small>${progress.length}</small></div><div class="continue-list">${progress.slice(0,6).map(continueCard).join('')}</div></section>`:''}<section class="my-group"><div class="my-tabs"><button class="my-filter" data-my="read">LEÍDAS</button><button class="my-filter" data-my="unlocked">DESBLOQUEADAS</button><button class="my-filter active" data-my="unread">NO LEÍDAS</button></div><div id="myStoriesGrid" class="stories-view stories-view-covers"></div></section></section>`;
  const draw=(mode='unread')=>{ $$('.my-filter').forEach(b=>b.classList.toggle('active',b.dataset.my===mode));let a=[];if(mode==='read')a=indexData.stories.filter(s=>readIds.has(s.id));if(mode==='unlocked')a=unlocked;if(mode==='unread')a=unreadAccessible;a.sort((x,y)=>new Date(y.published)-new Date(x.published));$('#myStoriesGrid').innerHTML=a.length?a.map(s=>storyCard(s,'covers')).join(''):'<div class="empty my-empty">Todavía no hay Stories en esta sección.</div>';bindStoryCards();bindBrokenImages();};
  $$('.my-filter').forEach(b=>b.onclick=()=>draw(b.dataset.my));
  $$('[data-resume-id]').forEach(b=>b.onclick=()=>storyGo(b.dataset.resumeId,true));
  draw('unread');bindBrokenImages();
}
function continueCard(s){const pr=storyProgress(s.id),cover=displayCover(s);return `<article class="continue-card"><button class="continue-cover story-thumb-wrap" data-resume-id="${escAttr(s.id)}">${cover?`<img src="${escAttr(cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span>${escapeHtml(s.id)}</span>`}${exclusiveBadge(s,'cover')}${storyMediaBadges(s)}</button><div class="continue-copy"><div class="story-number">STORY ${escapeHtml(s.id)}</div><strong>${escapeHtml(s.title)}</strong><div class="mini-progress"><span style="width:${pct(pr)}"></span></div><small>${pct(pr)}</small></div><button class="resume-arrow" data-resume-id="${escAttr(s.id)}" aria-label="Continuar Story ${escAttr(s.id)}">›</button></article>`}

function storyCard(s,mode='list',sortMode=''){
  const locked=isLocked(s),read=isRead(s.id),cover=displayCover(s),pr=storyProgress(s.id),ex=exclusiveBadge(s,'cover'),media=storyMediaBadges(s),sortBadge=storySortBadge(s,sortMode);
  const image=cover?`<img class="story-thumb" src="${escAttr(cover)}" alt="${escAttr(s.title||('Story '+s.id))}" loading="lazy" referrerpolicy="no-referrer">`:`<div class="story-thumb story-thumb-placeholder">${escapeHtml(s.id)}</div>`;
  const thumb=`<div class="story-thumb-wrap">${image}${sortBadge}${ex}${media}</div>`;
  if(mode==='covers')return `<article class="story-cover-card" data-story-id="${escAttr(s.id)}" aria-label="Story ${escAttr(s.id)} · ${escAttr(s.title||'')}">${image}${sortBadge}${read?'<span class="cover-read">✓ LEÍDA</span>':pr>.015?`<span class="cover-progress">${pct(pr)}</span>`:''}${ex}${media}</article>`;
  if(mode==='grid')return `<article class="story-grid-card" data-story-id="${escAttr(s.id)}">${image}${sortBadge}<div class="story-grid-copy"><div class="story-number">STORY ${escapeHtml(s.id)}</div><h3>${escapeHtml(s.title)}</h3><p>${s.access==='exclusive'?(locked?'EXCLUSIVA · BLOQUEADA':'EXCLUSIVA · DESBLOQUEADA'):'GRATIS'}${read?' · LEÍDA':''}</p></div>${ex}${media}</article>`;
  return `<article class="story-card" data-story-id="${escAttr(s.id)}">${thumb}<div class="story-copy"><div class="story-number">STORY ${escapeHtml(s.id)} · ${formatDate(s.published)}</div><h3>${escapeHtml(s.title)}</h3><p>${s.access==='exclusive'?(locked?'Exclusiva · bloqueada':'Exclusiva · desbloqueada'):'Gratis'}${read?' · Leída':''}</p></div><div class="story-state">${read?'✓':'›'}</div></article>`;
}
function bindStoryCards(){$$('[data-story-id]').forEach(el=>el.onclick=()=>storyGo(el.dataset.storyId))}

function bookAsset(book){const k=String(Number(book)||book);return bookAssets?.[k]||{}}
function bookLabel(book){return `Book#${Number(book)||book}`}
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
    const stories=[...books.get(bookId)].sort((a,b)=>new Date(b.published)-new Date(a.published)),read=stories.filter(s=>readIds.has(s.id)).length,available=stories.filter(accessibleStory).length,asset=bookAsset(bookId),hasAudio=stories.some(s=>storyHasFeature(s,'audio')),hasVideo=stories.some(s=>storyHasFeature(s,'video'));
    const covers=[asset.front&&`<figure class="book-cover-side"><img class="book-product-front" src="${escAttr(asset.front)}" alt="Portada ${escAttr(bookLabel(bookId))}"><figcaption>PORTADA</figcaption></figure>`,asset.back&&`<figure class="book-cover-side"><img class="book-product-back" src="${escAttr(asset.back)}" alt="Contraportada ${escAttr(bookLabel(bookId))}"><figcaption>CONTRAPORTADA</figcaption></figure>`].filter(Boolean).join('');
    view.innerHTML=`<section class="section collection-section"><button class="collection-back" id="collectionBack">‹ COLECCIÓN</button><div class="book-detail-head"><div><div class="eyebrow">Tu colección</div><div class="book-detail-title-row"><h1>${escapeHtml(bookLabel(bookId))}</h1>${bookFeatureSummary(stories)}</div></div>${covers?`<div class="book-cover-spread ${asset.back?'':'single'}">${covers}</div>`:''}</div>${asset.amazon?`<a class="amazon-buy-btn" href="${escAttr(asset.amazon)}" target="_blank" rel="noopener noreferrer"><span class="amazon-buy-copy">COMPRAR EN <span class="amazon-wordmark">AMAZON</span></span></a>`:''}<div class="book-detail-stats"><div><strong>${read}</strong><span>LEÍDAS</span></div><div><strong>${available}</strong><span>DISPONIBLES</span></div><div><strong>${stories.length}</strong><span>PUBLICADAS</span></div></div><div class="collection-progress large"><span style="width:${pct(stories.length?read/stories.length:0)}"></span></div><div class="book-story-filters"><button class="book-story-filter active" data-book-feature="all">TODAS</button>${hasAudio?'<button class="book-story-filter" data-book-feature="audio">CON AUDIO</button>':''}${hasVideo?'<button class="book-story-filter" data-book-feature="video">CON VÍDEO</button>':''}</div><div id="bookStoriesGrid" class="stories-view stories-view-covers collection-story-grid"></div></section>`;
    const draw=(feature='all')=>{let a=stories;if(feature!=='all')a=stories.filter(st=>storyHasFeature(st,feature));$('#bookStoriesGrid').innerHTML=a.map(st=>storyCard(st,'covers')).join('')||'<div class="empty">No hay Stories con este contenido.</div>';$$('.book-story-filter').forEach(b=>b.classList.toggle('active',b.dataset.bookFeature===feature));bindStoryCards();bindBrokenImages()};
    $$('.book-story-filter').forEach(b=>b.onclick=()=>draw(b.dataset.bookFeature));$('#collectionBack').onclick=()=>go('collection');draw();return;
  }
  const shelf=ordered.map(([book])=>{const a=bookAsset(book),has=!!a.spine;return `<button class="shelf-book ${has?'has-spine':'fallback-spine'}" data-book-scroll="${escAttr(book)}" aria-label="Ir a ${escAttr(bookLabel(book))}">${has?`<img src="${escAttr(a.spine)}" alt="${escAttr(bookLabel(book))}">`:`<span>${escapeHtml(bookLabel(book))}</span>`}</button>`}).join('');
  const cards=ordered.map(([book,stories])=>{stories.sort((a,b)=>new Date(b.published)-new Date(a.published));const read=stories.filter(s=>readIds.has(s.id)).length,asset=bookAsset(book),thumbs=stories.slice(0,3).map(s=>displayCover(s)).filter(Boolean);const visual=asset.front?`<div class="book-front"><img src="${escAttr(asset.front)}" alt="${escAttr(bookLabel(book))}" loading="lazy"></div>`:`<div class="book-thumbs">${thumbs.length?thumbs.map(src=>`<img src="${escAttr(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join(''):`<div class="book-placeholder">${escapeHtml(book)}</div>`}</div>`;return `<article id="book-${escAttr(book)}" class="book-card" data-book-id="${escAttr(book)}">${visual}<div class="book-copy"><h2>${escapeHtml(bookLabel(book))}</h2><div class="book-numbers-row"><div class="book-numbers"><strong>${read}/15</strong><span>LEÍDAS</span></div>${bookFeatureSummary(stories)}</div><div class="collection-progress"><span style="width:${pct(read/15)}"></span></div><span class="book-open">VER STORIES ›</span></div></article>`}).join('');
  view.innerHTML=`<section class="section collection-section"><div class="section-title"><div><div class="eyebrow">BIBLIOTECA DE LA</div><h1>Colección</h1></div></div><p class="collection-intro">Progreso por libro según las Stories ya publicadas. Cada exclusiva se desbloquea individualmente con su propio QR.</p>${shelf?`<div class="book-shelf-wrap"><div class="book-shelf-title">ESTANTERÍA</div><div class="book-shelf">${shelf}</div><div class="shelf-board"></div></div>`:''}<div class="books-grid">${cards||'<div class="empty">Todavía no hay libros con Stories publicadas.</div>'}</div></section>`;
  $$('[data-book-id]').forEach(el=>el.onclick=()=>go(`collection/${el.dataset.bookId}`));$$('[data-book-scroll]').forEach(el=>el.onclick=()=>document.getElementById(`book-${el.dataset.bookScroll}`)?.scrollIntoView({behavior:'smooth',block:'start'}));bindBrokenImages();requestAnimationFrame(fitCollectionShelf);
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
async function ensurePlaylistTotalDuration(){if(!playerTracks.length)return 0;const sig=playlistSignature(),cached=store.get(playerDurationKey,null);if(cached&&cached.signature===sig&&Number(cached.total)>0)return Number(cached.total);if(playerDurationLoading)return playerDurationLoading;playerDurationLoading=(async()=>{let cursor=0,total=0;const worker=async()=>{while(cursor<playerTracks.length){const i=cursor++;total+=await readRemoteAudioDuration(playerTracks[i].src)}};await Promise.all(Array.from({length:Math.min(4,playerTracks.length)},worker));if(total>0)store.set(playerDurationKey,{signature:sig,total,updated:Date.now()});return total})().finally(()=>playerDurationLoading=null);return playerDurationLoading}
function readRemoteAudioDuration(src){return new Promise(resolve=>{const a=new Audio();let done=false;const finish=v=>{if(done)return;done=true;clearTimeout(timer);a.removeAttribute('src');try{a.load()}catch{}resolve(Number.isFinite(v)?v:0)};const timer=setTimeout(()=>finish(0),9000);a.preload='metadata';a.addEventListener('loadedmetadata',()=>finish(a.duration),{once:true});a.addEventListener('error',()=>finish(0),{once:true});a.src=src;a.load()})}
function syncPlayerUI(){const a=$('#globalPlayerAudio'),t=playerTracks[playerIndex];if(!a)return;const p=a.duration>0?a.currentTime/a.duration:0,name=t?.name||'—';const miniTrack=$('#miniPlayerTrack'),miniProg=$('#miniPlayerProgress'),miniPlay=$('#miniPlay');if(miniTrack)miniTrack.textContent=name;if(miniProg)miniProg.style.width=pct(p);if(miniPlay)miniPlay.textContent=a.paused?'▶':'❚❚';const fullTrack=$('#playerNowTrack'),fullTime=$('#playerTime'),fullProg=$('#playerProgressFill'),fullPlay=$('#playerPlay'),fullShuffle=$('#playerShuffle'),fullRepeatOne=$('#playerRepeatOne'),fullRepeatAll=$('#playerRepeatAll'),fullVol=$('#playerVolume');if(fullTrack)fullTrack.textContent=name;if(fullTime)fullTime.textContent=`${fmtPlayer(a.currentTime)} / ${fmtPlayer(a.duration)}`;if(fullProg)fullProg.style.width=pct(p);if(fullPlay)fullPlay.textContent=a.paused?'▶':'❚❚';if(fullShuffle)fullShuffle.classList.toggle('active',playerShuffle);if(fullRepeatOne)fullRepeatOne.classList.toggle('active',playerRepeatMode==='one');if(fullRepeatAll)fullRepeatAll.classList.toggle('active',playerRepeatMode==='all');if(fullVol){if(document.activeElement!==fullVol)fullVol.value=String(a.volume);fullVol.style.setProperty('--volume-pct',`${Math.round(a.volume*100)}%`)}const wave=$('#playerWave');if(wave)wave.classList.toggle('playing',!a.paused&&!!a.src);$$('[data-player-track]').forEach(el=>el.classList.toggle('active',Number(el.dataset.playerTrack)===playerIndex))}
function updateMiniPlayerVisibility(route=routeName()){const mini=$('#miniPlayer');if(!mini)return;const show=playerActivated&&route!=='player';mini.classList.toggle('hidden',!show);document.body.classList.toggle('player-mini-visible',show)}
async function renderPlayer(){currentStory=null;scrollTo({top:0,behavior:'auto'});view.innerHTML='<section class="section player-section"><div class="player-title-row"><div><div class="eyebrow">Música del proyecto</div><h1>PLAYER</h1></div><div class="player-summary"><div class="player-summary-row"><span>PISTAS</span><strong>—</strong></div><div class="player-summary-row"><small>DURACIÓN</small><b>—</b></div></div></div><div class="player-loading">Cargando playlist…</div></section>';try{await ensurePlayerManifest()}catch(e){view.innerHTML=`<section class="section player-section"><h1>PLAYER</h1><div class="empty">No se pudo cargar la playlist.<br>${escapeHtml(e.message)}</div></section>`;return}const a=$('#globalPlayerAudio'),t=playerTracks[playerIndex];view.innerHTML=`<section class="section player-section"><div class="player-title-row"><div><div class="eyebrow">Música del proyecto</div><h1>PLAYER</h1></div><div class="player-summary"><div class="player-summary-row"><span>PISTAS</span><strong>${playerTracks.length}</strong></div><div class="player-summary-row"><small>DURACIÓN</small><b id="playerTotalDuration">…</b></div></div></div><div class="player-console"><div class="player-console-head"><span>NOW PLAYING</span><strong id="playerNowTrack">${escapeHtml(t?.name||'—')}</strong></div><div class="player-progress-meta"><div class="player-time" id="playerTime">${fmtPlayer(a.currentTime)} / ${fmtPlayer(a.duration)}</div><div id="playerWave" class="player-wave" aria-hidden="true">${Array.from({length:18},(_,i)=>`<i style="--wave-i:${i}"></i>`).join('')}</div></div><button class="player-progress" id="playerProgress" aria-label="Progreso"><span id="playerProgressFill"></span></button><div class="player-controls player-controls-main"><button id="playerPrev" aria-label="Anterior">‹</button><button id="playerPlay" class="player-main-play" aria-label="Play/Pause">${a.paused?'▶':'❚❚'}</button><button id="playerNext" aria-label="Siguiente">›</button></div><div class="player-mode-controls"><button id="playerRepeatOne" class="player-mode ${playerRepeatMode==='one'?'active':''}" type="button">↻ 1</button><button id="playerRepeatAll" class="player-mode ${playerRepeatMode==='all'?'active':''}" type="button">↻ TODO</button><button id="playerShuffle" class="player-mode ${playerShuffle?'active':''}" type="button">RANDOM</button></div><div class="player-volume"><span>VOL</span><input id="playerVolume" type="range" min="0" max="1" step="0.01" value="${a.volume}"></div></div><div class="player-list">${playerTracks.map((x,i)=>`<button class="player-track ${i===playerIndex?'active':''}" data-player-track="${i}"><span>${String(i+1).padStart(2,'0')}</span><strong>${escapeHtml(x.name)}</strong></button>`).join('')}</div><p class="player-note">La música continúa al navegar por la app. Si reproduces un audio o vídeo dentro de una Story, Player se pausa.</p></section>`;$('#playerPrev').onclick=()=>playerStep(-1,true);$('#playerPlay').onclick=()=>playerToggle();$('#playerNext').onclick=()=>playerStep(1,true);$('#playerRepeatOne').onclick=()=>setRepeatMode('one');$('#playerRepeatAll').onclick=()=>setRepeatMode('all');$('#playerShuffle').onclick=()=>{playerShuffle=!playerShuffle;playerActivated=true;savePlayerState();syncPlayerUI()};$('#playerVolume').oninput=e=>{a.volume=Number(e.target.value);playerActivated=true;savePlayerState();syncPlayerUI()};$('#playerProgress').onclick=e=>{const r=e.currentTarget.getBoundingClientRect();if(a.duration>0)a.currentTime=a.duration*((e.clientX-r.left)/r.width)};$$('[data-player-track]').forEach(b=>b.onclick=()=>{playerActivated=true;loadPlayerTrack(Number(b.dataset.playerTrack),true)});syncPlayerUI();updateMiniPlayerVisibility('player');ensurePlaylistTotalDuration().then(total=>{const el=$('#playerTotalDuration');if(el)el.textContent=total>0?fmtPlayer(total):'—'}).catch(()=>{})}

async function renderStory(id,resume=false){resumeOnOpen=!!resume;storyInitialOpen=true;scrollTo({top:0,behavior:'auto'});const meta=indexData.stories.find(s=>s.id===id);if(!meta){view.innerHTML='<div class="empty">Story no encontrada.</div>';return}currentStory={...meta};currentTab='read';if(isLocked(meta)){drawStory();return}showLoading();try{const data=await loadStoryData(meta);currentStory={...meta,...data};if(currentStory.cover){const c=coverCache();c[id]=currentStory.cover;store.set(coverCacheKey,c)}drawStory()}catch(e){if(meta.access==='exclusive'){const m=secretMap();delete m[id];store.set(unlockSecretsKey,m);currentStory={...meta};drawStory('No se pudo validar el desbloqueo guardado. Escanea de nuevo el QR de esta Story.')}else view.innerHTML=`<div class="empty"><h2>Error cargando Story ${escapeHtml(id)}</h2><p>${escapeHtml(e.message)}</p></div>`}}
async function loadStoryData(meta,secretOverride=''){const r=await fetch(meta.data,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const obj=await r.json();if(obj?.protected){const secret=secretOverride||secretMap()[meta.id];if(!secret)throw new Error('Story bloqueada');return decryptStory(obj,secret)}return obj}
function drawStory(lockMessage=''){const s=currentStory,locked=isLocked(s),tabs=Object.entries(s.tabs||{}).filter(([,v])=>v&&Array.isArray(v.blocks));if(!locked&&!tabs.some(([k])=>k===currentTab)){currentTab=tabs.some(([k])=>k==='read')?'read':tabs[0]?.[0]||'read'}const read=isRead(s.id);view.innerHTML=`<section class="story-header"><div class="story-header-content"><div class="story-number">STORY ${escapeHtml(s.id)}</div><h1>${escapeHtml(s.title)}</h1><div class="meta-row"><span class="pill">${formatDate(s.published)}</span>${s.access==='exclusive'?'<span class="pill red">EXCLUSIVA</span>':'<span class="pill">GRATIS</span>'}<span id="readStatusPill" class="pill read-pill ${read?'':'hidden'}">✓ LEÍDA</span></div></div>${storyFeaturedMedia(s,locked)}</section>${locked?renderLocked(s,lockMessage):`<div class="tabs">${tabs.map(([k,v])=>`<button class="tab ${k===currentTab?'active':''}" data-tab="${escAttr(k)}">${escapeHtml(v.label||k)}</button>`).join('')}</div><div class="progress-wrap"><div id="readProgress" class="progress"></div></div><article id="reader" class="reader"></article>`}`;bindBrokenImages();if(locked){$('#unlockThis').onclick=()=>showUnlock(s.id);return}$$('.tab').forEach(b=>b.onclick=()=>{currentTab=b.dataset.tab;drawTab()});drawTab()}
function renderLocked(s,msg=''){return `<section class="lock-screen"><div class="lock">▣</div><h2>Story exclusiva</h2><p>${msg?escapeHtml(msg):'Esta Story y todos sus extras requieren el QR específico impreso junto a este relato en el libro físico.'}</p><button class="cta" id="unlockThis">DESBLOQUEAR STORY ${escapeHtml(s.id)}</button></section>`}
function drawTab(){const tab=currentStory.tabs?.[currentTab];if(!tab)return;$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===currentTab));const mediaOnly=isVideoOnlyTab(currentTab,tab);let blocks=mediaOnly?(tab.blocks||[]).filter(b=>b.type==='iframe'||b.type==='video'):[...(tab.blocks||[])];if(currentTab==='read'&&currentStory.featuredImage)blocks=blocks.filter(b=>!(b.type==='image'&&b.src===currentStory.featuredImage));$('#reader').innerHTML=blocks.length?blocks.map(renderBlock).join(''):'<div class="empty">Esta sección no contiene material.</div>';bindReaderMedia();const topBtn=$('#toTopHeaderBtn');if(topBtn)topBtn.classList.toggle('hidden',currentTab!=='read');const progress=$('.progress-wrap');if(progress)progress.classList.toggle('hidden',currentTab!=='read');const header=$('.story-header');if(currentTab==='read'&&resumeOnOpen){resumeOnOpen=false;storyInitialOpen=false;requestAnimationFrame(()=>restoreReadPosition(currentStory.id));}else if(currentTab==='read'&&storyInitialOpen){storyInitialOpen=false;requestAnimationFrame(()=>scrollTo({top:0,behavior:'auto'}));}else if(header)scrollTo({top:Math.max(0,header.offsetHeight-20),behavior:'smooth'});requestAnimationFrame(updateProgress)}
function isVideoOnlyTab(key,tab){const label=`${key} ${tab?.label||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return /(^|\s|[-_/])(audio|video|corto|escuchar|listen)(\s|$|[-_/])/.test(label)}
function renderBlock(b){if(b.type==='p')return `<p>${escapeHtml(b.text)}</p>`;if(b.type==='image_link')return `<a class="reader-linked-image" href="${escAttr(b.href)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir contenido enlazado"><figure class="reader-image linked"><img src="${escAttr(b.src)}" alt="${escAttr(b.alt||'')}" loading="lazy" decoding="async" referrerpolicy="no-referrer">${b.caption?`<figcaption>${escapeHtml(b.caption)}</figcaption>`:''}</figure></a>`;if(b.type==='image')return `<figure class="reader-image"><img src="${escAttr(b.src)}" alt="${escAttr(b.alt||'')}" loading="lazy" decoding="async" referrerpolicy="no-referrer">${b.caption?`<figcaption>${escapeHtml(b.caption)}</figcaption>`:''}</figure>`;if(b.type==='iframe')return `<div class="reader-media"><iframe src="${escAttr(b.src)}" title="${escAttr(b.title||'Contenido multimedia')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;if(b.type==='video')return `<div class="reader-media"><video controls playsinline preload="metadata" src="${escAttr(b.src)}"></video></div>`;if(b.type==='audio')return `<div class="reader-media"><audio controls preload="metadata" src="${escAttr(b.src)}"></audio></div>`;if(b.type==='note')return `<p class="note">${escapeHtml(b.text)}</p>`;if(b.type==='heading')return `<h2>${escapeHtml(b.text)}</h2>`;if(b.type==='quote')return `<blockquote>${escapeHtml(b.text)}</blockquote>`;if(b.type==='link')return `<p><a href="${escAttr(b.href)}" target="_blank" rel="noopener">${escapeHtml(b.text||'Abrir contenido')} ↗</a></p>`;return ''}
function bindReaderMedia(){bindBrokenImages();bindStoryMediaPause();$$('.reader-image:not(.linked) img').forEach(img=>img.onclick=()=>openLightbox(img.src,img.alt))}
function bindBrokenImages(){$$('img').forEach(img=>{if(img.dataset.boundError)return;img.dataset.boundError='1';img.addEventListener('error',()=>{const fig=img.closest('.reader-image');if(fig)fig.remove();else img.style.visibility='hidden'},{once:true})})}
function openLightbox(src,alt=''){const box=document.createElement('div');box.className='lightbox';box.innerHTML=`<button class="lightbox-close" aria-label="Cerrar">×</button><img src="${escAttr(src)}" alt="${escAttr(alt)}">`;box.onclick=e=>{if(e.target===box||e.target.closest('.lightbox-close'))box.remove()};document.body.append(box)}
function markRead(id){const a=readList();if(a.includes(id))return false;a.push(id);store.set(readKey,a);const m=readingStateMap();m[id]={...(m[id]||{}),progress:1,updated:Date.now()};store.set(readingStateKey,m);const p=readProgressMap();p[id]=1;store.set(readProgressKey,p);const pill=$('#readStatusPill');if(pill)pill.classList.remove('hidden');celebrateRead(id);return true}
function persistCurrentReadingPosition(){
  const r=$('#reader');if(!r||!currentStory||currentTab!=='read')return;const rect=r.getBoundingClientRect(),top=scrollY+rect.top,h=Math.max(1,r.offsetHeight-innerHeight*.65),x=Math.max(0,Math.min(1,(scrollY-top+innerHeight*.3)/h)),maxProgress=Math.max(storyProgress(currentStory.id),x);saveReadingState(currentStory.id,maxProgress,x,r);
}
function celebrateRead(id){const total=indexData?.stories?.length||0,count=publishedReadCount();document.querySelector('.read-celebration')?.remove();const el=document.createElement('div');el.className='read-celebration';el.innerHTML=`<button class="read-celebration-close" type="button" aria-label="Cerrar">×</button><div class="read-check">✓</div><div class="eyebrow">STORY ${escapeHtml(id)}</div><strong>LEÍDA</strong><small>${count} / ${total} Stories publicadas</small>`;document.body.append(el);let timer;const close=()=>{clearTimeout(timer);el.classList.remove('show');setTimeout(()=>el.remove(),260)};el.querySelector('.read-celebration-close').onclick=close;setTimeout(()=>el.classList.add('show'),20);timer=setTimeout(close,3000)}
function updateProgress(){
  const r=$('#reader'),p=$('#readProgress');if(!r||!p||!currentStory||currentTab!=='read')return;
  const rect=r.getBoundingClientRect(),top=scrollY+rect.top,h=Math.max(1,r.offsetHeight-innerHeight*.65),x=Math.max(0,Math.min(1,(scrollY-top+innerHeight*.3)/h));p.style.width=`${x*100}%`;
  const old=storyProgress(currentStory.id),now=Date.now(),maxProgress=Math.max(old,x);if(x>old+.006){const legacy=readProgressMap();legacy[currentStory.id]=Math.round(maxProgress*1000)/1000;store.set(readProgressKey,legacy)}if(x>old+.006||now-lastReadingSaveAt>700){lastReadingSaveAt=now;saveReadingState(currentStory.id,maxProgress,x,r)}
  const bottomNav=$('.bottom-nav')?.getBoundingClientRect().height||72,mini=document.body.classList.contains('player-mini-visible')?($('#miniPlayer')?.getBoundingClientRect().height||58):0;const reachedBottom=r.getBoundingClientRect().bottom<=innerHeight-bottomNav-mini+18;
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

function showUnlock(prefill=''){const meta=prefill?indexData.stories.find(s=>s.id===prefill):null;view.innerHTML=`<section class="unlock-panel section"><div class="eyebrow">Acceso mediante QR</div><h1>Desbloquear Story${prefill?' '+escapeHtml(prefill):''}</h1><p class="scanner-copy">Escanea con la cámara el QR específico impreso junto al relato. La app no permite teclear el enlace manualmente.</p><div id="qr-reader" class="qr-reader"><div class="qr-placeholder">CÁMARA</div></div><div id="qr-file-reader" class="qr-file-reader" aria-hidden="true"></div><button class="cta" id="startQr">HACER FOTO DEL QR</button><button class="secondary-btn" id="photoQr" style="margin-top:10px">CARGAR IMAGEN DESDE TU ALBUM</button><input id="qrFile" class="hidden" type="file" accept="image/*"><p id="unlockStatus" class="note" style="margin-top:16px"></p><p class="scanner-help">«Hacer foto del QR» abre la cámara para escanearlo directamente. «Cargar imagen desde tu álbum» analiza una imagen del QR que ya tengas guardada en el dispositivo.</p></section>`;$('#startQr').onclick=()=>startQrCamera(prefill);$('#photoQr').onclick=()=>$('#qrFile').click();$('#qrFile').onchange=e=>scanQrPhoto(e.target.files?.[0],prefill);}
async function ensureQrLibrary(){if(typeof Html5Qrcode!=='undefined')return true;unlockStatus('Preparando lector QR…');return new Promise(resolve=>{const old=document.querySelector('script[data-qr-lib]');if(old){old.addEventListener('load',()=>resolve(typeof Html5Qrcode!=='undefined'),{once:true});old.addEventListener('error',()=>resolve(false),{once:true});return}const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';sc.async=true;sc.dataset.qrLib='1';sc.onload=()=>resolve(typeof Html5Qrcode!=='undefined');sc.onerror=()=>resolve(false);document.head.append(sc)})}
async function startQrCamera(prefill=''){if(qrScanBusy)return;if(!await ensureQrLibrary()){unlockStatus('No se ha podido cargar el lector QR. Comprueba la conexión e inténtalo de nuevo.');return}await stopQrScanner();qrScanBusy=true;unlockStatus('Solicitando acceso a la cámara…');try{qrScanner=new Html5Qrcode('qr-reader');await qrScanner.start({facingMode:'environment'},{fps:10,qrbox:(w,h)=>{const n=Math.max(180,Math.min(w,h)*.72);return{width:n,height:n}},aspectRatio:1.0},async decoded=>{if(qrScanBusy){qrScanBusy=false;await stopQrScanner();await tryUnlock(decoded,prefill)}},()=>{});unlockStatus('Apunta la cámara al QR del relato.');}catch(e){unlockStatus('No se pudo abrir el escáner en directo. Usa «Cargar imagen desde tu álbum».');qrScanBusy=false;}}
async function scanQrPhoto(file,prefill=''){if(!file)return;if(!await ensureQrLibrary()){unlockStatus('No se ha podido cargar el lector QR.');return}unlockStatus('Analizando QR…');let scanner=null;try{scanner=new Html5Qrcode('qr-file-reader');const decoded=await scanner.scanFile(file,true);await scanner.clear();await tryUnlock(decoded,prefill)}catch(e){try{await scanner?.clear()}catch{}unlockStatus('No se ha podido leer un QR válido en esa imagen.');}finally{const f=$('#qrFile');if(f)f.value='';}}
async function stopQrScanner(){const s=qrScanner;qrScanner=null;qrScanBusy=false;if(!s)return;try{if(s.isScanning)await s.stop()}catch{}try{await s.clear()}catch{}}
async function tryUnlock(raw,prefill=''){const parsedId=storyIdFromPrivateUrl(raw),id=prefill||parsedId;if(!id){unlockStatus('El QR no corresponde a una Story reconocible.');return}if(prefill&&parsedId&&prefill!==parsedId){unlockStatus(`Ese QR pertenece a la Story ${parsedId}, no a la ${prefill}.`);return}const meta=indexData.stories.find(s=>s.id===id);if(!meta||meta.access!=='exclusive'){unlockStatus('Ese QR no corresponde a una Story exclusiva disponible en la app.');return}const secret=normalizeUnlockSecret(raw,id);if(!secret){unlockStatus('El QR no tiene el formato esperado.');return}unlockStatus('Validando acceso…');try{const data=await loadStoryData(meta,secret);if(data.id!==id)throw new Error('El QR no corresponde a esta Story');const m=secretMap();m[id]=secret;store.set(unlockSecretsKey,m);unlockStatus('');await showUnlockReward(id);navigateHash(`#/story/${encodeURIComponent(id)}`)}catch{unlockStatus('QR no válido para esta Story.')}}
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
  const boxSelectors=['.library-stats>div','.progress-dashboard','.personal-stats>div','.unread-callout','.home-progress','.home-continue','.book-detail-stats>div','.book-card','.continue-card','.player-summary','.player-console','.lock-screen'];
  view.querySelectorAll(boxSelectors.join(',')).forEach(prepareHoloBox);
  view.querySelectorAll('.library-stats strong,.personal-stats strong,.unread-callout strong b,.progress-big>strong,.book-detail-stats strong').forEach(prepareCounter);
  view.querySelectorAll('.reader p').forEach(p=>{if(p.dataset.readerMotion)return;p.dataset.readerMotion='1';p.classList.add('reader-reveal-pending');if(motionReduced())p.classList.add('reader-reveal-live');else readerIntersectionObserver?.observe(p)});
  view.querySelectorAll('.story-card,.story-grid-card,.story-cover-card,.continue-card').forEach(el=>{if(el.dataset.listMotion)return;el.dataset.listMotion='1';el.classList.add('story-list-reveal');if(motionReduced())el.classList.add('story-list-reveal-live');else cardIntersectionObserver?.observe(el)});
  view.querySelectorAll('.hero-content h1,.section-title h1,.story-header-content h1,.player-title-row h1,.book-detail-head h1,.library-stats span,.personal-stats span,.book-detail-stats span').forEach(prepareTypewriter);
}
function prepareHoloBox(el){
  if(el.dataset.holoMotion)return;el.dataset.holoMotion='1';el.classList.add('hud-motion-box');
  if(el.parentElement?.classList.contains('library-stats')||el.parentElement?.classList.contains('personal-stats'))el.dataset.hudDelay=String([...el.parentElement.children].indexOf(el)*90);if(el.parentElement?.classList.contains('library-stats'))el.dataset.hudContentEarly='1';
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
  const el=document.createElement('div');el.className='unlock-reward';
  el.innerHTML=`<div class="unlock-reward-flash"></div><div class="unlock-reward-card"><div class="unlock-reward-ring"><span class="unlock-reward-icon">${lockSvg(false)}</span></div><div class="unlock-reward-copy"><small>STORY ${escapeHtml(id)}</small><strong>CONTENIDO EXCLUSIVO</strong><em>ACCESO CONCEDIDO</em></div></div>`;
  document.body.append(el);requestAnimationFrame(()=>el.classList.add('show'));
  if(!motionReduced())fiveFrameHaptic();
  await new Promise(r=>setTimeout(r,motionReduced()?40:360));
  const icon=el.querySelector('.unlock-reward-icon');if(icon)icon.innerHTML=lockSvg(true);el.querySelector('.unlock-reward-copy strong').textContent='STORY DESBLOQUEADA';
  await new Promise(r=>setTimeout(r,motionReduced()?40:720));
  el.classList.remove('show');setTimeout(()=>el.remove(),260);
}

async function registerSW(){if('serviceWorker'in navigator){try{let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload()});const reg=await navigator.serviceWorker.register('./sw.js?v=1.10.0',{updateViaCache:'none'});try{await reg.update()}catch{} }catch(e){console.warn('SW',e)}}}
boot();
