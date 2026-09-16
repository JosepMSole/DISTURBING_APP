const APP_VERSION = '6.2.0';
let globalPlayerAudioEngine=null,stormAudioEngine=null,stormIntroAudioEngine=null;
const $=(s,r=document)=>{
  if(r===document&&s==='#globalPlayerAudio')return globalPlayerAudioEngine;
  if(r===document&&s==='#stormAudio')return stormAudioEngine;
  return r.querySelector(s);
}, $$=(s,r=document)=>[...r.querySelectorAll(s)];
const view=$('#view');
let indexData=null,currentStory=null,currentTab='read',installPrompt=null,resumeOnOpen=false,storyInitialOpen=false,lastReadingSaveAt=0,bookAssets={};
let sagasData={schema:1,sagas:[]},timelineData={schema:1,orders:{}},extrasData={schema:1,extras:[]},playerCatalogData={schema:1,tracks:[]},homeData={schema:1,nextStoryDate:'',portals:{micro:true,games:false}},homeHighlightsData={schema:1,items:[]},avatarsData={schema:1,avatars:[]},userConfigData={schema:1,achievements:[{id:'achievement1',number:1,name:'PRIMERA STORY',description:'Lee tu primera Story.',requirement:{type:'read_stories',count:1}}]},microsData={schema:1,items:[]},currentMicro=null,gamesData={schema:1,games:[]},currentGame=null;
let lastRandomStoryId='',randomSpinTimer=0,randomSpinRunning=false,randomSpinCurrent=null,randomSpinPool=[],randomHasSpun=false,tutorialActive=null,introPlayed=false,suppressNewClearOnceId='';
let mediaLocaleState={audio:'es',video:'es'},currentMediaPlaybackLocale={storyId:'',type:'',locale:'es'},homeCountdownTimer=0;
const unlockSecretsKey='disturbing_unlock_secrets_v2';
const readKey='disturbing_read_v2';
const coverCacheKey='disturbing_cover_cache_v1';
const storiesViewKey='disturbing_stories_view_v1';
const readProgressKey='disturbing_read_progress_v1';
const readingStateKey='disturbing_read_state_v1';
const microReadKey='disturbing_micro_read_v1';
const uiSoundsKey='disturbing_ui_sounds_v1';
const tutorialStateKey='disturbing_tutorials_v1';
const gameCompletionsKey='disturbing_game_completions_v1';
const achievementRewardsKey='disturbing_achievement_rewards_v1';
const storiesSortKey='disturbing_stories_sort_v1';
const playerStateKey='disturbing_player_state_v1';
const playerDurationKey='disturbing_player_duration_v1';
const newAcquiredKey='disturbing_new_acquired_v2';
const firstOpenedKey='disturbing_first_opened_v2';
const newBaselineKey='disturbing_new_baseline_v2';
const newV21InitKey='disturbing_new_v21_init';
const PLAYER_MANIFEST='https://raw.githubusercontent.com/JosepMSole/DisturbingPlayer/main/music/manifest.json';
const PLAYER_MUSIC_BASE='https://josepmsole.github.io/DisturbingPlayer/music/';
let playerTracks=[],playerIndex=0,playerShuffle=false,playerRepeatMode='off',playerActivated=false,playerManifestLoading=null,playerDurationLoading=null,playerWasPlayingBeforeMedia=false,playerArtworkTimer=0,playerArtworkTrack='',playerArtworkIndex=0,playerWaveRaf=0,playerWaveCtx=null,playerWaveAnalyser=null,playerWaveSource=null,playerWaveData=null,playerArtworkMotionRaf=0;
let youtubeIframeApiPromise=null,storyYoutubePlayers=[];
let stormEnabled=true,stormPrimed=false,stormStarted=false;
const STORM_VOLUME=.42;
let stormAudioCtx=null,stormGainNode=null,stormBuffer=null,stormBufferPromise=null,stormBufferSource=null,stormLoopStart=0,stormLoopEnd=0,stormIntroBuffer=null,stormIntroBufferPromise=null,stormIntroBufferSource=null,stormIntroEnd=0,stormIntroTransitionStarted=false,stormIntroFallbackTimer=0,userHeroBgMotionRaf=0;
let navHistory=[],navGoingBack=false,storyTransitionBusy=false;
let supabaseClient=null,registeredUser=null,userProfile=null,userSyncBusy=false;
const localAvatarKey='disturbing_user_avatar_v1', unlockedAvatarsKey='disturbing_unlocked_avatars_v1', avatarRewardSeenKey='disturbing_avatar_reward_seen_v1', userNameCacheKey='disturbing_user_name_v1', achievementEarnedKey='disturbing_achievements_v1', achievementActiveKey='disturbing_achievements_active_v1', consumedMediaKey='disturbing_consumed_story_media_v1';
const AVATAR_ASSET_BASE='https://josepmsole.github.io/DISTURBING_APP/assets/avatar/';
const PUBLIC_APP_ASSET_BASE='https://josepmsole.github.io/DISTURBING_APP/assets/';

// v4.34 · Motores de audio deliberadamente FUERA del DOM.
// Algunas combinaciones Chromium/WebKit podían materializar superficies visuales vacías
// para <audio> persistentes aunque estuvieran hidden. Al no insertarlos nunca en document,
// no existe ninguna caja/control nativo capaz de dibujarse en NOW PLAYING o Full Screen.
globalPlayerAudioEngine=document.createElement('audio');
globalPlayerAudioEngine.preload='auto';
globalPlayerAudioEngine.setAttribute('aria-hidden','true');
stormAudioEngine=document.createElement('audio');
stormAudioEngine.preload='auto';
stormAudioEngine.loop=true;
stormAudioEngine.src=PUBLIC_APP_ASSET_BASE+'storm.mp3';
stormAudioEngine.setAttribute('aria-hidden','true');
stormIntroAudioEngine=document.createElement('audio');
stormIntroAudioEngine.preload='auto';
stormIntroAudioEngine.loop=false;
stormIntroAudioEngine.src=PUBLIC_APP_ASSET_BASE+'stormintro.mp3';
stormIntroAudioEngine.setAttribute('aria-hidden','true');

// Captura temprana del instalador PWA. En escritorio el evento puede llegar
// antes de que termine el boot/intro; guardarlo aquí evita perderlo en Windows/Mac.
function captureInstallPrompt(e){e.preventDefault();installPrompt=e;updateInstallButton()}
function clearCapturedInstallPrompt(){installPrompt=null;updateInstallButton()}
addEventListener('beforeinstallprompt',captureInstallPrompt);
addEventListener('appinstalled',clearCapturedInstallPrompt);

const store={get(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}},set(k,v){localStorage.setItem(k,JSON.stringify(v));if(String(k).startsWith('disturbing_'))queueUserVaultSync();if(k===unlockSecretsKey)setTimeout(()=>evaluateAchievements(true),450)}};

// v5.17 · SFX de interfaz. Motores fuera del DOM para no interferir con STORM/Player.
const UI_SOUND_FILES={open:'open.mp3',openb:'openb.mp3',pages:'pages.mp3',back:'back.mp3',tap:'tap.mp3',expand:'expand.mp3',collapse:'collapse.mp3',confirm:'confirm.mp3',blocked:'blocked.mp3',home:'home.mp3'};
const UI_SOUND_VOLUME={open:.32,openb:.32,pages:.32,back:.32,tap:.24,expand:.28,collapse:.28,confirm:.34,blocked:.31,home:.34};
const uiSoundEngines=new Map();
function uiSoundsEnabled(){return store.get(uiSoundsKey,true)!==false}
function uiSoundEngine(name){
  if(!UI_SOUND_FILES[name])return null;
  if(uiSoundEngines.has(name))return uiSoundEngines.get(name);
  const a=document.createElement('audio');a.preload='auto';a.src=PUBLIC_APP_ASSET_BASE+'sounds/'+UI_SOUND_FILES[name];a.volume=UI_SOUND_VOLUME[name]??.3;a.setAttribute('aria-hidden','true');uiSoundEngines.set(name,a);return a
}
function primeUiSounds(){if(!uiSoundsEnabled())return;for(const k of Object.keys(UI_SOUND_FILES)){const a=uiSoundEngine(k);try{a?.load()}catch{}}}
function playUiSound(name,{force=false}={}){
  if((!force&&!uiSoundsEnabled())||document.body.classList.contains('micro-preview-mode'))return;
  const a=uiSoundEngine(name);if(!a)return;
  try{a.pause();a.currentTime=0;a.volume=UI_SOUND_VOLUME[name]??.3;const p=a.play();if(p&&typeof p.catch==='function')p.catch(()=>{})}catch{}
}
function uiSoundForControl(el){
  if(!el)return'';
  const explicit=el.dataset?.uiSound;if(explicit==='none')return'';if(explicit&&UI_SOUND_FILES[explicit])return explicit;
  if(el.disabled||el.getAttribute?.('aria-disabled')==='true'||el.classList?.contains('is-coming'))return'blocked';
  const id=String(el.id||''),txt=String(el.textContent||'').trim().toUpperCase();
  if(id==='backBtn'||el.classList?.contains('game-back-btn')||el.classList?.contains('collection-back')||/^VOLVER\b|^ATRÁS\b/.test(txt))return'back';
  if(id==='brandBtn')return'home';
  if(el.closest?.('#drawer')&&id!=='closeDrawer')return'confirm';
  if(id==='menuBtn')return'expand';if(id==='closeDrawer')return'collapse';
  // v5.23 · OPEN B es una variante reservada EXCLUSIVAMENTE a entrar en
  // GAMES, MICRO-PESADILLAS y EXTRAS (desde cualquier acceso interno).
  if(id==='gamePlayBtn'||el.matches?.('[data-game-id],[data-micro-id],[data-extra-id],[data-story-media-game],[data-story-media-micro],[data-related-game],[data-related-micro],.extra-card'))return'openb';
  if(el.matches?.('[data-book-id]'))return'pages';
  if(['miniPlayerOpen','userMenuBtn','scanBtn','openLatest','openAllStories','continueReading'].includes(id))return'open';
  if(/^(GUARDAR|CONFIRMAR|REGISTRAR)\b/.test(txt))return'confirm';
  if(el.matches?.('summary,.micro-intro-panel,.avatar-expand-toggle,[aria-expanded]')){
    const details=el.closest?.('details'),open=details?details.open:(el.classList?.contains('micro-intro-panel')?el.classList.contains('expanded'):el.getAttribute?.('aria-expanded')==='true');
    return open?'collapse':'expand';
  }
  if(el.matches?.('[data-story-id],[data-game-id],[data-micro-id],[data-home-continue],[data-home-progress],[data-micro-story],[data-game-story],[data-game-saga],.story-card,.home-previous-card,.book-story-card,.saga-card,.extra-card,.media-card,.portal-btn,.nav-btn,[data-drawer-route]')||/^(LEER|JUGAR|CONTINUAR|DESCUBRIR|ACCEDE|ABRIR)\b/.test(txt))return'open';
  if(el.tagName==='A'&&el.getAttribute('href')?.startsWith('#/'))return'open';
  return'tap';
}
function bindUiSoundSystem(){
  document.addEventListener('click',e=>{if(!e.isTrusted)return;const el=e.target?.closest?.('button,a,summary,[role="button"],[data-story-id],[data-game-id],[data-micro-id]');if(!el)return;const sound=uiSoundForControl(el);if(sound)playUiSound(sound)},true);
}
function uiSoundPreferenceHtml(){const on=uiSoundsEnabled();return `<div class="user-sounds-panel"><div><strong>ACTIVA O DESACTIVA LOS SONIDOS DE LA APP</strong><small>Controla los sonidos de navegación, apertura, confirmación, despliegue y otras acciones de Disturbing Stories App.</small></div><button id="userUiSoundToggle" class="user-sounds-toggle ${on?'is-on':'is-off'}" type="button" data-ui-sound="none" aria-pressed="${on?'true':'false'}"><span>${on?'ON':'OFF'}</span></button></div>`}
function bindUiSoundPreference(){const b=$('#userUiSoundToggle');if(!b)return;b.onclick=()=>{const next=!uiSoundsEnabled();if(!next)playUiSound('tap',{force:true});store.set(uiSoundsKey,next);b.classList.toggle('is-on',next);b.classList.toggle('is-off',!next);b.setAttribute('aria-pressed',String(next));const span=b.querySelector('span');if(span)span.textContent=next?'ON':'OFF';if(next){primeUiSounds();playUiSound('confirm',{force:true})}}}
addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='ds-micro-preview')return;applyMicroPreviewDraft(e.data.micro)});

async function boot(){
  showLoading();
  try{
    const r=await fetch('./data/stories.json',{cache:'no-store'});if(!r.ok)throw new Error(`stories.json: HTTP ${r.status}`);
    indexData=await r.json();indexData.stories=(indexData.stories||[]).sort((a,b)=>new Date(b.published)-new Date(a.published));
    try{const br=await fetch('./data/books.json',{cache:'no-store'});if(br.ok)bookAssets=(await br.json()).books||{}}catch{}
    [sagasData,timelineData,extrasData,playerCatalogData,homeData,homeHighlightsData,avatarsData,userConfigData,microsData,gamesData]=await Promise.all([
      loadOptionalJson('./data/sagas.json',{schema:1,sagas:[]}),
      loadOptionalJson('./data/timeline.json',{schema:1,orders:{}}),
      loadOptionalJson('./data/extras.json',{schema:1,extras:[]}),
      loadOptionalJson('./data/player.json',{schema:1,tracks:[]}),
      loadOptionalJson('./data/home.json',{schema:1,nextStoryDate:'',portals:{micro:true,games:false}}),
      loadOptionalJson('./data/home-highlights.json',{schema:1,items:[]}),
      loadOptionalJson('./data/avatars.json',{schema:1,avatars:[]}),
      loadOptionalJson('./data/user.json',{schema:1,achievements:[{id:'achievement1',number:1,name:'PRIMERA STORY',description:'Lee tu primera Story.',requirement:{type:'read_stories',count:1}}]}),
      loadOptionalJson('./data/micropesadillas.json',{schema:1,items:[]}),
      loadOptionalJson('./data/games.json',{schema:1,games:[],heroImage:'',heroVersion:'',heroText:'Algunos están diseñados especialmente para ordenador; consulta la compatibilidad antes de jugar.',heroHtml:''})
    ]);
    initialiseNewState();
    initUserSystem();
    bindShell();bindUiSoundSystem();bindGameEventBridge();initMotionSystem();initPlayer();
    if(currentHash().startsWith('#/micro-preview')){const gate=$('#entryGate');if(gate){gate.classList.add('hidden');gate.setAttribute('aria-hidden','true')}document.body.classList.add('micro-preview-mode');routeFromHash();updateStormButton();return}
    const introDidPlay=await playEntryIntro();
    if(currentHash()!=='#/home'){
      location.hash='#/home';
      if(introDidPlay)setTimeout(startIntroWhiteHandoff,50);
    }else{
      routeFromHash();
      if(introDidPlay)requestAnimationFrame(()=>requestAnimationFrame(startIntroWhiteHandoff));
    }
    if(!introDidPlay)setTimeout(()=>startStormAmbient(),120);
    updateStormButton();updateAppBadge();registerSW();
  }catch(e){const gate=$('#entryGate');if(gate){gate.classList.add('hidden');gate.setAttribute('aria-hidden','true')}view.innerHTML=`<div class="empty"><h2>No se pudieron cargar las Stories</h2><p>${escapeHtml(e.message)}</p><p>Usa el lanzador local incluido en el paquete.</p></div>`;}
}

async function loadOptionalJson(url,fallback){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)return JSON.parse(JSON.stringify(fallback));return await r.json()}catch{return JSON.parse(JSON.stringify(fallback))}}
function isStandaloneInstall(){try{return matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||matchMedia('(display-mode: minimal-ui)').matches||navigator.standalone===true||String(document.referrer||'').startsWith('android-app://')}catch{return navigator.standalone===true}}
function isIOSInstall(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent||'') || (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
}

function detectInstallGuideKind(){
  if(isIOSInstall())return 'ios';
  const ua=navigator.userAgent||'';
  if(/android/i.test(ua))return 'android';
  if(/mac os x|macintosh/i.test(ua))return 'mac';
  if(/windows/i.test(ua))return 'windows';
  return 'other';
}

function installIconSvg(){
  return `<svg class="install-app-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10"/><path d="m8 10 4 4 4-4"/><path d="M5 16.5v1.2A2.3 2.3 0 0 0 7.3 20h9.4A2.3 2.3 0 0 0 19 17.7v-1.2"/></svg>`
}
function homeInstallPanelHtml(){
  if(isStandaloneInstall())return '';
  const kind=detectInstallGuideKind(),direct=kind==='windows'||kind==='mac';
  return `<button id="homeInstallPanel" class="badge-permission-panel install-app-panel" type="button" aria-label="Instala esta app"><span class="install-app-panel-copy"><strong>INSTALA ESTA APP</strong></span><span class="install-app-panel-cta">${installIconSvg()}<b>${direct?'INSTALAR AHORA':'GUÍA DE INSTALACIÓN'}</b></span></button>`;
}
function updateInstallButton(){
  const standalone=isStandaloneInstall();
  const btn=$('#installBtn');if(btn){btn.classList.toggle('hidden',standalone);btn.setAttribute('aria-hidden',standalone?'true':'false');btn.tabIndex=standalone?-1:0;btn.style.display=standalone?'none':''}
  const panel=$('#homeInstallPanel');if(panel){panel.classList.toggle('hidden',standalone);panel.setAttribute('aria-hidden',standalone?'true':'false');panel.style.display=standalone?'none':''}
}
function closeInstallGuide(){document.querySelector('.install-guide')?.remove()}
function showInstallGuide(kind='ios'){
  closeInstallGuide();
  const platform=kind||detectInstallGuideKind();
  const ios=platform==='ios',android=platform==='android',mac=platform==='mac',windows=platform==='windows';
  const canPrompt=!ios&&!!installPrompt;
  const modal=document.createElement('div');
  modal.className='install-guide';
  const videoSrc='./assets/tutorials/tutorial_instalar.webm';
  const videoHtml=ios?`<div class="install-guide-video-wrap"><video class="install-guide-video" src="${videoSrc}" playsinline muted controls preload="metadata" onerror="this.closest('div').classList.add('video-unavailable')"></video><div class="install-guide-video-fallback">No se pudo cargar el vídeo tutorial.</div></div>`:'';
  const title=windows?'WINDOWS':mac?'MAC':ios?'IPHONE / IPAD':android?'ANDROID':'TU DISPOSITIVO';
  const steps=ios
    ? [['↥','Pulsa COMPARTIR en Safari.'],['＋','Elige “Añadir a pantalla de inicio”.'],['✓','Pulsa AÑADIR.']]
    : android
      ? [['⋮','Abre el menú del navegador.'],['↓','Pulsa “Instalar app”.'],['✓','Confirma la instalación.']]
      : mac
        ? [['⋯','Abre el menú del navegador.'],['↓','Elige “Instalar app” o la opción equivalente.'],['✓','Confirma y abre la app desde su icono.']]
        : windows
          ? [['⋯','Abre el menú del navegador.'],['↓','Selecciona “Instalar app”.'],['✓','Confirma la instalación.']]
          : [['⋯','Abre el menú del navegador.'],['↓','Busca “Instalar app”.'],['✓','Confirma.']];
  modal.innerHTML=`<div class="install-guide-scrim" data-install-close></div><section class="install-guide-card hud-static" role="dialog" aria-modal="true" aria-label="Instalar Disturbing Stories App"><button class="install-guide-close" data-install-close aria-label="Cerrar">×</button><div class="eyebrow">INSTALAR APP · ${title}</div><h2>Instalación rápida</h2>${videoHtml}<div class="install-quick-steps">${steps.map(([icon,text])=>`<div><b class="install-step-icon" aria-hidden="true">${icon}</b><span>${text}</span></div>`).join('')}</div><p class="install-speed-note">⌛ Puede tardar unos segundos según la velocidad de tu dispositivo.</p>${canPrompt?`<div class="install-guide-actions"><button id="installGuideNow" class="cta">INSTALAR AHORA</button></div>`:''}</section>`;
  document.body.append(modal);
  modal.querySelectorAll('[data-install-close]').forEach(el=>el.onclick=closeInstallGuide);
  const video=modal.querySelector('.install-guide-video');
  if(video){const play=video.play?.bind(video);if(play){Promise.resolve().then(()=>play()).catch(()=>{})}}
  const directBtn=modal.querySelector('#installGuideNow');
  if(directBtn)directBtn.onclick=async()=>{try{installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;updateInstallButton();closeInstallGuide()}catch{}};
}

async function waitForNativeInstallPrompt(timeout=1800){
  if(installPrompt)return installPrompt;
  return await new Promise(resolve=>{
    let done=false,timer=0;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);removeEventListener('beforeinstallprompt',onPrompt);resolve(value||installPrompt||null)};
    const onPrompt=e=>{e.preventDefault();installPrompt=e;finish(e)};
    addEventListener('beforeinstallprompt',onPrompt,{once:true});
    timer=setTimeout(()=>finish(installPrompt),timeout);
  });
}
async function requestNativeInstall(){
  const prompt=installPrompt||await waitForNativeInstallPrompt();
  if(!prompt){toast('El navegador aún está preparando la instalación. Prueba de nuevo en un momento.');return false}
  try{
    prompt.prompt();
    const choice=await prompt.userChoice;
    if(installPrompt===prompt)installPrompt=null;
    updateInstallButton();
    return choice?.outcome==='accepted';
  }catch{toast('El instalador no se pudo abrir. Prueba de nuevo en un momento.');return false}
}
async function handleInstallApp(){
  const btn=$('#installBtn');
  if(isStandaloneInstall()){if(btn)btn.classList.add('hidden');return}
  closeDrawer();
  const kind=detectInstallGuideKind();
  if(kind==='windows'||kind==='mac'){await requestNativeInstall();return}
  showInstallGuide(kind);
}

function goHomeTop(){persistCurrentReadingPosition();if(currentHash()==='#/home'){scrollTo({top:0,behavior:'smooth'});return}navigateHash('#/home');requestAnimationFrame(()=>scrollTo({top:0,behavior:'auto'}))}
function bindShell(){$('#brandBtn').onclick=goHomeTop;$('#backBtn').onclick=navigateBack;$('#toTopHeaderBtn').onclick=()=>scrollTo({top:0,behavior:'smooth'});const stormBtn=$('#stormHeaderBtn');if(stormBtn)stormBtn.onclick=toggleStormAmbient;$('#menuBtn').onclick=openDrawer;$('#closeDrawer').onclick=closeDrawer;$('#scrim').onclick=closeDrawer;$$('.nav-btn').forEach(b=>b.onclick=()=>footerGo(b.dataset.route));$$('[data-drawer-route]').forEach(b=>b.onclick=()=>{closeDrawer();if(b.dataset.drawerRoute==='home')goHomeTop();else go(b.dataset.drawerRoute)});$('#miniPlayerOpen').onclick=()=>go('player');$('#miniPrev').onclick=()=>playerStep(-1,true);$('#miniPlay').onclick=()=>playerToggle();$('#miniNext').onclick=()=>playerStep(1,true);$('#scanBtn').onclick=()=>{closeDrawer();go('unlock')};$('#installBtn').onclick=handleInstallApp;$('#userMenuBtn').onclick=()=>{closeDrawer();go('user')};updateInstallButton();updateUserMenu();addEventListener('hashchange',routeFromHash);addEventListener('scroll',()=>{updateProgress();updateMicroProgress()},{passive:true});addEventListener('pagehide',persistCurrentReadingPosition);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistCurrentReadingPosition()});addEventListener('blur',()=>setTimeout(()=>{if(currentStory&&document.activeElement?.tagName==='IFRAME')playerPauseForStoryMedia()},0));addEventListener('resize',()=>{updateInstallButton();if(routeName()==='collection')requestAnimationFrame(fitCollectionShelf);if(routeName()==='timeline')requestAnimationFrame(alignTimelineBranches);if(routeName()==='unlocked')requestAnimationFrame(syncMyStoriesHeaderAvatar)},{passive:true});}
function currentHash(){return location.hash||'#/home'}
function navigateHash(target){const cur=currentHash();if(cur===target)return;navHistory.push(cur);if(navHistory.length>5)navHistory=navHistory.slice(-5);location.hash=target}
function go(r){navigateHash(`#/${r}`)}
function footerGo(r){const target=`#/${r}`;persistCurrentReadingPosition();scrollTo({top:0,behavior:'auto'});if(currentHash()===target){routeFromHash();requestAnimationFrame(()=>scrollTo({top:0,behavior:'auto'}));return}navigateHash(target);requestAnimationFrame(()=>scrollTo({top:0,behavior:'auto'}))}
function routeFallback(){const p=currentHash().replace(/^#\//,'').split('/'),route=p[0]||'home';if(route==='story')return '#/stories';if(route==='saga')return '#/sagas';if(route==='extra')return '#/extras';if(route==='collection'&&p[1])return '#/collection';if(route==='tutorials')return '#/home';if(['sagas','timeline','random','cassettes','tapes','extras','games','game','micro-pesadillas','micro','micro-preview'].includes(route))return '#/stories';if(route!=='home')return '#/home';return ''}
function updateBackButton(){const btn=$('#backBtn'),fallback=routeFallback();if(!btn)return;const can=navHistory.length>0||!!fallback;btn.classList.toggle('hidden',!can);btn.disabled=!can}
function navigateBack(){if(navHistory.length){const target=navHistory.pop();navGoingBack=true;location.hash=target;return}const fallback=routeFallback();if(fallback){navGoingBack=true;location.hash=fallback}}
function fiveFrameHaptic(){try{if('vibrate' in navigator)navigator.vibrate([24,26,24,26,24,26,24,26,24])}catch{}}
function playStoryEnterTransition(id,sourceEl=null){
  if(storyTransitionBusy)return;
  const target=`#/story/${encodeURIComponent(id)}`;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){navigateHash(target);return}
  storyTransitionBusy=true;fiveFrameHaptic();
  const shell=$('#app');let card=sourceEl&&sourceEl.nodeType===1?sourceEl:null;
  if(!card)card=document.querySelector(`[data-story-id="${CSS.escape(id)}"]`);
  if(!card&&routeName()==='home')card=$('.hero.latest-storm');
  document.querySelector('.story-enter-focus')?.remove();
  let focus=null;
  if(card){
    const r=card.getBoundingClientRect(),pad=3;
    focus=document.createElement('div');focus.className='story-enter-focus';focus.setAttribute('aria-hidden','true');
    focus.style.left=`${Math.max(0,r.left-pad)}px`;focus.style.top=`${Math.max(0,r.top-pad)}px`;
    focus.style.width=`${Math.max(1,Math.min(innerWidth, r.right+pad)-Math.max(0,r.left-pad))}px`;
    focus.style.height=`${Math.max(1,Math.min(innerHeight, r.bottom+pad)-Math.max(0,r.top-pad))}px`;
    const radius=getComputedStyle(card).borderRadius||'14px';focus.style.borderRadius=radius;document.body.appendChild(focus);
  }
  shell?.classList.add('story-entering');
  setTimeout(()=>{focus?.remove();shell?.classList.remove('story-entering');storyTransitionBusy=false;navigateHash(target)},270)
}
function storyGo(id,resume=false,sourceEl=null){if(resume){navigateHash(`#/story/${encodeURIComponent(id)}/resume`);return}playStoryEnterTransition(id,sourceEl)}
function routeFromHash(){closePlayerFullscreen(true);persistCurrentReadingPosition();destroyStoryYoutubePlayers();stopQrScanner();stopRandomSpin(false);clearInterval(homeCountdownTimer);homeCountdownTimer=0;const p=currentHash().replace(/^#\//,'').split('/'),route=p[0]||'home',storyMode=route==='story'?(p[2]||''):'',isResume=storyMode==='resume',storyTab=(!isResume&&storyMode)?decodeURIComponent(storyMode):'';if(route!=='player'){stopPlayerArtwork();stopPlayerWaveVisualizer()}if(!isResume)scrollTo({top:0,behavior:'auto'});view.classList.toggle('home-view',route==='home');view.classList.toggle('collection-view',route==='collection');setNav(route);updateBackButton();$('#toTopHeaderBtn').classList.remove('hidden');if(route==='home')return renderHome();if(route==='tutorials')return renderTutorials();if(route==='stories')return renderStories('all');if(route==='unlocked')return renderMyStories();if(route==='collection')return renderCollection(decodeURIComponent(p[1]||''));if(route==='player')return renderPlayer();if(route==='user')return renderUser();if(route==='unlock')return renderUnlockRoute();if(route==='story')return renderStory(decodeURIComponent(p[1]||''),isResume,storyTab);if(route==='sagas')return renderSagas();if(route==='saga')return renderSaga(decodeURIComponent(p[1]||''));if(route==='timeline')return renderTimeline();if(route==='random')return renderRandom();if(route==='cassettes')return renderMediaCollection('audio');if(route==='tapes')return renderMediaCollection('video');if(route==='extras')return renderExtras();if(route==='extra')return renderExtra(decodeURIComponent(p[1]||''));if(route==='games')return renderGamesCatalog();if(route==='game')return (p[2]==='play'?renderGamePlayer(decodeURIComponent(p[1]||'')):renderGameDetail(decodeURIComponent(p[1]||'')));if(route==='micro-pesadillas')return renderMicroCatalog();if(route==='micro')return renderMicroDetail(decodeURIComponent(p[1]||''));if(route==='micro-preview')return renderMicroPreview();renderHome()}
function userSilhouetteSvg(){return `<svg class="user-silhouette-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.7" r="3.3"/><path d="M5.4 20c.45-4.45 2.9-7 6.6-7s6.15 2.55 6.6 7"/></svg>`}
function sectionIndicatorMarkup(route){
  if(route==='user')return `<span class="section-indicator-user" aria-hidden="true">${userSilhouetteSvg()}</span>`;
  if(route==='unlock')return `<span class="section-indicator-qr" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM17 17h3v3h-3z"/></svg></span>`;
  if(route==='home')return `<span class="section-indicator-home" aria-hidden="true">⌂</span>`;
  if(route==='unlocked')return `<span class="section-indicator-watcher" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3.2 12s3.2-5.2 8.8-5.2S20.8 12 20.8 12s-3.2 5.2-8.8 5.2S3.2 12 3.2 12Z"/><circle cx="12" cy="12" r="2.15"/><circle class="watcher-pupil" cx="12.7" cy="11.3" r=".45"/></svg></span>`;
  if(route==='collection')return `<span class="section-indicator-collection" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
  if(route==='player')return `<span class="section-indicator-player" aria-hidden="true">♫</span>`;
  if(route==='tutorials')return `<span class="section-indicator-tutorials" aria-hidden="true">?</span>`;
  if(route==='sagas'||route==='saga')return `<span class="section-indicator-saga" aria-hidden="true">${animatedFeatureIcon('saga')}</span>`;
  if(route==='timeline')return `<span class="section-indicator-timeline" aria-hidden="true">${animatedFeatureIcon('timeline','portal-custom-svg timeline-portal-svg')}</span>`;
  if(route==='random')return `<span class="section-indicator-random" aria-hidden="true">${animatedFeatureIcon('random')}</span>`;
  if(route==='extras'||route==='extra')return `<span class="section-indicator-extras" aria-hidden="true">${animatedFeatureIcon('extras')}</span>`;
  if(route==='cassettes')return `<span class="section-indicator-cassette" aria-hidden="true">${mediaIconSvg('audio')}</span>`;
  if(route==='tapes')return `<span class="section-indicator-tape" aria-hidden="true">${mediaIconSvg('video')}</span>`;
  if(route==='games'||route==='game')return `<span class="section-indicator-games" aria-hidden="true">${animatedFeatureIcon('game','portal-custom-svg gamepad-portal-svg')}</span>`;
  if(route==='micro-pesadillas'||route==='micro'||route==='micro-preview')return `<span class="section-indicator-micro" aria-hidden="true">${animatedFeatureIcon('micro')}</span>`;
  if(route==='stories'||route==='story')return `<span class="section-indicator-grid" aria-hidden="true">${'<i></i>'.repeat(9)}</span>`;
  return''
}
function updateSectionIndicator(route){const el=$('#sectionIndicator');if(!el)return;el.innerHTML=sectionIndicatorMarkup(route);el.dataset.section=route||'';el.classList.toggle('hidden',!el.innerHTML);updateUserChrome()}
function setNav(route){const storyRoutes=new Set(['stories','story','sagas','saga','timeline','random','cassettes','tapes','extras','extra','games','game','micro-pesadillas','micro','micro-preview']);$$('.nav-btn').forEach(b=>b.classList.toggle('active',(b.dataset.route==='stories'&&storyRoutes.has(route))||b.dataset.route===route));updateSectionIndicator(route);updateUserChrome();updateMiniPlayerVisibility(route)}
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
  const my=s?.mediaYoutube||{},md=s?.mediaDurations||{},sources=s?.mediaDurationSources||{},myl=s?.mediaYoutubeLocales||{},mdl=s?.mediaDurationLocales||{},sl=s?.mediaDurationSourceLocales||{},mal=s?.mediaLocaleAvailability||{};
  const localeHas=kind=>Object.values(myl?.[kind]||{}).some(a=>Array.isArray(a)&&a.length)||Object.values(mdl?.[kind]||{}).some(v=>Number(v)>0)||Object.values(sl?.[kind]||{}).some(v=>String(v||'').toLowerCase()==='youtube')||Object.values(mal?.[kind]||{}).some(Boolean);
  if((Array.isArray(my.audio)&&my.audio.length)||Number(md.audio)>0||String(sources.audio||'').toLowerCase()==='youtube'||localeHas('audio'))set.add('audio');
  if((Array.isArray(my.video)&&my.video.length)||Number(md.video)>0||String(sources.video||'').toLowerCase()==='youtube'||localeHas('video'))set.add('video');
  if(s?.audio===true||s?.audioUrl||s?.audioSrc)set.add('audio');
  if(s?.video===true||s?.videoUrl||s?.videoSrc)set.add('video');
  return set
}
function storyHasFeature(s,f){return storyFeatures(s).has(f)}
function animatedFeatureIcon(kind,extraClass=''){
  const cls=`ds-ani-icon ds-ani-${kind}${extraClass?` ${extraClass}`:''}`;
  if(kind==='cassette')return `<span class="${cls}" aria-hidden="true"><svg class="ds-ani-svg ds-icon-core" viewBox="0 0 24 24"><path class="ds-cassette-arc ds-stroke-mid ds-form-piece" d="M4 12a8 8 0 0 1 16 0"/><rect class="ds-ear-l ds-stroke-short ds-form-piece" x="3" y="12" width="4" height="7" rx="1.5"/><rect class="ds-ear-r ds-stroke-short ds-form-piece" x="17" y="12" width="4" height="7" rx="1.5"/></svg><span class="ds-loop-shell"><span class="ds-cassette-eq"><i></i><i></i><i></i><i></i><i></i></span></span></span>`;
  if(kind==='tape')return `<span class="${cls}" aria-hidden="true"><svg class="ds-ani-svg" viewBox="0 0 24 24"><rect class="ds-tape-body ds-stroke-mid ds-form-piece" x="3" y="6" width="13" height="12" rx="2"/><path class="ds-tape-cone ds-stroke-short ds-form-piece" d="m16 10 5-3v10l-5-3z"/></svg><span class="ds-loop-shell"><i class="ds-screen-glow"></i><i class="ds-play-spark"></i></span></span>`;
  if(kind==='game')return `<span class="${cls}" aria-hidden="true"><svg class="ds-ani-svg ds-icon-core" viewBox="0 0 44 30"><path class="ds-game-outline ds-stroke ds-form-piece" d="M12 8.5h20c4.8 0 8 3.8 8 8.3l-1.2 5.1c-.7 3.1-4.5 4.1-6.6 1.7L28.5 20h-13l-3.7 3.6c-2.1 2.4-5.9 1.4-6.6-1.7L4 16.8c0-4.5 3.2-8.3 8-8.3Z"/><path class="ds-plus-v ds-stroke-short ds-form-piece" d="M12.3 12.5v7"/><path class="ds-plus-h ds-stroke-short ds-form-piece" d="M8.8 16h7"/><circle class="ds-btn-a ds-stroke-short ds-form-piece" cx="31.5" cy="14" r="1.7"/><circle class="ds-btn-b ds-stroke-short ds-form-piece" cx="35.5" cy="18" r="1.7"/><path class="ds-game-topline ds-stroke-mid ds-form-piece" d="M16 8.5 18 5h8l2 3.5"/></svg><span class="ds-loop-shell"><i class="ds-cross-glow"></i><i class="ds-pulse-dot ds-pulse-a"></i><i class="ds-pulse-dot ds-pulse-b"></i></span></span>`;
  if(kind==='micro')return `<span class="${cls}" aria-hidden="true"><i class="ds-micro-diamond"></i><span class="ds-loop-shell"></span></span>`;
  if(kind==='saga')return `<span class="${cls}" aria-hidden="true"><span class="ds-ani-glyph ds-form-glyph">◈</span><span class="ds-loop-shell"><i class="ds-ghost ds-ani-glyph">◈</i></span></span>`;
  if(kind==='timeline')return `<span class="${cls}" aria-hidden="true"><svg class="ds-ani-svg" viewBox="0 0 40 18"><path class="ds-timeline-line ds-stroke ds-form-piece" d="M5 9h30"/><circle class="ds-timeline-node ds-n1 ds-stroke ds-form-piece" cx="5" cy="9" r="3"/><circle class="ds-timeline-node ds-n2 ds-stroke ds-form-piece" cx="20" cy="9" r="3"/><circle class="ds-timeline-node ds-n3 ds-stroke ds-form-piece" cx="35" cy="9" r="3"/></svg><span class="ds-loop-shell"><i class="ds-timeline-runner"></i></span></span>`;
  if(kind==='random')return `<span class="${cls}" aria-hidden="true"><span class="ds-ani-glyph ds-form-glyph">◎</span><span class="ds-loop-shell"><i class="ds-ghost ds-ani-glyph">◎</i></span></span>`;
  if(kind==='extras')return `<span class="${cls}" aria-hidden="true"><span class="ds-ani-glyph ds-form-glyph">＋</span><span class="ds-loop-shell"><i class="ds-ghost ds-ani-glyph">＋</i></span></span>`;
  return '';
}
function mediaIconSvg(type){return animatedFeatureIcon(type==='audio'?'cassette':'tape','media-feature-svg')}
function storyMediaBadges(s){const badges=[];if(storyHasFeature(s,'audio'))badges.push(`<span class="media-badge media-audio" title="Incluye audio" aria-label="Incluye audio">${mediaIconSvg('audio')}</span>`);if(storyHasFeature(s,'video'))badges.push(`<span class="media-badge media-video" title="Incluye vídeo" aria-label="Incluye vídeo">${mediaIconSvg('video')}</span>`);return badges.length?`<span class="story-media-badges ${s?.access==='exclusive'?'has-exclusive':''}">${badges.join('')}</span>`:''}
function storySortBadge(s,sortMode=''){let value='';if(sortMode==='id-asc'||sortMode==='id-desc')value=String(s.id||'').padStart(3,'0');else if(sortMode==='year-asc'||sortMode==='year-desc')value=String(s.year||'—');else if(sortMode==='readtime-asc'||sortMode==='readtime-desc')value=storyReadTimeText(s)||'—';if(!value||sortMode==='title-asc'||sortMode==='published-desc'||sortMode==='published-asc')return'';const classes=['sort-badge'];if(s?.access==='exclusive')classes.push('sort-has-lock');if(isNewStory(s))classes.push('sort-has-new');return `<span class="${classes.join(' ')}" aria-hidden="true">${escapeHtml(value)}</span>`}
function bookFeatureSummary(stories,interactive=false){const audio=stories.filter(s=>storyHasFeature(s,'audio')).length,video=stories.filter(s=>storyHasFeature(s,'video')).length,exclusive=stories.filter(s=>s.access==='exclusive').length;const a=interactive?`<button class="book-feature-count audio clickable" type="button" data-book-feature-jump="audio" title="Mostrar ${audio} Stories con audio" aria-label="Mostrar ${audio} Stories con audio">${mediaIconSvg('audio')}<b>${audio}</b></button>`:`<span class="book-feature-count audio" title="${audio} audios">${mediaIconSvg('audio')}<b>${audio}</b></span>`;const v=interactive?`<button class="book-feature-count video clickable" type="button" data-book-feature-jump="video" title="Mostrar ${video} Stories con vídeo" aria-label="Mostrar ${video} Stories con vídeo">${mediaIconSvg('video')}<b>${video}</b></button>`:`<span class="book-feature-count video" title="${video} vídeos">${mediaIconSvg('video')}<b>${video}</b></span>`;const x=interactive?`<button class="book-feature-count exclusive clickable" type="button" data-book-feature-jump="exclusive" title="Mostrar ${exclusive} Stories exclusivas" aria-label="Mostrar ${exclusive} Stories exclusivas">${lockSvg(false)}<b>${exclusive}</b></button>`:`<span class="book-feature-count exclusive" title="${exclusive} exclusivas">${lockSvg(false)}<b>${exclusive}</b></span>`;return `<div class="book-feature-counts" aria-label="Contenido publicado de este libro">${a}${v}${x}</div>`}

function isLocked(s){return s.access==='exclusive'&&!secretMap()[s.id]}
function displayCover(s){if(!s)return'';return s.cover||coverCache()[s.id]||''}
function heroMedia(s){const image=displayFeatured(s);return `<div class="hero-media hero-story-media">${image?`<img class="hero-backdrop" src="${escAttr(image)}" alt="" aria-hidden="true" loading="eager" referrerpolicy="no-referrer"><img class="hero-rgb-ghost hero-rgb-red" src="${escAttr(image)}" alt="" aria-hidden="true" loading="eager" referrerpolicy="no-referrer"><img class="hero-rgb-ghost hero-rgb-cyan" src="${escAttr(image)}" alt="" aria-hidden="true" loading="eager" referrerpolicy="no-referrer"><img class="hero-main-image" src="${escAttr(image)}" alt="" loading="eager" referrerpolicy="no-referrer">`:`<div class="hero-placeholder">${escapeHtml(s.id||'')}</div>`}${newStoryBadge(s)}${exclusiveBadge(s,'cover')}${storyMediaBadges(s)}</div>`}
function displayFeatured(s){if(!s)return'';return s.featuredImage||displayCover(s)||''}
function storyFeaturedMedia(s,locked=false){const image=locked?displayCover(s):displayFeatured(s);return `<div class="story-featured">${image?`<img src="${escAttr(image)}" alt="${escAttr(s.title||'')}" loading="eager" decoding="async" referrerpolicy="no-referrer">`:`<div class="story-featured-placeholder">${escapeHtml(s.id||'')}</div>`}${newStoryBadge(s)}${locked?'':exclusiveBadge(s,'cover')}${storyMediaBadges(s)}</div>`}

function nextStoryTargetDate(){
  const raw=String(homeData?.nextStoryDate||'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return null;
  const [y,m,d]=raw.split('-').map(Number),target=new Date(y,m-1,d,0,0,0,0);
  if(target.getFullYear()!==y||target.getMonth()!==m-1||target.getDate()!==d)return null;return target
}
function homeNextStoryHtml(){return `<section class="home-next-story"><div class="home-next-story-label">PRÓXIMA STORY</div><div id="homeNextStoryCountdown" class="home-next-story-countdown" aria-live="polite">FECHA PENDIENTE</div></section>`}
function updateHomeNextStoryCountdown(){
  const el=$('#homeNextStoryCountdown');if(!el)return;const target=nextStoryTargetDate();if(!target){el.innerHTML='<strong class="home-next-pending">FECHA PENDIENTE</strong>';return}
  const diff=Math.max(0,target.getTime()-Date.now()),days=Math.floor(diff/86400000),hours=Math.floor((diff%86400000)/3600000),minutes=Math.floor((diff%3600000)/60000),seconds=Math.floor((diff%60000)/1000);
  el.innerHTML=`<span><b>${String(days).padStart(2,'0')}</b><small>DÍAS</small></span><i>:</i><span><b>${String(hours).padStart(2,'0')}</b><small>HORAS</small></span><i>:</i><span><b>${String(minutes).padStart(2,'0')}</b><small>MIN</small></span><i>:</i><span><b>${String(seconds).padStart(2,'0')}</b><small>SEG</small></span>`
}
function startHomeNextStoryCountdown(){clearInterval(homeCountdownTimer);homeCountdownTimer=0;updateHomeNextStoryCountdown();if(nextStoryTargetDate())homeCountdownTimer=setInterval(updateHomeNextStoryCountdown,1000)}
function setupHomeNextStoryReveal(){const box=$('.home-next-story');if(!box)return;const reveal=()=>{box.classList.add('home-next-story-visible');setTimeout(()=>box.classList.add('home-next-story-steady'),900)};if(motionReduced()||!('IntersectionObserver'in window)){reveal();return}box.classList.remove('home-next-story-visible','home-next-story-steady');const io=new IntersectionObserver(entries=>{for(const e of entries){if(!e.isIntersecting)continue;reveal();io.unobserve(e.target)}},{rootMargin:'0px 0px -10% 0px',threshold:.22});io.observe(box)}
function setupHomeProgressReveal(){const box=$('.home-progress');if(!box)return;const fill=box.querySelector('.collection-progress>span'),target=fill?.style.width||'0%';if(fill){fill.dataset.targetWidth=target;fill.style.width='0%';fill.style.transform='none'}box.classList.add('home-progress-reveal-ready');const reveal=()=>{requestAnimationFrame(()=>requestAnimationFrame(()=>{box.classList.add('home-progress-reveal-in');if(fill)fill.style.width=fill.dataset.targetWidth||target}))};if(motionReduced()||!('IntersectionObserver'in window)){box.classList.add('home-progress-reveal-in');if(fill)fill.style.width=target;return}const io=new IntersectionObserver(entries=>{for(const e of entries){if(!e.isIntersecting)continue;reveal();io.unobserve(e.target)}},{rootMargin:'0px 0px -8% 0px',threshold:.22});io.observe(box)}

function homeHighlightStatus(item,now=Date.now()){
  if(!item||item.enabled===false)return 'historical';
  const start=item.startAt?Date.parse(item.startAt):0,end=item.endAt?Date.parse(item.endAt):0;
  if(start&&Number.isFinite(start)&&now<start)return 'scheduled';
  if(end&&Number.isFinite(end)&&now>end)return 'historical';
  return item.status==='draft'?'draft':'active';
}
function activeHomeHighlight(){
  const now=Date.now();
  return [...(homeHighlightsData?.items||[])].filter(x=>homeHighlightStatus(x,now)==='active').sort((a,b)=>(Number(b.number)||0)-(Number(a.number)||0))[0]||null;
}
function homeHighlightMediaHtml(h){
  const image=String(h?.image||'').trim(),video=String(h?.video||'').trim(),ver=String(h?.mediaVersion||'').trim(),withVer=u=>!u?'':`${u}${u.includes('?')?'&':'?'}v=${encodeURIComponent(ver||APP_VERSION)}`;
  if(video)return `<video class="home-highlight-media" autoplay muted loop playsinline preload="metadata" aria-hidden="true"><source src="${escAttr(withVer(video))}" type="video/webm"></video>`;
  if(image)return `<img class="home-highlight-media" src="${escAttr(withVer(image))}" alt="" loading="lazy" referrerpolicy="no-referrer">`;
  return '';
}
function homeHighlightHtml(){
  const h=activeHomeHighlight();if(!h)return'';
  return `<section class="home-highlight" data-home-highlight role="button" tabindex="0" aria-label="${escAttr(h.title||'Destacado temporal')}">${homeHighlightMediaHtml(h)}<div class="home-highlight-shade"></div><div class="home-highlight-copy">${h.badge&&h.showBadge!==false?`<span class="home-highlight-badge">${escapeHtml(h.badge)}</span>`:''}${h.title&&h.showTitle!==false?`<h2>${escapeHtml(h.title)}</h2>`:''}${h.text?`<p>${escapeHtml(h.text).replace(/\n/g,'<br>')}</p>`:''}<span class="home-highlight-cta">${escapeHtml(h.buttonText||'DESCUBRIR')} ›</span></div></section>`;
}
function openHomeHighlight(h=activeHomeHighlight()){
  if(!h)return;const type=String(h.targetType||'').toLowerCase(),id=String(h.targetId||'').trim();
  if(type==='micro'){try{sessionStorage.setItem('ds_highlight_micro',id.padStart(3,'0'))}catch{}go('micro-pesadillas');return}
  if(type==='story'&&id){storyGo(id,false);return}
  if(type==='game'&&id){go(`game/${encodeURIComponent(id)}`);return}
  if(type==='saga'&&id){go(`saga/${encodeURIComponent(id)}`);return}
  if(type==='games'){go('games');return}
  if(type==='micros'){go('micro-pesadillas');return}
  if(type==='url'&&/^https?:\/\//i.test(String(h.url||''))){window.open(String(h.url),'_blank','noopener');return}
  go('stories');
}
function homePreviousStoryCard(s){
  const cover=displayCover(s),read=isRead(s.id),rt=storyReadTimeText(s)||'—';
  const image=cover?`<img src="${escAttr(cover)}" alt="${escAttr(s.title||('Story '+s.id))}" loading="lazy" referrerpolicy="no-referrer">`:`<span class="home-prev-placeholder">${escapeHtml(s.id)}</span>`;
  return `<article class="home-prev-story" data-story-id="${escAttr(s.id)}" aria-label="Story ${escAttr(s.id)} · ${escAttr(s.title||'')}"><div class="home-prev-poster story-thumb-wrap">${image}${readCornerBadge(s)}${newStoryBadge(s)}${exclusiveBadge(s,'cover')}${storyMediaBadges(s)}</div><div class="home-prev-readtime">${escapeHtml(rt)}</div></article>`;
}
function renderHome(){
  currentStory=null;
  const latest=indexData.stories[0];
  if(!latest){view.innerHTML='<div class="empty">Todavía no hay Stories publicadas.</div>';return}
  const reading=latestInProgress(),readCount=publishedReadCount(),total=indexData.stories.length,global=total?readCount/total:0;
  const continueCover=reading?displayCover(reading):'',continueHtml=reading?`<section class="home-continue home-continue-v21 home-continue-link" data-home-continue role="button" tabindex="0" aria-label="Continuar leyendo ${escAttr(reading.title||'Story')}"><div class="home-continue-cover story-thumb-wrap">${continueCover?`<img src="${escAttr(continueCover)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span>${escapeHtml(reading.id)}</span>`}${exclusiveBadge(reading,'cover')}${storyMediaBadges(reading)}</div><div class="home-continue-copy"><div class="eyebrow">Continuar leyendo</div><strong>${escapeHtml(reading.title)}</strong><div class="mini-progress"><span style="width:${pct(storyProgress(reading.id))}"></span></div><small>${pct(storyProgress(reading.id))}</small></div><button id="continueReading" class="continue-btn">CONTINUAR</button></section>`:'';
  const installPanel=homeInstallPanelHtml(),highlightHtml=homeHighlightHtml();
  view.innerHTML=`${installPanel}<section class="hero latest-storm">${heroMedia(latest)}<div class="home-signal-fx" aria-hidden="true"><span class="signal-darken"></span><span class="signal-scanlines"></span><span class="signal-noise"></span><span class="signal-tracking"></span><span class="signal-ghost signal-ghost-red"></span><span class="signal-ghost signal-ghost-cold"></span><span class="signal-slice signal-slice-a"></span><span class="signal-slice signal-slice-b"></span><span class="signal-red-pulse"></span><span class="signal-vignette"></span></div><div class="hero-content"><div class="eyebrow">ÚLTIMA PUBLICACIÓN · ${formatDate(latest.published)} · #${escapeHtml(latest.id)}</div><h1>${escapeHtml(latest.title)}</h1><div class="meta-row">${latest.access==='exclusive'?'<span class="pill red">EXCLUSIVA</span>':'<span class="pill">GRATIS</span>'}${latest.readTime?`<span class="pill">${escapeHtml(latest.readTime)} min</span>`:''}${isRead(latest.id)?'<span class="pill read-pill">✓ LEÍDA</span>':''}</div><button class="cta" id="openLatest">${isLocked(latest)?'VER STORY':'LEER'}</button></div></section><section class="home-progress home-progress-link" data-home-progress role="button" tabindex="0" aria-label="Abrir Mis Stories"><div class="home-progress-copy"><div class="eyebrow">Tu progreso</div><strong>${readCount} / ${total} STORIES LEÍDAS</strong></div><div class="collection-progress"><span style="width:${pct(global)}"></span></div><span class="link-btn">VER MIS STORIES ›</span></section>${homeNextStoryHtml()}${highlightHtml}${continueHtml}<section class="section home-previous"><div class="section-title"><h2>Publicadas anteriormente</h2></div><div class="home-previous-grid">${indexData.stories.slice(1,4).map(homePreviousStoryCard).join('')}</div><button id="openAllStories" class="cta secondary-home-cta">ACCEDE A TODAS LAS STORIES</button><div class="home-bottom-loop" aria-hidden="true"><video autoplay muted loop playsinline preload="metadata" tabindex="-1"><source src="${escAttr(PUBLIC_APP_ASSET_BASE+'homeloop.webm')}" type="video/webm"></video></div></section>`;
  $('#openLatest').onclick=e=>storyGo(latest.id,false,$('.hero.latest-storm')||e.currentTarget);
  const progressCard=$('[data-home-progress]');if(progressCard){const openProgress=()=>go('unlocked');progressCard.onclick=openProgress;progressCard.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openProgress()}}}
  const highlight=$('[data-home-highlight]');if(highlight){const open=()=>openHomeHighlight();highlight.onclick=open;highlight.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}}
  const allBtn=$('#openAllStories');if(allBtn)allBtn.onclick=()=>go('stories');
  if(reading){const continueCard=$('[data-home-continue]');if(continueCard){const openContinue=()=>storyGo(reading.id,true);continueCard.onclick=openContinue;continueCard.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openContinue()}}}}
  const installPanelBtn=$('#homeInstallPanel');if(installPanelBtn)installPanelBtn.onclick=handleInstallApp;
  bindStoryCards();bindBrokenImages();updateInstallButton();startHomeNextStoryCountdown();setupHomeNextStoryReveal();setupHomeProgressReveal();maybeAutoTutorial('home');
}
function renderStories(initial='all'){
  currentStory=null;
  const savedView=store.get(storiesViewKey,'covers'),validViews=['covers','grid','list'];
  let viewMode=validViews.includes(savedView)?savedView:'covers',currentFilter=initial,search='',sortMode='published-desc',feature='all',category='all',book='all';
  const categories=[...new Set(indexData.stories.flatMap(s=>s.categories||[]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'es',{sensitivity:'base'}));
  const books=[...new Set(indexData.stories.map(s=>String(s.book||'').trim()).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  const readCount=publishedReadCount(),available=availableStoryCount(),total=indexData.stories.length,explorer=storiesExplorerHtml();
  view.innerHTML=`<section class="section stories-section stories-v22-enter"><div class="section-title stories-title-with-loop"><div><div class="eyebrow">TODAS LAS</div><h1>Stories</h1></div><div class="stories-title-loop" aria-hidden="true"><video autoplay muted loop playsinline preload="metadata" tabindex="-1"><source src="${escAttr(PUBLIC_APP_ASSET_BASE+'todasloop.webm')}" type="video/webm"></video></div></div><div class="library-stats" aria-label="Estado de la biblioteca"><button type="button" data-library-stat="read"><strong>${readCount}</strong><span>LEÍDAS</span></button><button type="button" data-library-stat="available"><strong>${available}</strong><span>DISPONIBLES PARA TI</span></button><button type="button" data-library-stat="all"><strong>${total}</strong><span>PUBLICADAS</span></button></div>${explorer}<div class="library-controls"><label class="story-search"><span>⌕</span><input id="storySearch" type="search" placeholder="Buscar título o número…" autocomplete="off"></label><select id="storySort" class="story-select" aria-label="Ordenar Stories"><option value="published-desc">Más recientes</option><option value="published-asc">Más antiguas</option><option value="id-asc">Número · 001 → 300</option><option value="id-desc">Número · 300 → 001</option><option value="year-asc">Año historia · menor</option><option value="year-desc">Año historia · mayor</option><option value="readtime-asc">Tiempo de lectura · menor → mayor</option><option value="readtime-desc">Tiempo de lectura · mayor → menor</option><option value="title-asc">Título · A → Z</option></select></div><div class="story-control-strip"><select id="statusFilter" class="story-select" aria-label="Filtrar por estado"><option value="all">Todas las Stories</option><option value="public">Gratis</option><option value="exclusive">Exclusivas</option><option value="unlocked">Desbloqueadas</option><option value="read">Leídas</option><option value="unread">No leídas</option></select><button id="toggleAdvancedFilters" class="advanced-toggle" type="button" aria-expanded="false">MÁS FILTROS ▾</button><div class="view-modes" role="group" aria-label="Modo de visualización"><button class="view-mode" data-view="covers" title="Solo portadas" aria-label="Solo portadas">▦</button><button class="view-mode" data-view="grid" title="Mosaico" aria-label="Mosaico">▤</button><button class="view-mode" data-view="list" title="Lista" aria-label="Lista">☷</button></div></div><div id="advancedFilters" class="advanced-filters hidden"><select id="categoryFilter" class="story-select" aria-label="Filtrar por categoría"><option value="all">Todas las categorías</option>${categories.map(c=>`<option value="${escAttr(c)}">${escapeHtml(c)}</option>`).join('')}</select><select id="bookFilter" class="story-select" aria-label="Filtrar por libro"><option value="all">Todos los libros</option>${books.map(b=>`<option value="${escAttr(b)}">Libro ${escapeHtml(b)}</option>`).join('')}</select><select id="featureFilter" class="story-select" aria-label="Filtrar por contenido"><option value="all">Todo el contenido</option><option value="audio">Con audio</option><option value="video">Con vídeo</option><option value="extra">Con extras</option></select></div><div id="storiesCount" class="results-count"></div><div id="storiesList"></div></section>`;
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
  bindStoryExplorer();draw();bindAllStoriesInteractionFx();requestAnimationFrame(()=>requestAnimationFrame(()=>view.querySelector('.stories-section')?.classList.add('stories-v22-on')));
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
  const firstProgress=progress.slice(0,4),extraProgress=progress.slice(4);
  const continueHtml=progress.length?`<section class="my-group my-continue-group" id="myContinueGroup"><div class="section-title compact"><h2>Continuar leyendo</h2><small>${progress.length}</small></div><div class="continue-list">${firstProgress.map(continueCard).join('')}${extraProgress.length?`<button id="continueMoreBtn" class="continue-more-btn" type="button">MÁS</button><div id="continueExtra" class="continue-extra hidden">${extraProgress.map(continueCard).join('')}</div><button id="continueCollapseBtn" class="continue-collapse-btn hidden" type="button">COLAPSAR</button>`:''}</div></section>`:'';
  const myAvatar=avatarById(selectedAvatarId()),myLevel=earnedAchievementCount(),myAvatarSrc=myAvatar?avatarImageUrl(myAvatar):PUBLIC_APP_ASSET_BASE+'app-icon.png';
  view.innerHTML=`<section class="section my-stories"><div class="section-title my-stories-title"><div class="my-stories-heading"><div class="eyebrow my-stories-eyebrow">Tu colección personal</div><h1>Mis Stories</h1></div><div class="my-stories-avatar-slot"><button id="myStoriesAvatar" class="my-stories-avatar" type="button" aria-label="Abrir USER"><img src="${escAttr(myAvatarSrc)}" alt="Avatar" referrerpolicy="no-referrer"><span class="drawer-level-badge my-stories-level-badge ${myLevel>=100?'level-3plus':myLevel>=10?'level-multi':''}"><span class="user-level-number">${myLevel}</span><span class="user-level-star">★</span></span></button></div></div>${badgePermissionPanel()}<button class="progress-dashboard stat-action" type="button" data-my-jump="read"><div class="progress-big"><div class="progress-count-line"><strong>${readCount}</strong><span class="progress-denom">de ${available}</span></div><em>DISPONIBLES LEÍDAS</em></div><div class="progress-side"><div class="collection-progress large"><span style="width:${pct(available?readCount/available:0)}"></span></div><p>${readCount===available&&available?'✓ Has leído todas las Stories que tienes disponibles.':'Completa las Stories que tienes disponibles y haz crecer tu colección.'}</p></div></button><div class="personal-stats"><div class="stat-action" role="button" tabindex="0" data-my-jump="progress"><strong>${progress.length}</strong><span>EN PROGRESO</span></div><div class="stat-action my-unread-stat" role="button" tabindex="0" data-my-jump="unread"><strong>${unreadAccessible.length}</strong><span>TODAVÍA POR LEER</span></div><div class="stat-action" role="button" tabindex="0" data-my-jump="unlocked"><strong>${unlocked.length}</strong><span>DESBLOQUEADAS</span></div><div class="stat-action" role="button" tabindex="0" data-my-jump="blocked"><strong>${qrPending}</strong><span>BLOQUEADAS</span></div></div>${continueHtml}<section class="my-group my-results-group" id="myResultsGroup"><div class="my-tabs" id="myFilterBar"><button class="my-filter" data-my="read">LEÍDAS</button><button class="my-filter" data-my="unlocked">DESBLOQUEADAS</button><button class="my-filter active" data-my="unread">NO LEÍDAS</button><button class="my-filter" data-my="blocked">BLOQUEADAS</button></div><div id="myStoriesGrid" class="stories-view stories-view-covers"></div></section></section>`;
  $('#myStoriesAvatar')?.addEventListener('click',()=>go('user'));
  syncMyStoriesHeaderAvatar();
  setupMyStoriesReadCounter(readCount);
  const draw=(mode='unread')=>{ $$('.my-filter').forEach(b=>b.classList.toggle('active',b.dataset.my===mode));let a=[];if(mode==='read')a=indexData.stories.filter(s=>accessibleStory(s)&&readIds.has(s.id));if(mode==='unlocked')a=unlocked;if(mode==='unread')a=unreadAccessible;if(mode==='blocked')a=blocked;a.sort((x,y)=>new Date(y.published)-new Date(x.published));$('#myStoriesGrid').innerHTML=a.length?a.map(s=>storyCard(s,'covers')).join(''):'<div class="empty my-empty">Todavía no hay Stories en esta sección.</div>';bindStoryCards();bindBrokenImages();};
  const scrollResultsToHeader=()=>requestAnimationFrame(()=>{const bar=$('#myFilterBar');if(!bar)return;const headerH=$('.topbar')?.getBoundingClientRect().height||70;const y=Math.max(0,scrollY+bar.getBoundingClientRect().top-headerH-18);scrollTo({top:y,behavior:'smooth'})});
  const jumpToResults=mode=>{draw(mode);scrollResultsToHeader()};
  $$('.my-filter').forEach(b=>b.onclick=()=>draw(b.dataset.my));
  $$('[data-my-jump]').forEach(el=>{const run=()=>{const mode=el.dataset.myJump;if(mode==='progress'){const c=$('#myContinueGroup');if(c){const headerH=$('.topbar')?.getBoundingClientRect().height||70;const title=c.querySelector('.section-title')||c;const y=Math.max(0,scrollY+title.getBoundingClientRect().top-headerH-8);scrollTo({top:y,behavior:'smooth'});requestAnimationFrame(()=>{c.querySelectorAll('.continue-card').forEach((card,i)=>{card.classList.remove('progress-jump-flash');void card.offsetWidth;setTimeout(()=>card.classList.add('progress-jump-flash'),i*55);setTimeout(()=>card.classList.remove('progress-jump-flash'),1600+i*55)})})}return}jumpToResults(mode)};el.onclick=run;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();run()}}});
  $$('[data-resume-id]').forEach(el=>{const run=()=>storyGo(el.dataset.resumeId,true);el.onclick=run;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();run()}}});
  const more=$('#continueMoreBtn'),extra=$('#continueExtra'),collapse=$('#continueCollapseBtn');if(more&&extra&&collapse){more.onclick=()=>{more.classList.add('hidden');extra.classList.remove('hidden');collapse.classList.remove('hidden')};collapse.onclick=()=>{extra.classList.add('hidden');collapse.classList.add('hidden');more.classList.remove('hidden');$('#myContinueGroup')?.scrollIntoView({behavior:'smooth',block:'start'})}}
  const badgeBtn=$('#enableAppBadge');if(badgeBtn)badgeBtn.onclick=requestBadgePermission;
  const externalJump=sessionStorage.getItem('disturbing_my_jump_v26');if(externalJump){sessionStorage.removeItem('disturbing_my_jump_v26');draw(externalJump);scrollResultsToHeader()}else draw('unread');bindBrokenImages();
}
function syncMyStoriesHeaderAvatar(){
  const title=$('.my-stories-title'),avatar=$('#myStoriesAvatar');if(!title||!avatar)return;
  // v5.27 · el avatar ocupa el hueco derecho que antes pertenecía a "Todavía por leer".
  // El tamaño queda estable y circular; el nivel permanece superpuesto como en el menú lateral.
  const apply=()=>{const mobile=matchMedia('(max-width:390px)').matches,h=mobile?48:56;avatar.style.width=`${h}px`;avatar.style.height=`${h}px`;avatar.style.flexBasis=`${h}px`};
  apply();requestAnimationFrame(apply);
}
function continueCard(s){const pr=storyProgress(s.id),cover=displayCover(s);return `<article class="continue-card continue-card-link" role="button" tabindex="0" data-resume-id="${escAttr(s.id)}" aria-label="Continuar Story ${escAttr(s.id)}"><div class="continue-cover story-thumb-wrap">${cover?`<img src="${escAttr(cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span>${escapeHtml(s.id)}</span>`}</div><div class="continue-copy"><div class="story-number">STORY ${escapeHtml(s.id)}</div><strong>${escapeHtml(s.title)}</strong><div class="continue-inline-icons">${exclusiveBadge(s,'inline')}${storyMediaBadges(s)}</div><div class="mini-progress"><span style="width:${pct(pr)}"></span></div><small>${pct(pr)}</small></div><span class="resume-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></span></article>`}

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
function bookTrailerHtml(url,bookId){
  url=String(url||'').trim();if(!url)return'';const src=youtubeEmbedUrl(url);
  return `<section class="book-trailer"><div class="book-trailer-video"><iframe src="${escAttr(src)}" title="Booktrailer ${escAttr(bookLabel(bookId))}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div></section>`
}
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
    const stories=[...books.get(bookId)].sort((a,b)=>new Date(b.published)-new Date(a.published)),read=stories.filter(s=>readIds.has(s.id)).length,available=stories.filter(accessibleStory).length,bookCompleteRead=read>=15,asset=bookAsset(bookId),hasAudio=stories.some(s=>storyHasFeature(s,'audio')),hasVideo=stories.some(s=>storyHasFeature(s,'video')),hasExclusive=stories.some(s=>s.access==='exclusive');
    const covers=[asset.front&&`<figure class="book-cover-side"><img class="book-product-front" src="${escAttr(asset.front)}" alt="Portada ${escAttr(bookLabel(bookId))}"><figcaption>PORTADA</figcaption></figure>`,asset.back&&`<figure class="book-cover-side"><img class="book-product-back" src="${escAttr(asset.back)}" alt="Contraportada ${escAttr(bookLabel(bookId))}"><figcaption>CONTRAPORTADA</figcaption></figure>`].filter(Boolean).join('');
    view.innerHTML=`<section class="section collection-section"><button class="collection-back" id="collectionBack">‹ COLECCIÓN</button><div class="book-detail-head"><div><div class="eyebrow">Tu colección</div><div class="book-detail-title-row"><h1>${escapeHtml(bookLabel(bookId))}</h1>${bookFeatureSummary(stories,true)}</div>${asset.pages?`<div class="book-pages-detail">${escapeHtml(asset.pages)} PÁGINAS</div>`:''}</div>${bookTrailerHtml(asset.trailer,bookId)}${covers?`<div class="book-cover-spread ${asset.back?'':'single'}">${covers}</div>`:''}</div>${asset.amazon?`<a class="amazon-buy-btn" href="${escAttr(asset.amazon)}" target="_blank" rel="noopener noreferrer"><span class="amazon-buy-copy">COMPRAR EN <span class="amazon-wordmark">AMAZON</span></span></a>`:''}<div class="book-detail-stats ${bookCompleteRead?'is-book-complete':''}"><div><strong>${read}</strong><span>LEÍDAS</span></div><div><strong>${available}</strong><span>DISPONIBLES</span></div><div><strong>${stories.length}</strong><span>PUBLICADAS</span></div></div><div class="collection-progress large"><span style="width:${pct(stories.length?read/stories.length:0)}"></span></div><div class="book-story-filters"><button class="book-story-filter active" data-book-feature="all">TODAS</button><button class="book-story-filter" data-book-feature="audio">CON AUDIO</button><button class="book-story-filter" data-book-feature="video">CON VÍDEO</button><button class="book-story-filter" data-book-feature="exclusive">EXCLUSIVAS</button></div><div id="bookStoriesGrid" class="stories-view stories-view-covers collection-story-grid"></div></section>`;
    const draw=(feature='all')=>{let a=stories;if(feature==='audio'||feature==='video')a=stories.filter(st=>storyHasFeature(st,feature));if(feature==='exclusive')a=stories.filter(st=>st.access==='exclusive');$('#bookStoriesGrid').innerHTML=a.map(st=>storyCard(st,'covers')).join('')||'<div class="empty">No hay Stories con este contenido.</div>';$$('.book-story-filter').forEach(b=>b.classList.toggle('active',b.dataset.bookFeature===feature));bindStoryCards();bindBrokenImages()};
    $$('.book-story-filter').forEach(b=>b.onclick=()=>draw(b.dataset.bookFeature));$$('[data-book-feature-jump]').forEach(b=>b.onclick=()=>{const feature=b.dataset.bookFeatureJump;draw(feature);requestAnimationFrame(()=>$('#bookStoriesGrid')?.scrollIntoView({behavior:'smooth',block:'start'}))});$('#collectionBack').onclick=()=>go('collection');draw();forcePageTop();return;
  }
  const shelf=ordered.map(([book])=>{const a=bookAsset(book),has=!!a.spine;return `<button class="shelf-book ${has?'has-spine':'fallback-spine'}" data-book-scroll="${escAttr(book)}" aria-label="Ir a ${escAttr(bookLabel(book))}">${has?`<img src="${escAttr(a.spine)}" alt="${escAttr(bookLabel(book))}">`:`<span>${escapeHtml(bookLabel(book))}</span>`}</button>`}).join('');
  const cards=ordered.map(([book,stories])=>{stories.sort((a,b)=>new Date(b.published)-new Date(a.published));const read=stories.filter(s=>readIds.has(s.id)).length,asset=bookAsset(book),thumbs=stories.slice(0,3).map(s=>displayCover(s)).filter(Boolean);const visual=asset.front?`<div class="book-front"><img src="${escAttr(asset.front)}" alt="${escAttr(bookLabel(book))}" loading="lazy"></div>`:`<div class="book-thumbs">${thumbs.length?thumbs.map(src=>`<img src="${escAttr(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join(''):`<div class="book-placeholder">${escapeHtml(book)}</div>`}</div>`;return `<article id="book-${escAttr(book)}" class="book-card ${read>=15?'book-complete-read':''}" data-book-id="${escAttr(book)}" data-ui-sound="pages" role="button" tabindex="0">${visual}<div class="book-copy"><div class="book-card-title-row"><h2>${escapeHtml(bookLabel(book))}</h2>${read>=15?'<span class="book-read-bubble">LIBRO LEÍDO</span>':''}</div><div class="book-numbers-row"><div class="book-numbers"><strong>${read}/15</strong><span>LEÍDAS</span></div>${bookFeatureSummary(stories)}</div>${asset.pages?`<div class="book-pages"><strong>${escapeHtml(asset.pages)}</strong><span>PÁGINAS</span></div>`:''}<div class="collection-progress"><span style="width:${pct(read/15)}"></span></div><span class="book-open">VER STORIES ›</span></div></article>`}).join('');
  view.innerHTML=`<section class="section collection-section"><div class="section-title collection-title collection-title-with-loop"><div class="collection-title-copy"><div class="eyebrow collection-eyebrow">BIBLIOTECA DE LA</div><h1>Colección</h1></div><div class="collection-header-loop" aria-hidden="true"><video autoplay muted loop playsinline preload="metadata" tabindex="-1"><source src="${escAttr(PUBLIC_APP_ASSET_BASE+'collectionloop.webm')}" type="video/webm"></video></div></div>${shelf?`<div class="book-shelf-wrap"><div class="book-shelf-title">ESTANTERÍA</div><div class="book-shelf">${shelf}</div><div class="shelf-reading-loop" aria-hidden="true"><video autoplay muted loop playsinline preload="metadata" tabindex="-1"><source src="${escAttr(PUBLIC_APP_ASSET_BASE+'biblioloop.webm')}" type="video/webm"></video></div><div class="shelf-board"></div></div>`:''}<div class="books-grid">${cards||'<div class="empty">Todavía no hay libros con Stories publicadas.</div>'}</div><div class="collection-bibliofooter" aria-hidden="true"><video autoplay muted loop playsinline preload="metadata" tabindex="-1"><source src="${escAttr(PUBLIC_APP_ASSET_BASE+'bibliofooter.webm')}" type="video/webm"></video></div></section>`;
  $$('[data-book-id]').forEach(el=>{const open=()=>{if(el.classList.contains('book-card-opening'))return;el.classList.add('book-card-opening');setTimeout(()=>go(`collection/${el.dataset.bookId}`),motionReduced()?20:360)};el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}});
  $$('[data-book-scroll]').forEach(el=>el.onclick=()=>{const target=document.getElementById(`book-${el.dataset.bookScroll}`);if(!target)return;target.scrollIntoView({behavior:'smooth',block:'center'});const delay=motionReduced()?20:360;setTimeout(()=>{target.classList.remove('book-card-flash');void target.offsetWidth;target.classList.add('book-card-flash');setTimeout(()=>target.classList.remove('book-card-flash'),1000)},delay)});
  bindBrokenImages();requestAnimationFrame(fitCollectionShelf);
}
function playerState(){return store.get(playerStateKey,{index:0,shuffle:false,repeatMode:'off',volume:.85})}
function savePlayerState(){const a=$('#globalPlayerAudio');store.set(playerStateKey,{index:playerIndex,shuffle:playerShuffle,repeatMode:playerRepeatMode,volume:a?Number(a.volume):.85})}
function trackNameFromFile(name=''){try{return decodeURIComponent(String(name)).replace(/\.mp3$/i,'')}catch{return String(name).replace(/\.mp3$/i,'')}}
async function ensurePlayerManifest(){if(playerTracks.length)return playerTracks;if(playerManifestLoading)return playerManifestLoading;playerManifestLoading=(async()=>{const r=await fetch(`${PLAYER_MANIFEST}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`PLAYER manifest HTTP ${r.status}`);const j=await r.json(),list=Array.isArray(j)?j:(j.tracks||[]),saved=Array.isArray(playerCatalogData?.tracks)?playerCatalogData.tracks:[],byFile=new Map(saved.map(x=>[String(x.file||''),x]));playerTracks=list.filter(x=>typeof x==='string'&&/\.mp3$/i.test(x)).map(file=>{const cfg=byFile.get(String(file))||{};return{file,name:trackNameFromFile(file),src:PLAYER_MUSIC_BASE+String(file).split('/').map(encodeURIComponent).join('/'),images:Array.isArray(cfg.images)?cfg.images.map(String).map(x=>x.trim()).filter(Boolean):[]}});const st=playerState();playerIndex=Math.min(Math.max(0,Number(st.index)||0),Math.max(0,playerTracks.length-1));playerShuffle=!!st.shuffle;playerRepeatMode=['off','one','all'].includes(st.repeatMode)?st.repeatMode:'off';playerActivated=false;return playerTracks})().finally(()=>playerManifestLoading=null);return playerManifestLoading}

function playerTrackImages(track=playerTracks[playerIndex]){return [...new Set((track?.images||[]).map(String).map(x=>x.trim()).filter(x=>/^https?:\/\//i.test(x)))]}
function ensurePlayerFullscreenLayer(){let layer=$('#playerFullscreenLayer');if(layer)return layer;layer=document.createElement('div');layer.id='playerFullscreenLayer';layer.className='player-fullscreen-layer hidden';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-hidden','true');layer.setAttribute('aria-label','Disturbing Player a pantalla completa');layer.innerHTML=`<button id="playerFullscreenClose" class="player-fullscreen-close" type="button" aria-label="Cerrar pantalla completa" title="Cerrar"><svg class="player-fullscreen-close-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19"/></svg></button><div id="playerFullscreenStage" class="player-fullscreen-stage"></div>`;document.body.append(layer);$('#playerFullscreenClose',layer).onclick=()=>closePlayerFullscreen();layer.addEventListener('click',e=>{if(e.target===layer)closePlayerFullscreen()});return layer}
function openPlayerFullscreen(){const consoleEl=$('#playerConsole'),host=$('#playerConsoleHost');if(!consoleEl||!host)return;const normalRect=consoleEl.getBoundingClientRect();if(normalRect.width>0)consoleEl.style.setProperty('--ds435-normal-console-width',`${Math.round(normalRect.width)}px`);const layer=ensurePlayerFullscreenLayer(),stage=$('#playerFullscreenStage',layer);if(!stage)return;stage.append(consoleEl);layer.classList.remove('hidden');layer.setAttribute('aria-hidden','false');document.body.classList.add('player-fullscreen-open');requestAnimationFrame(()=>{$$('.ds435-player-artwork-slide img',consoleEl).forEach(playerArtworkFit);syncPlayerUI();const a=$('#globalPlayerAudio');if(a&&!a.paused)startPlayerWaveVisualizer();$('#playerFullscreenClose',layer)?.focus()})}
function closePlayerFullscreen(force=false){const layer=$('#playerFullscreenLayer');if(!layer||layer.classList.contains('hidden'))return;const consoleEl=$('#playerConsole'),host=$('#playerConsoleHost');if(consoleEl&&host)host.append(consoleEl);layer.classList.add('hidden');layer.setAttribute('aria-hidden','true');document.body.classList.remove('player-fullscreen-open');if(!force)requestAnimationFrame(()=>{$$('.ds435-player-artwork-slide img',consoleEl||document).forEach(playerArtworkFit);$('#playerFullscreenBtn')?.focus()})}
function stopPlayerArtworkMotion(){if(playerArtworkMotionRaf)cancelAnimationFrame(playerArtworkMotionRaf);playerArtworkMotionRaf=0}
function stopPlayerArtwork(){clearTimeout(playerArtworkTimer);playerArtworkTimer=0;stopPlayerArtworkMotion();playerArtworkTrack='';playerArtworkIndex=0}
function startPlayerArtworkMotion(box,key){
  // v4.29.1: el movimiento principal se coreografía con CSS por slide.
  // Se conserva esta función como punto de compatibilidad, pero sin rAF/transform inline.
  stopPlayerArtworkMotion();
}
function playerArtworkFit(img){if(!img)return;const apply=()=>{const box=img.closest('.ds435-player-artwork');if(!box||!img.naturalWidth||!img.naturalHeight)return;const br=box.getBoundingClientRect(),imageRatio=img.naturalWidth/img.naturalHeight,boxRatio=Math.max(.01,br.width/br.height);img.classList.toggle('pan-x',imageRatio>boxRatio*1.08);img.classList.toggle('pan-y',imageRatio<boxRatio*.92);img.classList.toggle('pan-soft',imageRatio>=boxRatio*.92&&imageRatio<=boxRatio*1.08)};if(img.complete)apply();else img.addEventListener('load',apply,{once:true})}
function playerArtworkTiming(track,count){
  const a=$('#globalPlayerAudio'),saved=playerSavedDuration(track?.file),live=(a&&Number.isFinite(a.duration)&&a.duration>0)?Number(a.duration):0,total=saved||live||0;
  if(count<=1){const base=Math.max(3800,Math.min(5200,total?total*420:4600)),motionMs=Math.round(base*2);return{slotMs:0,fadeMs:0,motionMs}}
  const rawSlot=total>0?(total*1000/count):8500;
  const previousSlot=Math.max(6200,Math.min(10000,rawSlot));
  const slotMs=Math.round(previousSlot*2);
  const fadeMs=Math.max(1600,Math.min(3200,previousSlot*.32));
  return{slotMs,fadeMs,motionMs:Math.max(6000,slotMs-fadeMs)};
}
function animatePlayerArtworkImage(img,{delayMs=0,motionMs=8800,loop=false}={}){
  if(!img)return;
  try{img.getAnimations().forEach(a=>a.cancel())}catch{}
  // v4.33: una sola propiedad transform. Evita saltos de WebKit al mezclar
  // scale/translate individuales justo cuando empieza el crossfade.
  img.style.scale='';img.style.translate='';img.style.transform='translate3d(0,0,0) scale(1)';
  if(motionReduced())return;
  const raw=Math.max(5200,Number(motionMs)||8800);
  const settleSafety=loop?0:220; // queda realmente quieta antes de empezar el fundido siguiente
  const d=Math.max(4800,raw-settleSafety);
  const returnMs=loop?Math.min(3000,Math.max(2200,d*.34)):Math.min(3000,Math.max(2600,d*.38));
  const returnStart=Math.max(.52,Math.min(.80,(d-returnMs)/d));
  const idx=Number((String(img.className).match(/motion-v(\d+)/)||[])[1]||0)%4;
  const paths=[[4.2,-2.4],[-4.4,2.2],[3.2,3.1],[-3.5,-3.0]],p=paths[idx];
  const hold=Math.min(.18,Math.max(.07,900/d));
  const peak=Math.min(returnStart-.09,hold+(returnStart-hold)*.54);
  const maxScale=d<7200?1.15:(d<10500?1.18:1.20);
  const midScale=1+(maxScale-1)*.68;
  const t=(x,y,sc)=>`translate3d(${x}%,${y}%,0) scale(${sc})`;
  try{
    const anim=img.animate([
      {transform:t(0,0,1),offset:0,easing:'linear'},
      {transform:t(0,0,1),offset:hold,easing:'ease-in-out'},
      {transform:t(p[0],p[1],maxScale),offset:peak,easing:'ease-in-out'},
      {transform:t(p[0]*.68,p[1]*.68,midScale),offset:returnStart,easing:'ease-in-out'},
      {transform:t(0,0,1),offset:1,easing:'cubic-bezier(.32,.02,.18,1)'}
    ],{duration:d,delay:Math.max(0,delayMs),iterations:loop?Infinity:1,fill:'forwards'});
    if(!loop)anim.finished.then(()=>{img.style.transform='translate3d(0,0,0) scale(1)'}).catch(()=>{});
  }catch{img.style.transform='translate3d(0,0,0) scale(1)'}
}
function activatePlayerArtwork(index,initial=false,timing=null){const box=$('#playerArtwork');if(!box)return;const slides=$$('.ds435-player-artwork-slide',box);if(!slides.length)return;const cfg=timing||playerArtworkTiming(playerTracks[playerIndex],slides.length),previous=slides[playerArtworkIndex];playerArtworkIndex=((index%slides.length)+slides.length)%slides.length;const next=slides[playerArtworkIndex];slides.forEach(el=>{el.style.transitionDuration=`${cfg.fadeMs||0}ms`;if(el!==next&&el!==previous){el.classList.remove('active','leaving','artwork-initial','artwork-cycle-incoming','artwork-cycle-single')}});if(previous&&previous!==next){previous.classList.add('active','leaving');previous.classList.remove('artwork-initial','artwork-cycle-incoming','artwork-cycle-single')}next.classList.remove('leaving','artwork-cycle-incoming','artwork-cycle-single');next.classList.toggle('artwork-initial',!!initial);next.classList.remove('active');void next.offsetWidth;next.classList.add('active');box.classList.toggle('single',slides.length===1);const img=next.querySelector('img');if(img){img.classList.add('motion-run');animatePlayerArtworkImage(img,{delayMs:slides.length===1||initial?0:cfg.fadeMs,motionMs:slides.length===1?cfg.motionMs:Math.max(5200,cfg.slotMs-(initial?0:cfg.fadeMs)),loop:slides.length===1})}if(slides.length===1)next.classList.add('artwork-cycle-single');else if(!initial)next.classList.add('artwork-cycle-incoming');if(previous&&previous!==next)setTimeout(()=>{previous.classList.remove('leaving','active','artwork-initial','artwork-cycle-incoming','artwork-cycle-single');const oldImg=previous.querySelector('img');if(oldImg){try{oldImg.getAnimations().forEach(a=>a.cancel())}catch{}oldImg.style.scale='';oldImg.style.translate='';oldImg.style.transform='translate3d(0,0,0) scale(1)'}},(cfg.fadeMs||0)+120)}
function cleanupPlayerVolumeArtifacts(){return}
function setPlayerVolumeFromPointer(ev){const a=$('#globalPlayerAudio'),ctl=$('#playerVolumeControl');if(!a||!ctl)return;const r=ctl.getBoundingClientRect(),x=Math.max(0,Math.min(r.width,(ev.clientX??r.left)-r.left)),v=r.width?x/r.width:0;a.volume=Math.max(0,Math.min(1,v));playerActivated=true;savePlayerState();syncPlayerUI()}
function bindPlayerProgressControl(){const ctl=$('#playerProgress'),a=$('#globalPlayerAudio');if(!ctl||!a)return;let dragging=false;const seek=x=>{const r=ctl.getBoundingClientRect();if(!(r.width>0)||!(a.duration>0))return;const p=Math.max(0,Math.min(1,(Number(x)-r.left)/r.width));a.currentTime=a.duration*p;syncPlayerUI()};ctl.addEventListener('pointerdown',e=>{dragging=true;try{ctl.setPointerCapture(e.pointerId)}catch{}seek(e.clientX);e.preventDefault()});ctl.addEventListener('pointermove',e=>{if(!dragging)return;seek(e.clientX);e.preventDefault()});const stop=e=>{if(!dragging)return;seek(e.clientX);dragging=false;try{ctl.releasePointerCapture(e.pointerId)}catch{};e.preventDefault()};ctl.addEventListener('pointerup',stop);ctl.addEventListener('pointercancel',()=>{dragging=false});if(!('PointerEvent'in window)){ctl.addEventListener('touchstart',e=>{const t=e.touches?.[0];if(!t)return;dragging=true;seek(t.clientX);e.preventDefault()},{passive:false});ctl.addEventListener('touchmove',e=>{if(!dragging)return;const t=e.touches?.[0];if(!t)return;seek(t.clientX);e.preventDefault()},{passive:false});ctl.addEventListener('touchend',e=>{const t=e.changedTouches?.[0];if(t)seek(t.clientX);dragging=false;e.preventDefault()},{passive:false})}ctl.addEventListener('click',e=>seek(e.clientX));ctl.addEventListener('keydown',e=>{if(!(a.duration>0))return;let next=a.currentTime;if(e.key==='ArrowLeft'||e.key==='ArrowDown')next-=Math.max(1,a.duration*.02);else if(e.key==='ArrowRight'||e.key==='ArrowUp')next+=Math.max(1,a.duration*.02);else if(e.key==='Home')next=0;else if(e.key==='End')next=a.duration;else return;e.preventDefault();a.currentTime=Math.max(0,Math.min(a.duration,next));syncPlayerUI()})}
function bindPlayerVolumeControl(){const ctl=$('#playerVolumeControl');if(!ctl)return;let dragging=false;ctl.addEventListener('pointerdown',e=>{dragging=true;try{ctl.setPointerCapture(e.pointerId)}catch{}setPlayerVolumeFromPointer(e);e.preventDefault()});ctl.addEventListener('pointermove',e=>{if(!dragging)return;setPlayerVolumeFromPointer(e);e.preventDefault()});const stop=e=>{if(!dragging)return;dragging=false;try{ctl.releasePointerCapture(e.pointerId)}catch{}};ctl.addEventListener('pointerup',stop);ctl.addEventListener('pointercancel',stop);ctl.addEventListener('keydown',e=>{const a=$('#globalPlayerAudio');if(!a)return;let v=a.volume;if(e.key==='ArrowLeft'||e.key==='ArrowDown')v-=.05;else if(e.key==='ArrowRight'||e.key==='ArrowUp')v+=.05;else if(e.key==='Home')v=0;else if(e.key==='End')v=1;else return;e.preventDefault();a.volume=Math.max(0,Math.min(1,v));playerActivated=true;savePlayerState();syncPlayerUI()})}
function stopPlayerWaveVisualizer(){if(playerWaveRaf)cancelAnimationFrame(playerWaveRaf);playerWaveRaf=0}
function paintFallbackWaveFrame(bars,t){bars.forEach((bar,i)=>{const pulse=.18+.82*Math.abs(Math.sin(t*(2.2+(i%7)*.11)+i*.73)*Math.cos(t*.67+i*.21));bar.style.transform=`scaleY(${pulse.toFixed(3)})`;bar.style.opacity=String(.44+pulse*.56)})}
function paintFallbackPlayerWave(){const wave=$('#playerWave'),a=$('#globalPlayerAudio');if(!wave||!a)return;const bars=$$('i',wave),t=Number(a.currentTime)||0;paintFallbackWaveFrame(bars,t);if(!a.paused&&routeName()==='player')playerWaveRaf=requestAnimationFrame(paintFallbackPlayerWave)}
function startPlayerWaveVisualizer(){stopPlayerWaveVisualizer();const a=$('#globalPlayerAudio'),wave=$('#playerWave');if(!a||!wave||a.paused)return;const bars=$$('i',wave);if(!bars.length)return;const tryCapture=()=>{try{const capture=a.captureStream?.()||a.mozCaptureStream?.();if(!capture)return false;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;if(!playerWaveCtx)playerWaveCtx=new AC();if(playerWaveCtx.state==='suspended')playerWaveCtx.resume().catch(()=>{});if(!playerWaveAnalyser){playerWaveAnalyser=playerWaveCtx.createAnalyser();playerWaveAnalyser.fftSize=128;playerWaveAnalyser.smoothingTimeConstant=.72;playerWaveSource=playerWaveCtx.createMediaStreamSource(capture);playerWaveSource.connect(playerWaveAnalyser);playerWaveData=new Uint8Array(playerWaveAnalyser.frequencyBinCount)}const draw=()=>{if(!playerWaveAnalyser||a.paused||routeName()!=='player'){stopPlayerWaveVisualizer();return}playerWaveAnalyser.getByteFrequencyData(playerWaveData);let energy=0;for(let i=0;i<playerWaveData.length;i++)energy+=playerWaveData[i];if(energy<playerWaveData.length*1.5){paintFallbackWaveFrame(bars,Number(a.currentTime)||0)}else{const n=bars.length,max=Math.max(1,playerWaveData.length-1);bars.forEach((bar,i)=>{const pos=Math.round((i/(Math.max(1,n-1)))*max),v=(playerWaveData[pos]||0)/255,scale=.16+v*1.1;bar.style.transform=`scaleY(${scale.toFixed(3)})`;bar.style.opacity=String(.42+v*.58)})}playerWaveRaf=requestAnimationFrame(draw)};draw();return true}catch{return false}};if(!tryCapture())paintFallbackPlayerWave()}
function startPlayerArtworkForCurrent(){clearTimeout(playerArtworkTimer);playerArtworkTimer=0;stopPlayerArtworkMotion();const box=$('#playerArtwork'),track=playerTracks[playerIndex];if(!box||!track)return;const images=playerTrackImages(track),key=String(track.file||'');playerArtworkTrack=key;playerArtworkIndex=0;if(!images.length){box.innerHTML='';box.classList.add('empty');return}const timing=playerArtworkTiming(track,images.length);box.classList.remove('empty');box.innerHTML=images.map((src,i)=>`<div class="ds435-player-artwork-slide ${i===0?'active artwork-initial':''}"><img class="motion-run motion-v${i%4}" src="${escAttr(src)}" alt="" referrerpolicy="no-referrer"></div>`).join('')+'<span class="ds435-player-artwork-signal" aria-hidden="true"></span>';$$('.ds435-player-artwork-slide img',box).forEach(playerArtworkFit);activatePlayerArtwork(0,true,timing);if(images.length>1){const rotate=()=>{if(routeName()!=='player'||playerArtworkTrack!==String(playerTracks[playerIndex]?.file||'')){playerArtworkTimer=0;return}activatePlayerArtwork(playerArtworkIndex+1,false,timing);playerArtworkTimer=setTimeout(rotate,timing.slotMs)};playerArtworkTimer=setTimeout(rotate,timing.slotMs)}}
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

function initPlayer(){const a=$('#globalPlayerAudio');if(!a)return;const st=playerState();a.volume=Math.max(0,Math.min(1,Number(st.volume??.85)));a.preload='auto';playerShuffle=!!st.shuffle;playerRepeatMode=['off','one','all'].includes(st.repeatMode)?st.repeatMode:'off';playerActivated=false;setupPlayerBackgroundSupport();a.addEventListener('timeupdate',()=>{syncPlayerUI();playerMediaSessionPosition()});a.addEventListener('loadedmetadata',()=>{syncPlayerUI();playerMediaSessionMetadata();playerMediaSessionPosition()});a.addEventListener('play',()=>{stopStormForOtherMedia();playerActivated=true;try{if('mediaSession'in navigator)navigator.mediaSession.playbackState='playing'}catch{}savePlayerState();syncPlayerUI();playerMediaSessionMetadata();updateMiniPlayerVisibility(routeName());if(routeName()==='player')startPlayerWaveVisualizer()});a.addEventListener('pause',()=>{try{if('mediaSession'in navigator)navigator.mediaSession.playbackState='paused'}catch{}savePlayerState();syncPlayerUI();stopPlayerWaveVisualizer()});a.addEventListener('ended',playerHandleEnded);ensurePlayerManifest().then(()=>{if(playerTracks.length)loadPlayerTrack(playerIndex,false);syncPlayerUI();playerMediaSessionMetadata();updateMiniPlayerVisibility(routeName())}).catch(()=>syncPlayerUI())}
function routeName(){return(location.hash||'#/home').replace(/^#\//,'').split('/')[0]||'home'}
function loadPlayerTrack(i,autoplay=false){const a=$('#globalPlayerAudio');if(!a||!playerTracks.length)return;playerIndex=(i+playerTracks.length)%playerTracks.length;const t=playerTracks[playerIndex],changed=a.dataset.track!==String(playerIndex);if(changed){a.dataset.track=String(playerIndex);a.preload='auto';a.src=t.src;if(!autoplay){try{a.load()}catch{}}}savePlayerState();playerMediaSessionMetadata();syncPlayerUI();if(routeName()==='player')startPlayerArtworkForCurrent();if(autoplay){const p=a.play();if(p&&typeof p.catch==='function')p.catch(()=>{});}}
async function playerToggle(){try{await ensurePlayerManifest()}catch{return}const a=$('#globalPlayerAudio');if(!a||!playerTracks.length)return;playerActivated=true;if(!a.src)loadPlayerTrack(playerIndex,false);if(a.paused)a.play().catch(()=>{});else a.pause();updateMiniPlayerVisibility(routeName())}
async function playerStep(dir,autoplay=true){try{await ensurePlayerManifest()}catch{return}if(!playerTracks.length)return;let n;if(playerShuffle&&playerTracks.length>1){do{n=Math.floor(Math.random()*playerTracks.length)}while(n===playerIndex)}else n=(playerIndex+dir+playerTracks.length)%playerTracks.length;playerActivated=true;loadPlayerTrack(n,autoplay)}
function playerHandleEnded(){const a=$('#globalPlayerAudio');if(!a||!playerTracks.length)return;if(playerRepeatMode==='one'){a.currentTime=0;const p=a.play();if(p&&typeof p.catch==='function')p.catch(()=>{});return}if(playerShuffle){playerStep(1,true);return}if(playerIndex<playerTracks.length-1){loadPlayerTrack(playerIndex+1,true);return}if(playerRepeatMode==='all'){loadPlayerTrack(0,true);return}a.currentTime=0;try{if('mediaSession'in navigator)navigator.mediaSession.playbackState='paused'}catch{}syncPlayerUI()}
function setRepeatMode(mode){playerRepeatMode=playerRepeatMode===mode?'off':mode;playerActivated=true;savePlayerState();syncPlayerUI()}
function playerPauseForStoryMedia(){const a=$('#globalPlayerAudio');if(!a)return;playerWasPlayingBeforeMedia=!a.paused&&!!a.src;if(playerWasPlayingBeforeMedia){a.pause();toast('Player pausado por el contenido de la Story')}}
function bindStoryMediaPause(){$$('#reader audio,#reader video').forEach(m=>m.addEventListener('play',playerPauseForStoryMedia))}
function fmtPlayer(sec){if(!Number.isFinite(sec))return'0:00';const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),ss=Math.floor(sec%60);return h?`${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`:`${m}:${String(ss).padStart(2,'0')}`}
function playlistSignature(){return playerTracks.map(t=>t.file).join('|')}
async function ensurePlaylistTotalDuration(){if(!playerTracks.length)return 0;const saved=Array.isArray(playerCatalogData?.tracks)?playerCatalogData.tracks:[],byFile=new Map(saved.map(x=>[String(x.file||''),Number(x.durationSeconds)||0])),durations=playerTracks.map(t=>byFile.get(t.file)||0);if(durations.some(x=>x<=0)||durations.length!==playerTracks.length)return 0;return durations.reduce((a,b)=>a+b,0)}
function syncPlayerUI(){const a=$('#globalPlayerAudio'),t=playerTracks[playerIndex];if(!a)return;const p=a.duration>0?a.currentTime/a.duration:0,name=t?.name||'—';const miniTrack=$('#miniPlayerTrack'),miniProg=$('#miniPlayerProgress'),miniPlay=$('#miniPlay');if(miniTrack)miniTrack.textContent=name;if(miniProg)miniProg.style.width=pct(p);if(miniPlay)miniPlay.textContent=a.paused?'▶':'❚❚';const fullTrack=$('#playerNowTrack'),fullTime=$('#playerTime'),fullProg=$('#playerProgressFill'),fullPlay=$('#playerPlay'),fullShuffle=$('#playerShuffle'),fullRepeatOne=$('#playerRepeatOne'),fullRepeatAll=$('#playerRepeatAll'),volCtl=$('#playerVolumeControl');if(fullTrack)fullTrack.textContent=name;if(fullTime)fullTime.textContent=`${fmtPlayer(a.currentTime)} / ${fmtPlayer(a.duration)}`;if(fullProg)fullProg.style.width=pct(p);const progressCtl=$('#playerProgress');if(progressCtl){progressCtl.setAttribute('aria-valuenow',String(Math.round(p*100)));progressCtl.setAttribute('aria-valuetext',`${Math.round(p*100)}%`)};if(fullPlay){fullPlay.textContent=a.paused?'▶':'❚❚';fullPlay.classList.toggle('is-play',a.paused);fullPlay.classList.toggle('is-pause',!a.paused);}if(fullShuffle)fullShuffle.classList.toggle('active',playerShuffle);if(fullRepeatOne)fullRepeatOne.classList.toggle('active',playerRepeatMode==='one');if(fullRepeatAll)fullRepeatAll.classList.toggle('active',playerRepeatMode==='all');if(volCtl){volCtl.style.setProperty('--volume-pct',`${Math.round(a.volume*100)}%`);volCtl.setAttribute('aria-valuenow',String(Math.round(a.volume*100)));volCtl.setAttribute('aria-valuetext',`${Math.round(a.volume*100)}%`)}const wave=$('#playerWave');if(wave){const shouldAnimate=!a.paused&&!!a.src;wave.classList.toggle('playing',shouldAnimate);if(shouldAnimate&&routeName()==='player'&&!playerWaveRaf)requestAnimationFrame(()=>{if(!playerWaveRaf&&!a.paused&&routeName()==='player')startPlayerWaveVisualizer()})}$$('[data-player-track]').forEach(el=>el.classList.toggle('active',Number(el.dataset.playerTrack)===playerIndex))}
function updateMiniPlayerVisibility(route=routeName()){const mini=$('#miniPlayer');if(!mini)return;const show=playerActivated&&route!=='player';mini.classList.toggle('hidden',!show);document.body.classList.toggle('player-mini-visible',show)}
function playerSavedDuration(file){const row=(playerCatalogData?.tracks||[]).find(x=>String(x.file||'')===String(file||''));return Number(row?.durationSeconds)||0}
async function renderPlayer(){currentStory=null;scrollTo({top:0,behavior:'auto'});view.innerHTML='<section class="section player-section"><div class="player-title-row"><div><div class="eyebrow">Música del proyecto</div><h1>PLAYER</h1></div><div class="player-summary"><div class="player-summary-row"><span>PISTAS</span><strong>—</strong></div><div class="player-summary-row"><small>TOTAL</small><b>—</b></div></div></div><div class="player-loading">Cargando playlist…</div></section>';try{await ensurePlayerManifest()}catch(e){view.innerHTML=`<section class="section player-section"><h1>PLAYER</h1><div class="empty">No se pudo cargar la playlist.<br>${escapeHtml(e.message)}</div></section>`;return}const a=$('#globalPlayerAudio'),t=playerTracks[playerIndex];const waveBars=Array.from({length:46},(_,i)=>`<i style="--wave-i:${i}"></i>`).join('');const playlistHtml=playerTracks.map((x,i)=>`<button class="player-track ${i===playerIndex?'active':''}" data-player-track="${i}"><span>${String(i+1).padStart(2,'0')}</span><strong>${escapeHtml(x.name)}</strong><em>${playerSavedDuration(x.file)?fmtPlayer(playerSavedDuration(x.file)):'—'}</em></button>`).join('');view.innerHTML=`<section class="section player-section"><div class="player-title-row"><div><div class="eyebrow">Música del proyecto</div><h1>PLAYER</h1></div><div class="player-summary"><div class="player-summary-row"><span>PISTAS</span><strong>${playerTracks.length}</strong></div><div class="player-summary-row"><small>TOTAL</small><b id="playerTotalDuration">…</b></div></div></div><div id="playerConsoleHost" class="ds435-player-host"><div id="playerConsole" class="ds435-player-console"><div id="playerArtwork" class="ds435-player-artwork" aria-hidden="true"></div><div class="ds435-player-head"><span>NOW PLAYING</span><strong id="playerNowTrack">${escapeHtml(t?.name||'—')}</strong></div><button id="playerFullscreenBtn" class="ds435-player-fullscreen-btn" type="button"><span aria-hidden="true">⛶</span> VER A PANTALLA COMPLETA</button><div class="ds435-player-progress-meta"><div class="ds435-player-time-box"><div class="ds435-player-time" id="playerTime">${fmtPlayer(a.currentTime)} / ${fmtPlayer(a.duration)}</div></div><div id="playerWave" class="ds435-player-wave" aria-hidden="true">${waveBars}</div></div><div class="ds435-player-progress" id="playerProgress" role="slider" tabindex="0" aria-label="Progreso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="playerProgressFill"></span></div><div class="ds435-player-controls-main"><button id="playerPrev" aria-label="Anterior"><svg class="ds435-player-skip-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg></button><button id="playerPlay" class="ds435-player-main-play ${a.paused?'is-play':'is-pause'}" aria-label="Play/Pause">${a.paused?'▶':'❚❚'}</button><button id="playerNext" aria-label="Siguiente"><svg class="ds435-player-skip-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5.5 6.5 6.5-6.5 6.5"/></svg></button></div><div class="ds435-player-mode-controls"><button id="playerRepeatOne" class="ds435-player-mode ${playerRepeatMode==='one'?'active':''}" type="button"><span class="ds435-player-mode-icon" aria-hidden="true">↻</span><span>1</span></button><button id="playerRepeatAll" class="ds435-player-mode ${playerRepeatMode==='all'?'active':''}" type="button"><span class="ds435-player-mode-icon" aria-hidden="true">↻</span><span>TODOS</span></button><button id="playerShuffle" class="ds435-player-mode ${playerShuffle?'active':''}" type="button"><span class="ds435-player-mode-icon" aria-hidden="true">⤨</span><span>RANDOM</span></button></div><div class="ds435-player-volume"><div class="ds435-player-volume-label">VOL</div><div id="playerVolumeControl" class="ds435-player-volume-control" style="--volume-pct:${Math.round(a.volume*100)}%" role="slider" tabindex="0" aria-label="Volumen" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(a.volume*100)}"><div class="ds435-player-volume-thumb" aria-hidden="true"></div></div></div><p class="ds435-player-volume-note">En algunos dispositivos esta barra de control de volumen puede no funcionar</p></div></div>${spotifyCompanionHtml()}<button id="playerPlaylistToggle" class="player-playlist-toggle" type="button" aria-expanded="false"><span class="player-playlist-mark" aria-hidden="true"><svg class="player-playlist-icon" viewBox="0 0 24 24"><circle cx="5" cy="7" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="5" cy="17" r="1.2"/><path d="M9 7h10M9 12h10M9 17h10"/></svg></span><span><strong>PLAYLIST</strong><small>Pulsa aquí para abrir</small></span><b class="player-playlist-chevron" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></b></button><div id="playerPlaylistPanel" class="player-playlist-panel hidden"><div class="player-list">${playlistHtml}</div><p class="player-note">La música continúa al navegar por la app. Si reproduces un audio o vídeo dentro de una Story, Player se pausa.</p></div></section>`;$('#playerFullscreenBtn').onclick=openPlayerFullscreen;$('#playerPrev').onclick=()=>playerStep(-1,true);$('#playerPlay').onclick=()=>playerToggle();$('#playerNext').onclick=()=>playerStep(1,true);$('#playerRepeatOne').onclick=()=>setRepeatMode('one');$('#playerRepeatAll').onclick=()=>setRepeatMode('all');$('#playerShuffle').onclick=()=>{playerShuffle=!playerShuffle;playerActivated=true;savePlayerState();syncPlayerUI()};bindPlayerVolumeControl();bindPlayerProgressControl();$$('[data-player-track]').forEach(b=>b.onclick=()=>{playerActivated=true;loadPlayerTrack(Number(b.dataset.playerTrack),true)});const toggle=$('#playerPlaylistToggle'),panel=$('#playerPlaylistPanel');if(toggle&&panel)toggle.onclick=()=>{const opening=panel.classList.contains('hidden');panel.classList.toggle('hidden',!opening);toggle.setAttribute('aria-expanded',String(opening));toggle.classList.toggle('open',opening);const small=toggle.querySelector('small');if(small)small.textContent=opening?'Pulsa aquí para cerrar':'Pulsa aquí para abrir'};syncPlayerUI();cleanupPlayerVolumeArtifacts();startPlayerArtworkForCurrent();if(!a.paused)startPlayerWaveVisualizer();updateMiniPlayerVisibility('player');ensurePlaylistTotalDuration().then(total=>{const el=$('#playerTotalDuration');if(el)el.textContent=total>0?fmtPlayer(total):'PENDIENTE'}).catch(()=>{})}
async function renderStory(id,resume=false,requestedTab=''){resumeOnOpen=!!resume;storyInitialOpen=true;scrollTo({top:0,behavior:'auto'});const meta=indexData.stories.find(s=>s.id===id);if(suppressNewClearOnceId===id)suppressNewClearOnceId='';else markStoryOpened(id);if(!meta){view.innerHTML='<div class="empty">Story no encontrada.</div>';return}currentStory={...meta};currentTab=requestedTab||'read';if(isLocked(meta)){drawStory();return}showLoading();try{const data=await loadStoryData(meta);currentStory={...meta,...data};if(currentStory.cover){const c=coverCache();c[id]=currentStory.cover;store.set(coverCacheKey,c)}drawStory()}catch(e){if(meta.access==='exclusive'){const m=secretMap();delete m[id];store.set(unlockSecretsKey,m);currentStory={...meta};drawStory('No se pudo validar el desbloqueo guardado. Escanea de nuevo el QR de esta Story.')}else view.innerHTML=`<div class="empty"><h2>Error cargando Story ${escapeHtml(id)}</h2><p>${escapeHtml(e.message)}</p></div>`}}
async function loadStoryData(meta,secretOverride=''){const r=await fetch(meta.data,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const obj=await r.json();if(obj?.protected){const secret=secretOverride||secretMap()[meta.id];if(!secret)throw new Error('Story bloqueada');return decryptStory(obj,secret)}return obj}
function storyManualReadButtonHtml(s,read=false){return `<div class="story-manual-read-row"><button id="manualMarkUnread" class="story-manual-read-btn story-manual-unread-btn ${read?'':'hidden'}" type="button">MARCAR COMO NO LEÍDA</button><button id="manualMarkRead" class="story-manual-read-btn ${read?'is-read':''}" type="button" ${read?'disabled':''}>${read?'✓ LEÍDA':'MARCAR COMO LEÍDA'}</button></div>`}
function bindManualReadButton(id){const readBtn=$('#manualMarkRead'),unreadBtn=$('#manualMarkUnread');if(readBtn)readBtn.onclick=()=>{if(markRead(id)){readBtn.textContent='✓ LEÍDA';readBtn.classList.add('is-read');readBtn.disabled=true;unreadBtn?.classList.remove('hidden')}};if(unreadBtn)unreadBtn.onclick=()=>{if(markUnread(id)){readBtn.textContent='MARCAR COMO LEÍDA';readBtn.classList.remove('is-read');readBtn.disabled=false;unreadBtn.classList.add('hidden')}}}
function drawStory(lockMessage=''){const s=currentStory,locked=isLocked(s),tabs=Object.entries(s.tabs||{}).filter(([,v])=>v&&Array.isArray(v.blocks));if(!locked&&!tabs.some(([k])=>k===currentTab)){const target=Object.entries(s.tabs||{}).find(([k,v])=>normalizedText(`${k} ${v?.label||''}`).includes(normalizedText(currentTab)));currentTab=target?.[0]||(tabs.some(([k])=>k==='read')?'read':tabs[0]?.[0]||'read')}const read=isRead(s.id);if(locked){view.innerHTML=`<section class="story-header locked-story-header"><div class="story-header-content"><div class="story-number">STORY ${escapeHtml(s.id)}</div><h1>${escapeHtml(s.title)}</h1><div class="meta-row"><span class="pill">${formatDate(s.published)}</span><span class="pill red">EXCLUSIVA</span></div>${sagaStoryLink(s)}</div></section>${renderLocked(s,lockMessage)}${gamesForStoryHtml(s)}${microRelationsForStoryHtml(s)}`;bindBrokenImages();bindSagaStoryLinks();bindRelatedGameLinks();bindRelatedMicroLinks();bindInlineUnlock(s.id);return}view.innerHTML=`<section class="story-header"><div class="story-header-content"><div class="story-number">STORY ${escapeHtml(s.id)}</div><h1>${escapeHtml(s.title)}</h1><div class="meta-row"><span class="pill">${formatDate(s.published)}</span>${s.access==='exclusive'?'<span class="pill red">EXCLUSIVA</span>':'<span class="pill">GRATIS</span>'}<span id="readStatusPill" class="pill read-pill ${read?'':'hidden'}">✓ LEÍDA</span></div>${sagaStoryLink(s)}</div>${storyManualReadButtonHtml(s,read)}${storyFeaturedMedia(s,false)}</section><div class="tabs">${tabs.map(([k,v])=>`<button class="tab ${k===currentTab?'active':''}" data-tab="${escAttr(k)}">${escapeHtml(v.label||k)}</button>`).join('')}</div><div class="progress-wrap"><div id="readProgress" class="progress"></div></div><article id="reader" class="reader"></article>${gamesForStoryHtml(s)}${microRelationsForStoryHtml(s)}`;bindBrokenImages();bindSagaStoryLinks();bindRelatedGameLinks();bindRelatedMicroLinks();bindManualReadButton(s.id);$$('.tab').forEach(b=>b.onclick=()=>{currentTab=b.dataset.tab;drawTab()});drawTab()}
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
function lockedHeroMedia(s){const teaser=lockedTeaserHtml(s,true);if(teaser)return teaser;const poster=displayCover(s);return poster?`<section class="locked-hero-teaser locked-poster-fallback"><img class="locked-teaser-poster" src="${escAttr(poster)}" alt="Póster Story ${escAttr(s.id)}" loading="eager" referrerpolicy="no-referrer"></section>`:`<section class="locked-hero-teaser locked-poster-fallback locked-poster-empty"></section>`}
function renderLocked(s,msg=''){const book=String(Number(s.book)||s.book||'—');return `<section class="locked-story-page"><div class="locked-main-lock" aria-label="Story bloqueada">${lockSvg(false)}</div>${lockedHeroMedia(s)}${msg?`<p class="locked-error-note">${escapeHtml(msg)}</p>`:''}<section class="unlock-panel locked-inline-unlock"><div class="scanner-instruction story-specific"><strong>SÓLO EN EL LIBRO ${escapeHtml(book)}</strong><p>Esta Story requiere el QR que aparece junto a este relato en el libro físico. Escanéalo para desbloquearla.</p></div>${qrScanControlsHtml()}</section></section>`}
function bindInlineUnlock(prefill){bindQrControls(prefill)}
function drawTab(){destroyStoryYoutubePlayers();const tab=currentStory.tabs?.[currentTab];if(!tab)return;$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===currentTab));const mediaOnly=isVideoOnlyTab(currentTab,tab),isTeaser=/teaser|trailer/i.test(`${currentTab} ${tab?.label||''}`);let blocks=mediaOnly?(tab.blocks||[]).filter(b=>b.type==='iframe'||b.type==='video'):[...(tab.blocks||[])];if(currentTab==='read'&&currentStory.featuredImage)blocks=blocks.filter(b=>!(b.type==='image'&&b.src===currentStory.featuredImage));const reader=$('#reader');reader.classList.toggle('teaser-reader',isTeaser);reader.innerHTML=blocks.length?blocks.map(renderBlock).join(''):'<div class="empty">Esta sección no contiene material.</div>';bindReaderMedia();const topBtn=$('#toTopHeaderBtn');if(topBtn)topBtn.classList.remove('hidden');const progress=$('.progress-wrap');if(progress)progress.classList.toggle('hidden',currentTab!=='read');const header=$('.story-header');if(currentTab==='read'&&resumeOnOpen){resumeOnOpen=false;storyInitialOpen=false;requestAnimationFrame(()=>restoreReadPosition(currentStory.id));}else if(currentTab==='read'&&storyInitialOpen){storyInitialOpen=false;requestAnimationFrame(()=>scrollTo({top:0,behavior:'auto'}));}else if(header)scrollTo({top:Math.max(0,header.offsetHeight-20),behavior:'smooth'});requestAnimationFrame(updateProgress)}
function isVideoOnlyTab(key,tab){const label=`${key} ${tab?.label||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return /(^|\s|[-_/])(audio|video|corto|escuchar|listen)(\s|$|[-_/])/.test(label)}
function currentStoryMediaLocale(mediaType){const c=currentMediaPlaybackLocale||{};return String(c.storyId)===String(currentStory?.id)&&String(c.type)===String(mediaType)&&['es','en','ca'].includes(c.locale)?c.locale:'es'}
function youtubeMediaId(src=''){try{const u=new URL(String(src||''),location.href),h=u.hostname.toLowerCase();if(h.includes('youtu.be'))return u.pathname.split('/').filter(Boolean)[0]||'';if(h.includes('youtube.com')){if(u.pathname.startsWith('/embed/'))return u.pathname.split('/')[2]||'';if(u.pathname.startsWith('/shorts/'))return u.pathname.split('/')[2]||'';if(u.pathname.startsWith('/live/'))return u.pathname.split('/')[2]||'';return u.searchParams.get('v')||''}}catch{}return''}
function mediaEntryId(entry){if(!entry)return'';if(typeof entry==='object'&&entry.videoId)return String(entry.videoId);return youtubeMediaId(typeof entry==='string'?entry:(entry.url||entry.src||''))}
function youtubeStoryEmbedUrl(src=''){
  const id=youtubeMediaId(src);if(!id)return src;
  const base=youtubeEmbedUrl(src);try{const u=new URL(base,location.href);u.searchParams.set('enablejsapi','1');u.searchParams.set('playsinline','1');if(/^https?:$/.test(location.protocol)&&location.origin&&location.origin!=='null')u.searchParams.set('origin',location.origin);return u.href}catch{return base}
}
function storyMediaIdentityForSource(mediaType,src='',fallbackLocale='es'){
  const mediaId=youtubeMediaId(src),fallback=['es','en','ca'].includes(fallbackLocale)?fallbackLocale:'es',meta=currentStory||{};
  if(mediaId){
    const tag=(Array.isArray(meta?.mediaAssetTags)?meta.mediaAssetTags:[]).find(t=>String(t?.mediaId||'')===mediaId&&['audio','video','teaser','other'].includes(String(t?.kind||'')));
    if(tag){const kind=String(tag.kind||'');return{type:['audio','video'].includes(kind)?kind:'',locale:['es','en','ca'].includes(String(tag.locale||''))?String(tag.locale):fallback,mediaId}}
  }
  const type=['audio','video'].includes(mediaType)?mediaType:'';if(!type)return{type:'',locale:fallback,mediaId};
  if(!mediaId)return{type,locale:fallback,mediaId:''};
  const sets={es:Array.isArray(meta?.mediaYoutube?.[type])?meta.mediaYoutube[type]:[],en:Array.isArray(meta?.mediaYoutubeLocales?.[type]?.en)?meta.mediaYoutubeLocales[type].en:[],ca:Array.isArray(meta?.mediaYoutubeLocales?.[type]?.ca)?meta.mediaYoutubeLocales[type].ca:[]},order=[fallback,...['es','en','ca'].filter(x=>x!==fallback)];
  for(const locale of order)if((sets[locale]||[]).some(x=>mediaEntryId(x)===mediaId))return{type,locale,mediaId};
  return{type,locale:fallback,mediaId}
}
function destroyStoryYoutubePlayers(){for(const player of storyYoutubePlayers.splice(0)){try{player.destroy?.()}catch{}}}
function ensureYoutubeIframeApi(){
  if(window.YT?.Player)return Promise.resolve(window.YT);if(youtubeIframeApiPromise)return youtubeIframeApiPromise;
  youtubeIframeApiPromise=new Promise((resolve,reject)=>{
    let settled=false;const finish=()=>{if(settled)return;settled=true;window.YT?.Player?resolve(window.YT):reject(new Error('YouTube IFrame API no disponible'))};
    const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{try{if(typeof previous==='function')previous()}catch{}finish()};
    if(!document.querySelector('script[data-ds-youtube-api]')){const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;script.dataset.dsYoutubeApi='1';script.onerror=()=>{if(!settled){settled=true;reject(new Error('No se pudo cargar YouTube IFrame API'))}};document.head.append(script)}
    const wait=setInterval(()=>{if(window.YT?.Player){clearInterval(wait);finish()}},120);setTimeout(()=>{clearInterval(wait);finish()},9000)
  }).catch(e=>{youtubeIframeApiPromise=null;throw e});return youtubeIframeApiPromise
}
function bindYoutubeStoryTracking(iframes,mediaType,fallbackLocale){
  const rows=iframes.map(frame=>({frame,identity:storyMediaIdentityForSource(mediaType,frame.src||frame.getAttribute('src')||'',fallbackLocale)})).filter(x=>x.identity.mediaId&&x.identity.type);
  if(!rows.length)return;
  ensureYoutubeIframeApi().then(()=>{for(const row of rows){if(!row.frame.isConnected)continue;try{const player=new YT.Player(row.frame,{events:{onStateChange:event=>{if(event.data!==YT.PlayerState.PLAYING)return;stopStormForOtherMedia();playerPauseForStoryMedia();const x=row.identity;markStoryMediaConsumed(x.type,currentStory?.id,x.locale,x.mediaId)}}});storyYoutubePlayers.push(player)}catch(e){console.warn('YouTube story tracking',e)}}}).catch(e=>console.warn('YouTube tracking unavailable',e))
}
function storyBlockRelationLinksHtml(b){const links=[];if(b?.sagaId&&sagaById(b.sagaId))links.push(`<button type="button" data-story-media-saga="${escAttr(b.sagaId)}">SAGA RELACIONADA</button>`);if(b?.gameId&&gameById(b.gameId))links.push(`<button type="button" data-story-media-game="${escAttr(b.gameId)}">GAME RELACIONADO</button>`);if(b?.microId&&microMeta(b.microId))links.push(`<button type="button" data-story-media-micro="${escAttr(String(b.microId).padStart(3,'0'))}">MICRO RELACIONADA</button>`);return links.length?`<div class="story-block-relations">${links.join('')}</div>`:''}
function bindStoryBlockRelations(){$$('[data-story-media-saga]').forEach(b=>b.onclick=()=>go(`saga/${encodeURIComponent(b.dataset.storyMediaSaga)}`));$$('[data-story-media-game]').forEach(b=>b.onclick=()=>go(`game/${encodeURIComponent(b.dataset.storyMediaGame)}`));$$('[data-story-media-micro]').forEach(b=>b.onclick=()=>go(`micro/${encodeURIComponent(b.dataset.storyMediaMicro)}`))}
function renderBlock(b){if(b.type==='p')return `<p>${escapeHtml(b.text)}</p>`;if(b.type==='image_link'||b.type==='image')return `<figure class="reader-image${b.type==='image_link'?' linked':''}"><img src="${escAttr(b.src)}" alt="${escAttr(b.alt||'')}" loading="lazy" decoding="async" referrerpolicy="no-referrer">${b.caption?`<figcaption>${escapeHtml(b.caption)}</figcaption>`:''}</figure>${storyBlockRelationLinksHtml(b)}`;if(b.type==='iframe'){const src=youtubeStoryEmbedUrl(b.src);return `<div class="reader-media"><iframe src="${escAttr(src)}" title="${escAttr(b.title||'Contenido multimedia')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>${storyBlockRelationLinksHtml(b)}`}if(b.type==='video')return `<div class="reader-media"><video controls playsinline preload="metadata" src="${escAttr(b.src)}"></video></div>${storyBlockRelationLinksHtml(b)}`;if(b.type==='audio')return `<div class="reader-media"><audio controls preload="metadata" src="${escAttr(b.src)}"></audio></div>${storyBlockRelationLinksHtml(b)}`;if(b.type==='note')return `<p class="note">${escapeHtml(b.text)}</p>`;if(b.type==='heading')return `<h2>${escapeHtml(b.text)}</h2>`;if(b.type==='quote')return `<blockquote>${escapeHtml(b.text)}</blockquote>`;if(b.type==='link')return `<p><a href="${escAttr(b.href)}" target="_blank" rel="noopener">${escapeHtml(b.text||'Abrir contenido')} ↗</a></p>`;return ''}
function bindReaderMedia(){
  bindBrokenImages();destroyStoryYoutubePlayers();bindStoryBlockRelations();
  const mediaType=storyMediaTypeFromCurrentTab(),fallbackLocale=mediaType?currentStoryMediaLocale(mediaType):'es';
  $$('#reader audio,#reader video').forEach(m=>{const identity=storyMediaIdentityForSource(mediaType,m.currentSrc||m.src||m.getAttribute('src')||'',fallbackLocale);m.addEventListener('play',()=>{playerPauseForStoryMedia();if(identity.type)markStoryMediaConsumed(identity.type,currentStory?.id,identity.locale,identity.mediaId)},{once:true})});
  const ytFrames=$$('#reader .reader-media iframe').filter(frame=>!!youtubeMediaId(frame.src||frame.getAttribute('src')||''));bindYoutubeStoryTracking(ytFrames,mediaType,fallbackLocale)
}
function bindBrokenImages(){$$('img').forEach(img=>{if(img.dataset.boundError)return;img.dataset.boundError='1';img.addEventListener('error',()=>{const fig=img.closest('.reader-image');if(fig)fig.remove();else img.style.visibility='hidden'},{once:true})})}
function openLightbox(src,alt=''){const box=document.createElement('div');box.className='lightbox';box.innerHTML=`<button class="lightbox-close" aria-label="Cerrar">×</button><img src="${escAttr(src)}" alt="${escAttr(alt)}">`;box.onclick=e=>{if(e.target===box||e.target.closest('.lightbox-close'))box.remove()};document.body.append(box)}
function markRead(id){const a=readList();if(a.includes(id))return false;a.push(id);store.set(readKey,a);const m=readingStateMap();m[id]={...(m[id]||{}),progress:1,updated:Date.now()};store.set(readingStateKey,m);const p=readProgressMap();p[id]=1;store.set(readProgressKey,p);const pill=$('#readStatusPill');if(pill)pill.classList.remove('hidden');celebrateRead(id);updateAppBadge();setTimeout(()=>{evaluateAvatarUnlocks();evaluateAchievements(true)},350);queueUserVaultSync();refreshStoryMicroRelations();return true}
function markUnread(id){const a=readList().filter(x=>String(x)!==String(id));if(a.length===readList().length)return false;store.set(readKey,a);const m=readingStateMap();delete m[id];store.set(readingStateKey,m);const p=readProgressMap();delete p[id];store.set(readProgressKey,p);const pill=$('#readStatusPill');if(pill)pill.classList.add('hidden');updateAppBadge();setTimeout(()=>evaluateAchievements(false),80);queueUserVaultSync();if(routeName()==='user')renderUser();refreshStoryMicroRelations();return true}

function persistCurrentReadingPosition(){
  const r=$('#reader');if(!r||!currentStory||currentTab!=='read')return;const rect=r.getBoundingClientRect(),top=scrollY+rect.top,h=Math.max(1,r.offsetHeight-innerHeight*.65),x=Math.max(0,Math.min(1,(scrollY-top+innerHeight*.3)/h)),maxProgress=Math.max(storyProgress(currentStory.id),x);saveReadingState(currentStory.id,maxProgress,x,r);
}
function celebrateRead(id){playUiSound('confirm');const total=indexData?.stories?.length||0,count=publishedReadCount();document.querySelector('.read-celebration')?.remove();const el=document.createElement('div');el.className='read-celebration';el.innerHTML=`<button class="read-celebration-close" type="button" aria-label="Cerrar">×</button><div class="read-check">✓</div><div class="eyebrow">STORY ${escapeHtml(id)}</div><strong>LEÍDA</strong><small>${count} / ${total} Stories publicadas</small>`;document.body.append(el);let timer;const close=()=>{clearTimeout(timer);el.classList.remove('show');setTimeout(()=>el.remove(),260)};el.querySelector('.read-celebration-close').onclick=close;setTimeout(()=>el.classList.add('show'),20);timer=setTimeout(close,3000)}
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
  return `<div class="scan-zone qr-photo-only"><div id="qr-reader" class="qr-reader"><div class="qr-photo-mode"><div class="qr-ios-photo-mark" aria-hidden="true">QR</div><strong>FOTO DEL QR</strong><span>Haz una foto clara y centrada del código</span></div></div><div id="qr-file-reader" class="qr-file-reader" aria-hidden="true"></div><button class="cta" id="photoQr">HACER FOTO DEL QR</button><button class="secondary-btn qr-gallery-btn" id="galleryQr" style="margin-top:8px">ELEGIR FOTO DEL QR</button><input id="qrCameraFile" class="qr-native-input" type="file" accept="image/*" capture="environment"><input id="qrFile" class="qr-native-input" type="file" accept="image/*"><p id="unlockStatus" class="note" style="margin-top:12px"></p></div>`
}
function openQrNativeCamera(){
  const camera=$('#qrCameraFile');if(!camera)return false;
  try{camera.value='';camera.click();return true}catch{return false}
}
function bindQrControls(prefill=''){
  const camera=$('#qrCameraFile'),gallery=$('#qrFile'),photo=$('#photoQr'),galleryBtn=$('#galleryQr');
  if(photo)photo.onclick=()=>{
    unlockStatus('');
    if(!openQrNativeCamera())unlockStatus('No se pudo abrir la cámara. Usa «ELEGIR FOTO DEL QR».')
  };
  if(galleryBtn)galleryBtn.onclick=()=>{if(gallery){gallery.value='';gallery.click()}};
  if(camera)camera.onchange=e=>scanQrPhoto(e.target.files?.[0],prefill,'qrCameraFile','camera');
  if(gallery)gallery.onchange=e=>scanQrPhoto(e.target.files?.[0],prefill,'qrFile','album');
  requestAnimationFrame(()=>unlockStatus(''))
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

function openDrawer(){updateInstallButton();$('#drawer').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');$('#scrim').classList.remove('hidden')}function closeDrawer(){$('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true');$('#scrim').classList.add('hidden')}
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
function timelinePortalSvg(){return animatedFeatureIcon('timeline','portal-custom-svg timeline-portal-svg')}
function gamepadPortalSvg(){return animatedFeatureIcon('game','portal-custom-svg gamepad-portal-svg')}
function featurePortalEnabled(kind){const portals=homeData?.portals&&typeof homeData.portals==='object'?homeData.portals:{};if(kind==='micro')return portals.micro!==false;if(kind==='games')return portals.games===true;return true}
function storiesExplorerHtml(){const microOn=featurePortalEnabled('micro'),gamesOn=featurePortalEnabled('games');return `<section class="stories-portals"><div class="stories-portals-group"><div class="portal-label">EXPLORAR</div><div class="portal-grid"><button class="portal-btn" style="--portal-i:0" data-portal="sagas">${animatedFeatureIcon('saga')}<strong>SAGAS</strong></button><button class="portal-btn" style="--portal-i:1" data-portal="timeline">${timelinePortalSvg()}<strong>TIMELINE</strong></button><button class="portal-btn" style="--portal-i:2" data-portal="random">${animatedFeatureIcon('random')}<strong>RANDOM</strong></button><button class="portal-btn" style="--portal-i:3" data-portal="extras">${animatedFeatureIcon('extras')}<strong>EXTRAS</strong></button></div></div><div class="stories-portals-group multimedia"><div class="portal-label">MULTIMEDIA</div><div class="portal-grid portal-grid-4"><button class="portal-btn cassette" style="--portal-i:4" data-portal="cassettes">${mediaIconSvg('audio')}<strong>CASSETTES</strong></button><button class="portal-btn tape" style="--portal-i:5" data-portal="tapes">${mediaIconSvg('video')}<strong>TAPES</strong></button><button class="portal-btn games ${gamesOn?'':'is-coming'}" style="--portal-i:6" data-portal="games" data-portal-enabled="${gamesOn?'1':'0'}" aria-disabled="${gamesOn?'false':'true'}">${gamepadPortalSvg()}<strong>GAMES</strong>${gamesOn?'':'<small>PRÓXIMAMENTE</small>'}</button><button class="portal-btn nightmares ${microOn?'':'is-coming'}" style="--portal-i:7" data-portal="micro-pesadillas" data-portal-enabled="${microOn?'1':'0'}" aria-disabled="${microOn?'false':'true'}">${animatedFeatureIcon('micro')}<strong>MICRO</strong>${microOn?'':'<small>PRÓXIMAMENTE</small>'}</button></div></div></section>`}
function bindStoryExplorer(){$$('[data-portal]').forEach(b=>b.onclick=()=>{if(b.dataset.portalEnabled==='0')return;go(b.dataset.portal)})}
function bindAllStoriesInteractionFx(){
  const root=$('.stories-section');if(!root||root.dataset.pressFxBound==='1')return;root.dataset.pressFxBound='1';
  const selector='[data-story-id],.portal-btn,.library-stats button,.advanced-toggle,.view-mode';
  const pulse=el=>{if(!el||el.disabled||el.getAttribute('aria-disabled')==='true')return;el.classList.remove('stories-quick-press');void el.offsetWidth;el.classList.add('stories-quick-press');clearTimeout(el._dsStoriesPressTimer);el._dsStoriesPressTimer=setTimeout(()=>el.classList.remove('stories-quick-press'),165)};
  root.addEventListener('pointerdown',e=>pulse(e.target?.closest?.(selector)),{passive:true});
  root.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')pulse(e.target?.closest?.(selector))});
}

function sagaById(id){return (sagasData?.sagas||[]).find(s=>String(s.id)===String(id))||null}
function sagaMembership(storyId){for(const saga of sagasData?.sagas||[]){const i=(saga.parts||[]).findIndex(p=>String(p.storyId||'')===String(storyId));if(i>=0)return{saga,part:i+1}}return null}
function sagaStoryLink(s){const m=sagaMembership(s?.id);return m?`<button class="story-saga-link" type="button" data-saga-link="${escAttr(m.saga.id)}">PERTENECE A: ${escapeHtml(m.saga.name)} · PARTE ${m.part} DE ${Math.max((m.saga.parts||[]).length,Number(m.saga.totalParts)||0)}</button>`:''}
function bindSagaStoryLinks(){$$('[data-saga-link]').forEach(b=>b.onclick=()=>go(`saga/${encodeURIComponent(b.dataset.sagaLink)}`))}

function renderSagas(){currentStory=null;const sagas=[...(sagasData?.sagas||[])].reverse();view.innerHTML=`<section class="section v2-section sagas-section"><div class="section-title sagas-title-with-loop"><div class="sagas-title-copy"><div class="eyebrow">STORIES CONECTADAS</div><h1>Sagas</h1></div><div class="sagas-header-loop" aria-hidden="true"><video autoplay muted loop playsinline preload="metadata" tabindex="-1"><source src="${escAttr(PUBLIC_APP_ASSET_BASE+'sagasloop.webm')}" type="video/webm"></video></div></div><div class="saga-list">${sagas.length?sagas.map(sagaCard).join(''):'<div class="empty">Todavía no hay sagas configuradas.</div>'}</div></section>`;$$('[data-saga-id]').forEach(x=>x.onclick=()=>runCatalogSelectFx(x,()=>go(`saga/${encodeURIComponent(x.dataset.sagaId)}`)));bindBrokenImages();maybeAutoTutorial('sagas')}
function sagaProgressData(saga){const parts=Array.isArray(saga?.parts)?saga.parts:[],total=Math.max(parts.length,Number(saga?.totalParts)||0),publishedStories=parts.map(p=>p.storyId?indexData.stories.find(s=>s.id===String(p.storyId)):null).filter(Boolean),published=publishedStories.length,read=publishedStories.filter(s=>isRead(s.id)).length;return{total,published,read,publishedPct:total?Math.round(published/total*100):0,readPct:total?Math.round(read/total*100):0}}
function sagaProgressBars(d){return `<div class="saga-progress"><i class="saga-progress-published" style="width:${d.publishedPct}%"></i><i class="saga-progress-read" style="width:${d.readPct}%"></i></div>`}
function sagaListBanner(saga){return saga?.listBanner||saga?.bannerList||saga?.bannerListImage||saga?.banner||''}
function sagaHeroBanner(saga){return saga?.detailBanner||saga?.bannerHero||saga?.heroBanner||saga?.banner||sagaListBanner(saga)||''}
function sagaPartFeatureIcons(st){const a=[];if(storyHasFeature(st,'audio'))a.push(`<span class="saga-feature-icon audio" title="Audio">${mediaIconSvg('audio')}</span>`);if(storyHasFeature(st,'video'))a.push(`<span class="saga-feature-icon video" title="Vídeo">${mediaIconSvg('video')}</span>`);if(storyHasFeature(st,'extra'))a.push(`<span class="saga-feature-icon extra" title="Extras">${animatedFeatureIcon('extras')}</span>`);return a.join('')}
function sagaStatusBubble(d){if(d.total>0&&d.read===d.total)return '<span class="saga-status-bubble saga-status-read">LEÍDA</span>';if(d.total>0&&d.published===d.total)return '<span class="saga-status-bubble saga-status-complete">COMPLETA</span>';return ''}
function sagaCard(saga){const d=sagaProgressData(saga),banner=sagaListBanner(saga),fullyRead=d.total>0&&d.published===d.total&&d.read===d.total;return `<button class="saga-card ${fullyRead?'saga-card-read-complete':''}" data-saga-id="${escAttr(saga.id)}">${banner?`<img src="${escAttr(banner)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<div class="saga-banner-placeholder">SAGA</div>'}${sagaStatusBubble(d)}<div class="saga-card-copy"><span>${d.read} ${d.read===1?'LEÍDA':'LEÍDAS'} · ${d.published}/${d.total} PUBLICADAS</span><h2>${escapeHtml(saga.name||'Saga')}</h2>${sagaProgressBars(d)}<strong><em class="read">${d.readPct}% LEÍDA</em> · <em class="published">${d.publishedPct}% PUBLICADA</em></strong></div></button>`}
function renderSaga(id){currentStory=null;const saga=sagaById(id);if(!saga){view.innerHTML='<div class="empty">Saga no encontrada.</div>';return}const d=sagaProgressData(saga),parts=Array.isArray(saga.parts)?saga.parts:[],banner=sagaHeroBanner(saga);view.innerHTML=`<section class="section v2-section saga-detail ${saga.extraImage?'has-page-bg':''}">${saga.extraImage?`<div class="saga-page-bg" aria-hidden="true"><img src="${escAttr(saga.extraImage)}" alt=""></div>`:''}${banner?`<div class="saga-detail-banner"><img src="${escAttr(banner)}" alt="${escAttr(saga.name||'')}"></div>`:''}<div class="saga-detail-content"><div class="saga-detail-bubbles"><span class="saga-info-bubble">SAGA</span><span class="saga-info-bubble">${d.published}/${d.total} PUBLICADAS</span><span class="saga-info-bubble">${d.read} ${d.read===1?'LEÍDA':'LEÍDAS'}</span></div><p class="saga-synopsis">${escapeHtml(saga.synopsis||'')}</p><div class="saga-percent"><div class="saga-percent-line"><span class="saga-read-value">${d.readPct}%</span><span class="saga-percent-label">LEÍDO</span><span class="saga-percent-divider">·</span><span class="saga-published-value">${d.publishedPct}%</span><span class="saga-percent-label">PUBLICADO</span></div>${sagaProgressBars(d)}</div>${saga.extraText?`<p class="saga-extra-text">${escapeHtml(saga.extraText)}</p>`:''}<div class="saga-parts">${parts.map((part,i)=>sagaPartRow(part,i+1,d.total)).join('')}</div></div></section>`;bindSagaPartCards();bindBrokenImages();maybeAutoTutorial('sagas')}
function bindSagaPartCards(){$$('.saga-part.published-part[data-story-id]').forEach(el=>{const open=()=>runCatalogSelectFx(el,()=>storyGo(el.dataset.storyId,false,el));el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}})}
function sagaPartRow(part,n,total){const st=part.storyId?indexData.stories.find(s=>s.id===String(part.storyId)):null;if(!st)return `<div class="saga-part future-part"><strong>PARTE ${n}: PRÓXIMAMENTE</strong></div>`;const cover=displayCover(st),read=isRead(st.id),icons=sagaPartFeatureIcons(st);return `<article class="saga-part published-part ${read?'is-read':''}" data-story-id="${escAttr(st.id)}" role="button" tabindex="0"><span class="saga-part-order">PARTE ${n} DE ${total}</span>${cover?`<div class="saga-part-poster"><img src="${escAttr(cover)}" alt="">${exclusiveBadge(st,'cover')}</div>`:''}<div class="saga-part-copy"><strong>${escapeHtml(st.id)} · ${escapeHtml(st.title||'')}</strong><em>${bookLabel(st.book||'—')}</em>${read?'<b class="saga-read-mark">✓ LEÍDA</b>':''}</div><div class="saga-part-icons">${icons}</div></article>`}

function parseStoryYear(s){const n=Number(String(s?.year??'').replace(',','.'));return Number.isFinite(n)?n:null}
function eraForYear(y){if(y===null)return'FECHA DESCONOCIDA';if(y<-3300)return'PREHISTORIA';if(y<476)return'EDAD ANTIGUA';if(y<1453)return'EDAD MEDIA';if(y<1789)return'EDAD MODERNA';if(y<2100)return'EDAD CONTEMPORÁNEA';if(y<2150)return'NUEVO RENACIMIENTO';if(y<2400)return'NUEVOS AVANCES';return'EDAD ESPACIAL'}
function timelineYearLabel(y){if(y===null)return'—';return y<0?`${Math.abs(y)} a. C.`:`${y}`}
function timelineOrderedStories(desc=false){const groups=new Map();for(const st of (indexData.stories||[]).filter(accessibleStory)){const y=parseStoryYear(st),k=y===null?'unknown':String(y);if(!groups.has(k))groups.set(k,{year:y,stories:[]});groups.get(k).stories.push(st)}for(const g of groups.values()){const manual=(timelineData?.orders||{})[String(g.year)]||[];const pos=new Map(manual.map((id,i)=>[String(id),i]));g.stories.sort((a,b)=>{const pa=pos.has(a.id)?pos.get(a.id):9999,pb=pos.has(b.id)?pos.get(b.id):9999;return pa-pb||new Date(a.published)-new Date(b.published)});if(desc)g.stories.reverse()}return [...groups.values()].sort((a,b)=>{if(a.year===null)return 1;if(b.year===null)return-1;return desc?b.year-a.year:a.year-b.year})}
const timelineEraClasses={'PREHISTORIA':'era-prehistory','EDAD ANTIGUA':'era-ancient','EDAD MEDIA':'era-medieval','EDAD MODERNA':'era-modern','EDAD CONTEMPORÁNEA':'era-contemporary','NUEVO RENACIMIENTO':'era-renaissance','NUEVOS AVANCES':'era-advances','EDAD ESPACIAL':'era-space','FECHA DESCONOCIDA':'era-unknown'};
function renderTimeline(desc=false){
  currentStory=null;const groups=timelineOrderedStories(desc),total=(indexData.stories||[]).length,eras=[];
  for(const g of groups){const era=eraForYear(g.year);let block=eras.find(x=>x.era===era);if(!block){block={era,groups:[]};eras.push(block)}block.groups.push(g)}
  const html=eras.map((block,ei)=>{const eraCount=block.groups.reduce((n,g)=>n+g.stories.length,0);return `<section class="timeline-era-block ${timelineEraClasses[block.era]||'era-unknown'}" data-era-block><button class="timeline-era" type="button" data-era-toggle aria-expanded="true"><span class="timeline-era-name">${escapeHtml(block.era)}</span><span class="timeline-era-right"><em>${eraCount} ${eraCount===1?'STORY':'STORIES'}</em><b>−</b></span></button><div class="timeline-era-body">${block.groups.map(g=>`<div class="timeline-year-group ${g.stories.length>1?'timeline-multi':''}" data-timeline-reveal><div class="timeline-year">${escapeHtml(timelineYearLabel(g.year))}</div><div class="timeline-year-axis" aria-hidden="true"><i></i></div><div class="timeline-items">${g.stories.map(timelineItem).join('')}</div></div>`).join('')}</div></section>`}).join('');
  view.innerHTML=`<section class="section v2-section timeline-section"><div class="section-title timeline-title"><div><div class="eyebrow">TIMELINE</div><h1><span>CRONOLOGÍA GLOBAL</span></h1></div></div><button class="timeline-order" id="timelineOrder">${desc?'↑ FUTURO':'↓ PASADO'}</button><div class="timeline-list">${html||'<div class="empty">No hay Stories disponibles para el Timeline.</div>'}</div></section>`;
  $('#timelineOrder').onclick=()=>renderTimeline(!desc);
  $$('[data-era-toggle]').forEach(btn=>btn.onclick=()=>{const block=btn.closest('[data-era-block]'),body=block?.querySelector('.timeline-era-body'),open=btn.getAttribute('aria-expanded')==='true';btn.setAttribute('aria-expanded',String(!open));btn.querySelector('b').textContent=open?'+':'−';body?.classList.toggle('collapsed',open)});
  bindTimelineReveal();bindTimelineStoryCards();bindBrokenImages();
}
function bindTimelineStoryCards(){$$('[data-timeline-story]').forEach(el=>{const open=()=>storyGo(el.dataset.timelineStory,false,el);el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}})}
function alignTimelineBranches(){
  $$('.timeline-multi .timeline-items').forEach(items=>{
    const rows=[...items.querySelectorAll(':scope > .timeline-item')];if(rows.length<2)return;
    const host=items.getBoundingClientRect(),first=rows[0].getBoundingClientRect(),last=rows[rows.length-1].getBoundingClientRect();
    const top=Math.max(0,first.top-host.top+first.height/2),bottom=Math.max(0,host.bottom-(last.top+last.height/2));
    items.style.setProperty('--timeline-branch-top',`${top}px`);items.style.setProperty('--timeline-branch-bottom',`${bottom}px`)
  })
}
function bindTimelineReveal(){
  const groups=$$('[data-timeline-reveal]');if(!groups.length)return;
  const align=()=>{requestAnimationFrame(()=>{alignTimelineBranches();setTimeout(alignTimelineBranches,120)})};align();
  if(motionReduced()){groups.forEach(g=>g.classList.add('timeline-reveal-in'));return}
  const io=new IntersectionObserver(entries=>{for(const e of entries){if(!e.isIntersecting)continue;e.target.classList.add('timeline-reveal-in');io.unobserve(e.target)}},{rootMargin:'0px 0px -8% 0px',threshold:.08});
  groups.forEach(g=>io.observe(g));
}
function timelineItem(s){const cover=displayCover(s),icons=[],read=isRead(s.id);if(storyHasFeature(s,'audio'))icons.push(`<span class="timeline-icon audio">${mediaIconSvg('audio')}</span>`);if(storyHasFeature(s,'video'))icons.push(`<span class="timeline-icon video">${mediaIconSvg('video')}</span>`);return `<article class="timeline-item ${read?'timeline-read':''}" data-timeline-story="${escAttr(s.id)}" role="button" tabindex="0" aria-label="Abrir Story ${escAttr(s.id)} ${escAttr(s.title||'')}"><span class="timeline-node" aria-hidden="true"></span><div class="timeline-poster">${cover?`<img src="${escAttr(cover)}" alt="Story ${escAttr(s.id)}">`:`<span>${escapeHtml(s.id)}</span>`}${exclusiveBadge(s,'cover')}</div><div class="timeline-copy"><span>STORY ${escapeHtml(s.id)}</span><strong>${escapeHtml(s.title||'')}</strong>${read?'<em>✓ LEÍDA</em>':''}</div><div class="timeline-icons">${icons.join('')}</div></article>`}

function renderRandom(filter='unread'){
  stopRandomSpin(false);currentStory=null;const available=(indexData.stories||[]).filter(accessibleStory);const pool=filter==='read'?available.filter(s=>isRead(s.id)):filter==='all'?available:available.filter(s=>!isRead(s.id));const first=pool[0]||available[0];
  view.innerHTML=`<section class="section v2-section random-section"><div class="random-head"><div class="eyebrow">DEJA QUE DISTURBING STORIES DECIDA POR TI</div><h1>RULETA RANDOM</h1></div><div class="random-filters"><button data-random-filter="all" class="${filter==='all'?'active':''}">TODAS</button><button data-random-filter="unread" class="${filter==='unread'?'active':''}">NO LEÍDAS</button><button data-random-filter="read" class="${filter==='read'?'active':''}">LEÍDAS</button></div><div class="random-stage"><div class="random-energy" aria-hidden="true"><i></i><i></i><i></i><i></i><span></span><b></b></div><div id="randomPosterRoll" class="random-poster-roll">${first?randomPosterOnly(first):'<div class="empty">SIN STORIES</div>'}</div></div><button id="spinRandom" class="cta random-spin-btn" ${pool.length?'':'disabled'}>${randomHasSpun?'VOLVER A GIRAR':'GIRAR'}</button><div id="randomResult" class="random-result-slot"></div></section>`;
  $$('[data-random-filter]').forEach(b=>b.onclick=()=>renderRandom(b.dataset.randomFilter));$('#spinRandom').onclick=()=>randomSpinRunning?stopRandomSpin(true):spinRandom(pool);bindBrokenImages()
}
function randomPosterOnly(s){const cover=displayCover(s);return `<div class="random-roll-card">${cover?`<img src="${escAttr(cover)}" alt="Story ${escAttr(s.id)}">`:`<span>${escapeHtml(s.id)}</span>`}<b>STORY ${escapeHtml(s.id)}</b></div>`}
function spinRandom(pool){
  if(!pool.length||randomSpinRunning)return;randomHasSpun=true;let candidates=pool.filter(s=>s.id!==lastRandomStoryId);if(!candidates.length)candidates=pool;randomSpinPool=pool;randomSpinCurrent=candidates[Math.floor(Math.random()*candidates.length)];const stage=$('#randomPosterRoll'),result=$('#randomResult'),btn=$('#spinRandom');if(!stage||!btn)return;result.innerHTML='';result.classList.remove('reward-in');randomSpinRunning=true;btn.disabled=false;btn.textContent='DETENER';btn.classList.add('stop-mode');stage.classList.add('rolling');document.querySelector('.random-energy')?.classList.add('active');let ticks=0;
  const tick=()=>{if(!randomSpinRunning)return;let options=pool.filter(s=>s.id!==randomSpinCurrent?.id);if(!options.length)options=pool;randomSpinCurrent=options[Math.floor(Math.random()*options.length)];stage.innerHTML=randomPosterOnly(randomSpinCurrent);bindBrokenImages();ticks++;const delay=Math.max(52,92-Math.min(32,ticks));randomSpinTimer=setTimeout(tick,delay);if(ticks>=34)stopRandomSpin(true)};tick()
}
function stopRandomSpin(showResult=true){clearTimeout(randomSpinTimer);randomSpinTimer=0;if(!randomSpinRunning&&!showResult)return;const wasRunning=randomSpinRunning;randomSpinRunning=false;const stage=$('#randomPosterRoll'),btn=$('#spinRandom');if(btn){btn.textContent=randomHasSpun?'VOLVER A GIRAR':'GIRAR';btn.classList.remove('stop-mode');btn.disabled=showResult||!randomSpinPool.length}document.querySelector('.random-energy')?.classList.remove('active');if(!wasRunning||!showResult||!randomSpinCurrent||!stage)return;lastRandomStoryId=randomSpinCurrent.id;stage.innerHTML=randomPosterOnly(randomSpinCurrent);stage.classList.remove('rolling');stage.classList.add('winner');setTimeout(()=>{stage.classList.remove('winner');showRandomResult(randomSpinCurrent);if(btn)btn.disabled=false},120)}
function randomResultHaptic(){try{if('vibrate' in navigator)navigator.vibrate(1000)}catch{}}
function showRandomResult(s){const el=$('#randomResult');if(!el)return;const rt=Number(s?.readTime||0),cover=displayCover(s);el.innerHTML=`<article class="random-result random-result-v25">${cover?`<div class="random-result-poster"><img src="${escAttr(cover)}" alt="Story ${escAttr(s.id)}">${exclusiveBadge(s,'cover')}</div>`:''}<div class="random-result-copy"><div class="eyebrow">RESULTADO</div><h2>${escapeHtml(s.id)} - ${escapeHtml(s.title||'')}</h2><p><span>${escapeHtml(timelineYearLabel(parseStoryYear(s)))}</span>${rt?`<span>${rt} MIN LECTURA</span>`:''}</p></div><div class="random-actions"><button class="cta random-read-tile" id="randomRead"><span>LEER</span><span>STORY</span></button></div></article>`;el.classList.remove('reward-in');void el.offsetWidth;el.classList.add('reward-in');randomResultHaptic();$('#randomRead').onclick=()=>storyGo(s.id,false,el.querySelector('.random-result-poster')||el.querySelector('.random-read-tile'))}

function mediaDuration(s,type,locale='es'){
  if(locale!=='es'){
    const entries=Array.isArray(s?.mediaYoutubeLocales?.[type]?.[locale])?s.mediaYoutubeLocales[type][locale]:[];
    if(entries.length){const secs=entries.map(x=>Number(x?.durationSeconds)||0);if(secs.every(x=>x>0))return secs.reduce((a,b)=>a+b,0)}
    return Math.max(0,Number(s?.mediaDurationLocales?.[type]?.[locale])||0)
  }
  const entries=Array.isArray(s?.mediaYoutube?.[type])?s.mediaYoutube[type]:[];
  if(entries.length){const secs=entries.map(x=>Number(x?.durationSeconds)||0);if(secs.every(x=>x>0))return secs.reduce((a,b)=>a+b,0)}
  if(String(s?.mediaDurationSources?.[type]||'').toLowerCase()==='youtube')return Math.max(0,Number(s?.mediaDurations?.[type])||0);
  return 0
}
function mediaAvailableInLocale(s,type,locale='es'){
  if(locale==='es'){
    const entries=s?.mediaYoutube?.[type],duration=Number(s?.mediaDurations?.[type])||0,source=String(s?.mediaDurationSources?.[type]||'').toLowerCase(),labels=(s?.tabLabels||[]).map(x=>String(x).toLowerCase());
    const tabMatch=type==='audio'?labels.some(x=>/(audio|escuchar|listen)/.test(x)):labels.some(x=>/(video|vídeo|corto|film)/.test(x));
    const direct=type==='audio'?(s?.audio===true||s?.audioUrl||s?.audioSrc):(s?.video===true||s?.videoUrl||s?.videoSrc);
    const hasAlt=Object.values(s?.mediaYoutubeLocales?.[type]||{}).some(a=>Array.isArray(a)&&a.length)||Object.values(s?.mediaDurationLocales?.[type]||{}).some(v=>Number(v)>0)||Object.values(s?.mediaLocaleAvailability?.[type]||{}).some(Boolean);
    return (Array.isArray(entries)&&entries.length>0)||duration>0||source==='youtube'||tabMatch||!!direct||(!hasAlt&&(s?.features||[]).includes(type))
  }
  const entries=s?.mediaYoutubeLocales?.[type]?.[locale],duration=Number(s?.mediaDurationLocales?.[type]?.[locale])||0,source=String(s?.mediaDurationSourceLocales?.[type]?.[locale]||'').toLowerCase(),declared=!!s?.mediaLocaleAvailability?.[type]?.[locale],translatedTitle=String(s?.mediaTitleLocales?.[type]?.[locale]||'').trim();
  // declared permite listar también las exclusivas/bloqueadas configuradas mediante URL oculta,
  // aunque la URL no se publique en stories.json. El título traducido sirve además de compatibilidad
  // con asociaciones ocultas guardadas por v3.5 antes de existir el marcador explícito.
  return declared||!!translatedTitle||(Array.isArray(entries)&&entries.length>0)||duration>0||source==='youtube'
}
function fmtLong(seconds){seconds=Math.max(0,Math.round(Number(seconds)||0));const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),sec=seconds%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${m}:${String(sec).padStart(2,'0')}`}
function fmtTotalDuration(seconds){seconds=Math.max(0,Math.round(Number(seconds)||0));const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),sec=seconds%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`}
function mediaDisplayTitle(s,type,locale='es'){const custom=String(s?.mediaTitleLocales?.[type]?.[locale]||'').trim();return custom||String(s?.title||'')}
function mediaCollectionIcons(s){const a=[];if(storyHasFeature(s,'audio'))a.push(`<span class="media-list-icon audio" title="Audio">${mediaIconSvg('audio')}</span>`);if(storyHasFeature(s,'video'))a.push(`<span class="media-list-icon video" title="Vídeo">${mediaIconSvg('video')}</span>`);if(storyHasFeature(s,'extra'))a.push(`<span class="media-list-icon extra" title="Extras">${animatedFeatureIcon('extras')}</span>`);if(s?.access==='exclusive'){const open=!isLocked(s);a.push(`<span class="media-list-icon lock ${open?'open':'closed'}" title="${open?'Desbloqueada':'Bloqueada'}">${lockSvg(open)}</span>`)}return a.join('')}
function mediaLanguageButtons(type,active){return `<div class="media-language-switch" role="group" aria-label="Idioma"><button type="button" data-media-lang="es" data-media-kind="${type}" class="${active==='es'?'active':''}">CASTELLANO</button><button type="button" data-media-lang="en" data-media-kind="${type}" class="${active==='en'?'active':''}">ENGLISH</button><button type="button" data-media-lang="ca" data-media-kind="${type}" class="${active==='ca'?'active':''}">CATALÀ</button></div>`}
function renderMediaCollection(type){currentStory=null;const isAudio=type==='audio',locale=mediaLocaleState[type]||'es',items=(indexData.stories||[]).filter(s=>mediaAvailableInLocale(s,type,locale)),durations=items.map(s=>mediaDuration(s,type,locale)).filter(x=>x>0),total=durations.reduce((a,b)=>a+b,0);view.innerHTML=`<section class="section v2-section media-collection ${isAudio?'cassettes':'tapes'}"><div class="media-section-head"><div class="media-heading-row"><div class="media-title-no-icon"><div><h1>${isAudio?'CASSETTES':'TAPES'}</h1></div></div>${mediaLanguageButtons(type,locale)}</div><div class="media-summary"><div><span>TOTAL</span><strong>${items.length}</strong><em>${isAudio?'CASSETTES':'TAPES'}</em></div><div><span>DURACIÓN TOTAL</span><strong>${total?fmtTotalDuration(total):'PENDIENTE'}</strong></div></div></div><div class="media-catalog">${items.length?items.map(s=>mediaCollectionItem(s,type,locale)).join(''):'<div class="empty">No hay contenido disponible en este idioma.</div>'}</div></section>`;$$('[data-media-lang]').forEach(btn=>btn.onclick=()=>{mediaLocaleState[type]=btn.dataset.mediaLang;renderMediaCollection(type)});$$('[data-media-story]').forEach(el=>el.onclick=()=>{currentMediaPlaybackLocale={storyId:String(el.dataset.mediaStory||''),type:String(el.dataset.mediaTab||''),locale:String(el.dataset.mediaLocale||locale||'es')};navigateHash(`#/story/${encodeURIComponent(el.dataset.mediaStory)}/${encodeURIComponent(el.dataset.mediaTab)}`)});bindBrokenImages()}
function mediaCollectionItem(s,type,locale='es'){const cover=displayCover(s),d=mediaDuration(s,type,locale),read=isRead(s.id);return `<article class="media-collection-card ${isLocked(s)?'is-locked':''} ${read?'is-read':''}" data-media-story="${escAttr(s.id)}" data-media-tab="${escAttr(type)}" data-media-locale="${escAttr(locale)}">${cover?`<div class="media-collection-poster"><img src="${escAttr(cover)}" alt="">${readCornerBadge(s)}</div>`:''}<div class="media-collection-copy"><span>STORY ${escapeHtml(s.id)}</span><strong>${escapeHtml(mediaDisplayTitle(s,type,locale))}</strong><div class="media-duration-row"><em>${d?fmtLong(d):'DURACIÓN PENDIENTE'}</em>${read?'<b class="media-read-bubble">LEÍDA</b>':''}</div></div><div class="media-collection-icons">${mediaCollectionIcons(s)}</div></article>`}

function renderExtras(){currentStory=null;const items=[...(extrasData?.extras||[])].sort((a,b)=>Number(a.number)-Number(b.number));view.innerHTML=`<section class="section v2-section extras-section"><div class="section-title"><div><div class="eyebrow">DESCUBRE LOS</div><h1>Extras</h1></div></div><div class="extras-grid">${items.length?items.map(extraCard).join(''):'<div class="empty">Todavía no hay Extras configurados.</div>'}</div></section>`;$$('[data-extra-id]').forEach(b=>{const open=()=>runCatalogSelectFx(b,()=>go(`extra/${encodeURIComponent(b.dataset.extraId)}`));b.onclick=open});bindBrokenImages()}
function extraLockBadge(x){const mode=String(x?.availability||x?.access||'').toLowerCase();if(['physical','exclusive','locked','blocked'].includes(mode))return `<span class="ex-badge ex-locked" aria-label="Bloqueado" title="Bloqueado">${lockSvg(false)}</span>`;if(['unlocked','available'].includes(mode))return `<span class="ex-badge ex-unlocked" aria-label="Desbloqueado" title="Desbloqueado">${lockSvg(true)}</span>`;return ''}
function extraCard(x){const badgeText=String(x?.badgeText||'NEW').trim();return `<button class="extra-card poster-only" data-extra-id="${escAttr(x.id||x.number)}">${x.poster?`<img src="${escAttr(x.poster)}" alt="${escAttr(x.title||('Extra '+String(x.number||'')))}">`:'<div class="extra-poster-placeholder">EXTRA</div>'}${x?.badgeVisible&&badgeText?`<span class="extra-custom-badge">${escapeHtml(badgeText)}</span>`:''}${extraLockBadge(x)}</button>`}
function renderExtra(id){currentStory=null;const x=(extrasData?.extras||[]).find(e=>String(e.id||e.number)===String(id));if(!x){view.innerHTML='<div class="empty">Extra no encontrado.</div>';return}const physical=x.availability==='physical';view.innerHTML=`<section class="section v2-section extra-detail"><div class="eyebrow">EXTRA ${String(x.number||'').padStart(2,'0')} · LIBRO ${escapeHtml(x.book||'—')}</div>${x.poster?`<img class="extra-main-poster" src="${escAttr(x.poster)}" alt="${escAttr(x.title||'Extra')}">`:''}${x.text?`<div class="extra-text">${escapeHtml(x.text).replace(/\n/g,'<br>')}</div>`:''}${physical?'<div class="physical-extra-notice"><strong>▣ CONTENIDO EXCLUSIVO DE LA EDICIÓN FÍSICA</strong><p>Este Extra forma parte del libro físico y no tiene versión digital en la app.</p></div>':`${x.image?`<img class="extra-additional-image" src="${escAttr(x.image)}" alt="">`:''}`}${x.link?`<a class="cta extra-destination" href="${escAttr(x.link)}" target="_blank" rel="noopener noreferrer">ABRIR CONTENIDO ›</a>`:''}</section>`;bindBrokenImages()}

function spotifyCompanionHtml(){return `<a class="spotify-companion" href="https://open.spotify.com/playlist/6iBml49G6knFOOAW0wy1dW" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M7.5 9.3c3.3-1 7.2-.65 9.65.75M8.1 12.2c2.7-.75 6-.45 8.35.65M8.7 15c2.2-.55 4.7-.3 6.65.55"/></svg><span><strong>SPOTIFY · DISTURBING COMPANION</strong><small>Audios seleccionados para acompañarte en tus lecturas...</small></span><b>↗</b></a>`}


/* ===== v4.7 · USER / AVATARES / LOGROS / NIVEL / SINCRONIZACIÓN ===== */
function initUserSystem(){
  try{const cfg=window.DS_SUPABASE_CONFIG;if(window.supabase?.createClient&&cfg?.url&&cfg?.publishableKey){supabaseClient=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});supabaseClient.auth.onAuthStateChange((_event,session)=>{registeredUser=session?.user||null;updateUserChrome();if(registeredUser)setTimeout(()=>loadRegisteredProfileAndMerge(),0);else{userProfile=null;updateUserChrome()}});supabaseClient.auth.getSession().then(({data})=>{registeredUser=data?.session?.user||null;updateUserChrome();if(registeredUser)loadRegisteredProfileAndMerge()}).catch(()=>{})}}
  catch(e){console.warn('USER/Supabase',e)}
  ensureFreeAvatars();setTimeout(()=>{evaluateAvatarUnlocks(false);evaluateAchievements(false)},700)
}
function avatarRows(){return Array.isArray(avatarsData?.avatars)?avatarsData.avatars:[]}
function avatarById(id){return avatarRows().find(x=>String(x.id)===String(id))||null}
function avatarDisplayName(a){return String(a?.name||'').trim()}
function avatarFileName(a){const raw=String(a?.file||`${a?.id||'avatar1'}.jpg`).replace(/\\/g,'/');return raw.split('/').pop()||`${a?.id||'avatar1'}.jpg`}
function avatarImageUrl(a){const file=avatarFileName(a),stamp=String(avatarsData?.updated||APP_VERSION);return `${AVATAR_ASSET_BASE}${encodeURIComponent(file)}?v=${encodeURIComponent(stamp)}`}
function ensureFreeAvatars(){const got=new Set(store.get(unlockedAvatarsKey,[]));for(const a of avatarRows())if(a.free)got.add(a.id);store.set(unlockedAvatarsKey,[...got]);if(!store.get(localAvatarKey,'')){const first=avatarRows().find(a=>a.free)||avatarRows()[0];if(first)store.set(localAvatarKey,first.id)}}
function unlockedAvatarIds(){ensureFreeAvatars();return new Set(store.get(unlockedAvatarsKey,[]))}
function selectedAvatarId(){return userProfile?.avatar_id||store.get(localAvatarKey,'avatar1')||'avatar1'}
function avatarAvailable(a){return !!a&&(a.free||unlockedAvatarIds().has(a.id))}
function avatarRequirementMet(a){if(!a||a.free)return true;const r=a.requirement||{};if(r.type==='read_story')return !!r.storyId&&isRead(String(r.storyId));if(r.type==='complete_saga'){const saga=sagaById(r.sagaId);if(!saga)return false;const d=sagaProgressData(saga);return d.total>0&&d.read===d.total}if(r.type==='read_book'){const rows=achievementBookStories(r.book);return rows.length>0&&rows.every(st=>isRead(String(st.id)))}if(r.type==='external')return false;return false}
async function evaluateAvatarUnlocks(showReward=true){ensureFreeAvatars();const got=unlockedAvatarIds(),newOnes=[];for(const a of avatarRows()){if(got.has(a.id)||a.free)continue;if(avatarRequirementMet(a)){got.add(a.id);newOnes.push(a)}}if(!newOnes.length)return;store.set(unlockedAvatarsKey,[...got]);if(showReward){for(const a of newOnes)await showAvatarReward(a)}if(routeName()==='user')renderUser()}
async function unlockAvatarById(id,showReward=true){const a=avatarById(id);if(!a)return false;const got=unlockedAvatarIds();if(got.has(a.id)||a.free)return true;got.add(a.id);store.set(unlockedAvatarsKey,[...got]);queueUserVaultSync();if(showReward)await showAvatarReward(a);if(routeName()==='user')renderUser();return true}
window.DisturbingStoriesUser=window.DisturbingStoriesUser||{};window.DisturbingStoriesUser.unlockAvatarById=unlockAvatarById;
window.addEventListener('disturbing:unlock-avatar',e=>{const id=e?.detail?.id;if(id)unlockAvatarById(String(id),e?.detail?.showReward!==false)});
function avatarImg(a,cls=''){const label=avatarDisplayName(a)||'Avatar';return `<img class="${cls}" src="${escAttr(avatarImageUrl(a))}" alt="${escAttr(label)}" referrerpolicy="no-referrer" onerror="this.classList.add('avatar-missing')">`}
function avatarRequirementText(a){if(a?.free)return'';const r=a?.requirement||{};if(r.type==='read_story'){const st=indexData?.stories?.find(s=>String(s.id)===String(r.storyId));return r.storyId?`LEE LA STORY<br><b>${escapeHtml(st?.title||r.storyId)}</b>`:'REQUISITO<br><b>PENDIENTE</b>'}if(r.type==='complete_saga'){const sg=sagaById(r.sagaId);return r.sagaId?`COMPLETA LA SAGA<br><b>${escapeHtml(sg?.name||r.sagaId)}</b>`:'REQUISITO<br><b>PENDIENTE</b>'}if(r.type==='read_book'){const book=normalizeBookId(r.book);return book?`LEE EL LIBRO<br><b>${escapeHtml(book)}</b>`:'REQUISITO<br><b>PENDIENTE</b>'}if(r.type==='external')return'DESBLOQUEO<br><b>ESPECIAL</b>';return'BLOQUEADO'}
function consumedMediaMap(){const m=store.get(consumedMediaKey,{audio:[],video:[],audioLocales:{es:[],en:[],ca:[]},videoLocales:{es:[],en:[],ca:[]},assets:{audio:[],video:[]}})||{};m.audio=Array.isArray(m.audio)?m.audio:[];m.video=Array.isArray(m.video)?m.video:[];m.assets=m.assets&&typeof m.assets==='object'?m.assets:{};for(const type of ['audio','video']){const k=`${type}Locales`;m[k]=m[k]&&typeof m[k]==='object'?m[k]:{};for(const locale of ['es','en','ca'])m[k][locale]=Array.isArray(m[k][locale])?m[k][locale]:[];m.assets[type]=Array.isArray(m.assets[type])?m.assets[type]:[]}return m}
function mediaAssetConsumptionKey(storyId,locale,mediaId){return`${String(storyId)}|${['es','en','ca'].includes(locale)?locale:'es'}|${String(mediaId||'')}`}
function mediaConsumed(type,storyId,locale='',mediaId=''){const m=consumedMediaMap(),id=String(storyId),base=Array.isArray(m?.[type])?m[type].map(String):[];const l=['es','en','ca'].includes(locale)?locale:'es';if(mediaId){const key=mediaAssetConsumptionKey(id,l,mediaId);return (m.assets?.[type]||[]).map(String).includes(key)}if(!locale)return base.includes(id)||['es','en','ca'].some(x=>(m?.[`${type}Locales`]?.[x]||[]).map(String).includes(id));const rows=(m?.[`${type}Locales`]?.[l]||[]).map(String);return rows.includes(id)||(l==='es'&&base.includes(id))}
function markStoryMediaConsumed(type,storyId,locale='es',mediaId=''){if(!['audio','video'].includes(type)||!storyId)return false;locale=['es','en','ca'].includes(locale)?locale:'es';const m=consumedMediaMap(),id=String(storyId),lk=`${type}Locales`,localeRows=m[lk][locale].map(String);let changed=false;if(mediaId){const key=mediaAssetConsumptionKey(id,locale,mediaId);if(!m.assets[type].map(String).includes(key)){m.assets[type].push(key);changed=true}}if(!localeRows.includes(id)){m[lk][locale].push(id);changed=true}if(locale==='es'&&!m[type].map(String).includes(id)){m[type].push(id);changed=true}if(!changed)return false;store.set(consumedMediaKey,m);evaluateAchievements(true);queueUserVaultSync();return true}
function storyMediaTypeFromCurrentTab(){const txt=normalizedText(`${currentTab||''} ${currentStory?.tabs?.[currentTab]?.label||''}`);if(/audio|escuchar|listen|cassette/.test(txt))return'audio';if(/video|corto|watch|tape/.test(txt))return'video';return''}
function completedSagaById(id){const s=sagaById(id);if(!s)return false;const d=sagaProgressData(s);return d.total>0&&d.published===d.total&&d.read===d.total}
function readTimelineEraCount(){const eras=new Set();for(const st of (indexData?.stories||[])){if(!isRead(String(st.id)))continue;const era=eraForYear(parseStoryYear(st));if(era&&era!=='FECHA DESCONOCIDA')eras.add(era)}return eras.size}
function gameCompletionMap(){const raw=store.get(gameCompletionsKey,{});return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}}
function hasCompletedGame(gameId){gameId=String(gameId||'').trim();return !!gameId&&gameCompletionMap()[gameId]?.completed===true}
function gameTitleById(gameId){const g=gameById(gameId);return String(g?.title||gameId||'GAME').trim()}
async function registerGameCompletion(gameId){gameId=String(gameId||'').trim();if(!gameId)return false;const m=gameCompletionMap(),already=m[gameId]?.completed===true;if(!already){m[gameId]={completed:true,completedAt:new Date().toISOString()};store.set(gameCompletionsKey,m);queueUserVaultSync()}evaluateAchievements(true);return !already}
function achievementRows(){const rows=Array.isArray(userConfigData?.achievements)?userConfigData.achievements:[];rows.forEach((a,i)=>{if(a&&!Number(a.number))a.number=i+1});return rows}
function earnedAchievementIds(){return new Set((store.get(achievementEarnedKey,[])||[]).map(String))}
function activeAchievementIds(){evaluateAchievements(false);return new Set((store.get(achievementActiveKey,[])||[]).map(String))}
function earnedAchievementCount(){const active=activeAchievementIds();return achievementRows().filter(a=>a?.id&&active.has(String(a.id))).length}
function completedSagaCount(){return (sagasData?.sagas||[]).filter(s=>{const d=sagaProgressData(s);return d.total>0&&d.published===d.total&&d.read===d.total}).length}
function normalizeBookId(v){const raw=String(v??'').trim();if(!raw)return'';return Number(raw)?String(Number(raw)):raw}
function achievementBookStories(bookId){const wanted=normalizeBookId(bookId);if(!wanted)return[];return (indexData?.stories||[]).filter(st=>normalizeBookId(st.book)===wanted)}
function publishedStoriesAsc(){return [...(indexData?.stories||[])].filter(st=>st?.published).sort((a,b)=>new Date(a.published)-new Date(b.published)||String(a.id).localeCompare(String(b.id),undefined,{numeric:true}))}
function qrUnlockedStoryCount(){const secrets=secretMap(),ids=new Set((indexData?.stories||[]).filter(st=>st.access==='exclusive').map(st=>String(st.id)));return Object.keys(secrets||{}).filter(id=>ids.has(String(id))&&secrets[id]).length}
function achievementRequirementProgressFor(r){r=r||{};if(r.type==='game_completed'){const gameId=String(r.gameId||'').trim(),done=hasCompletedGame(gameId);return{current:done?1:0,target:1,label:gameId?`COMPLETA ${gameTitleById(gameId)}`:'COMPLETA UN GAME'}}if(r.type==='read_book'){const rows=achievementBookStories(r.book),target=rows.length,current=rows.filter(st=>isRead(String(st.id))).length,book=normalizeBookId(r.book);return{current,target,label:book?`LEE EL LIBRO ${book}`:'LIBRO PENDIENTE'}}if(r.type==='read_first_published'){const target=Math.max(1,Number(r.count)||1),rows=publishedStoriesAsc().slice(0,target),current=rows.filter(st=>isRead(String(st.id))).length;return{current,target,label:`LEE LAS PRIMERAS ${target} STORIES PUBLICADAS`}}if(r.type==='unlock_qr'){const target=Math.max(1,Number(r.count)||1);return{current:qrUnlockedStoryCount(),target,label:`DESBLOQUEA ${target} ${target===1?'STORY':'STORIES'} MEDIANTE QR`}}if(r.type==='complete_sagas'){const ids=Array.isArray(r.sagaIds)?r.sagaIds.map(String).filter(Boolean):[];if(ids.length)return{current:ids.filter(completedSagaById).length,target:ids.length,label:`COMPLETA ${ids.length} ${ids.length===1?'SAGA CONCRETA':'SAGAS CONCRETAS'}`};const target=Math.max(1,Number(r.count)||1);return{current:completedSagaCount(),target,label:`COMPLETA ${target} ${target===1?'SAGA':'SAGAS'}`}}if(r.type==='read_timeline_eras'){const target=Math.max(1,Math.min(8,Number(r.count)||1));return{current:readTimelineEraCount(),target,label:`LEE STORIES DE ${target} ÉPOCAS DIFERENTES DEL TIMELINE`}}if(r.type==='listen_cassettes'||r.type==='watch_tapes'){const mediaType=r.type==='listen_cassettes'?'audio':'video',refs=Array.isArray(r.mediaRefs)&&r.mediaRefs.length?r.mediaRefs.map(x=>({storyId:String(x?.storyId||''),locale:['es','en','ca'].includes(x?.locale)?x.locale:'es',mediaId:String(x?.mediaId||'')})).filter(x=>x.storyId):(Array.isArray(r.storyIds)?r.storyIds.map(id=>({storyId:String(id),locale:'es',mediaId:''})).filter(x=>x.storyId):[]);const langs=[...new Set(refs.map(x=>x.locale))].map(l=>l==='en'?'ENGLISH':l==='ca'?'CATALÀ':'CASTELLANO').join(' · ');return{current:refs.filter(x=>mediaConsumed(mediaType,x.storyId,x.locale,x.mediaId)).length,target:refs.length,label:`${mediaType==='audio'?'ESCUCHA':'VE'} ${refs.length} ${mediaType==='audio'?(refs.length===1?'CASSETTE':'CASSETTES'):(refs.length===1?'TAPE':'TAPES')}${langs?` · ${langs}`:''}`}}if(r.type==='all'){const items=Array.isArray(r.items)?r.items:[],current=items.filter(x=>achievementRequirementMetRaw(x)).length,target=items.length;return{current,target,label:`CUMPLE ${target} REQUISITOS`}}const target=Math.max(1,Number(r.count)||1);return{current:publishedReadCount(),target,label:`LEE ${target} ${target===1?'STORY':'STORIES'}`}}
function achievementRequirementMetRaw(r){if(r?.type==='all'){const items=Array.isArray(r.items)?r.items:[];return items.length>=2&&items.every(achievementRequirementMetRaw)}const p=achievementRequirementProgressFor(r);return p.target>0&&p.current>=p.target}

function setupMyStoriesReadCounter(target){
  const el=$('.progress-dashboard .progress-big strong'),box=el?.closest('.progress-dashboard');
  if(!el||!box)return;
  const final=Math.max(0,Number(target)||0);
  el.dataset.motionCounter='v426-custom';
  el.textContent=motionReduced()?String(final):'0';
  if(motionReduced())return;
  let started=false,observer=null;
  const run=()=>{if(started)return;started=true;observer?.disconnect();const start=performance.now(),duration=750;const frame=now=>{const t=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-t,3);el.textContent=String(Math.round(final*ease));if(t<1)requestAnimationFrame(frame);else el.textContent=String(final)};requestAnimationFrame(frame)};
  const check=()=>{if(box.classList.contains('hud-progress-ready'))run()};
  observer=new MutationObserver(check);observer.observe(box,{attributes:true,attributeFilter:['class']});check();
}
function achievementRequirementProgress(a){return achievementRequirementProgressFor(a?.requirement||{})}
function achievementRequirementMet(a){return achievementRequirementMetRaw(a?.requirement||{})}
let achievementRewardChain=Promise.resolve();
function achievementOverlayHost(){const fs=document.fullscreenElement;return fs&&fs.id==='gamePlayShell'?fs:document.body}
function achievementRewardSignature(a){const r=a?.reward||{};if(r.type==='unlock_story'&&r.storyId)return`${String(a?.id||'')}|unlock_story|${String(r.storyId)}`;return''}
function grantedAchievementRewardSignatures(){return new Set((store.get(achievementRewardsKey,[])||[]).map(String))}
function achievementRewardPending(a){const sig=achievementRewardSignature(a);return !!sig&&!grantedAchievementRewardSignatures().has(sig)}
function rememberAchievementReward(a){const sig=achievementRewardSignature(a);if(!sig)return;const got=grantedAchievementRewardSignatures();if(got.has(sig))return;got.add(sig);store.set(achievementRewardsKey,[...got]);queueUserVaultSync()}
async function unsealAchievementRewardSecret(a,storyId){const r=a?.reward||{},seal=String(r.unlockSeal||'').trim();if(!seal.startsWith('v1.'))return normalizeUnlockSecret(String(r.unlockSecret||''),storyId);try{let payload=seal.slice(3).replace(/-/g,'+').replace(/_/g,'/');payload+='='.repeat((4-payload.length%4)%4);const sealed=Uint8Array.from(atob(payload),c=>c.charCodeAt(0)),material=new TextEncoder().encode(`DISTURBING_REWARD_UNLOCK_V1|${String(a?.id||'').trim()}|${storyId}`),key=new Uint8Array(await crypto.subtle.digest('SHA-256',material)),raw=new Uint8Array(sealed.length);for(let i=0;i<sealed.length;i++)raw[i]=sealed[i]^key[i%key.length];return normalizeUnlockSecret(new TextDecoder().decode(raw),storyId)}catch(e){console.warn('Achievement reward seal',e);return''}}
async function unlockStoryAchievementReward(a,{showModal=true}={}){const r=a?.reward||{},storyId=String(r.storyId||'').padStart(3,'0'),meta=indexData?.stories?.find(st=>String(st.id)===storyId);if(!meta||meta.access!=='exclusive')throw new Error(`Story ${storyId} no disponible como exclusiva`);if(!isLocked(meta)){markStoryAcquired(storyId,false);rememberAchievementReward(a);if(showModal)await showStoryAchievementReward(a,meta);return true}const secret=await unsealAchievementRewardSecret(a,storyId);if(!secret)throw new Error(`Falta el secreto de recompensa para la Story ${storyId}`);const data=await loadStoryData(meta,secret);if(String(data?.id||'')!==storyId)throw new Error(`El secreto de recompensa no corresponde a la Story ${storyId}`);const m=secretMap();m[storyId]=secret;store.set(unlockSecretsKey,m);markStoryAcquired(storyId,true);rememberAchievementReward(a);await updateAppBadge();if(showModal)await showStoryAchievementReward(a,meta);return true}
async function executeAchievementReward(a,{showModal=true}={}){if(!achievementRewardPending(a))return false;const r=a?.reward||{};if(r.type==='unlock_story')return unlockStoryAchievementReward(a,{showModal});return false}
function queueAchievementEffects(newRows=[],rewardRows=[],showReward=false){if(!newRows.length&&!rewardRows.length)return achievementRewardChain;const newIds=new Set(newRows.map(a=>String(a?.id||'')));achievementRewardChain=achievementRewardChain.then(async()=>{for(const a of newRows){if(showReward)await showAchievementReward(a);if(rewardRows.some(x=>String(x?.id||'')===String(a?.id||'')))try{await executeAchievementReward(a,{showModal:showReward})}catch(e){console.warn('Achievement functional reward',e);if(showReward)toast('No se pudo aplicar la recompensa del logro')}}for(const a of rewardRows){if(newIds.has(String(a?.id||'')))continue;try{await executeAchievementReward(a,{showModal:false})}catch(e){console.warn('Achievement pending reward',e)}}}).catch(e=>console.warn('Achievement reward chain',e));return achievementRewardChain}
function evaluateAchievements(showReward=false){const rows=achievementRows(),history=earnedAchievementIds(),storedActive=store.get(achievementActiveKey,null),prevActive=new Set((Array.isArray(storedActive)?storedActive:[...history]).map(String)),active=new Set(),newOrRecovered=[];for(const a of rows){const id=String(a?.id||'');if(!id)continue;if(achievementRequirementMet(a)){active.add(id);if(!history.has(id)){history.add(id);newOrRecovered.push(a)}else if(!prevActive.has(id))newOrRecovered.push(a)}}const histArr=[...history],activeArr=[...active],histOld=(store.get(achievementEarnedKey,[])||[]).map(String),actOld=(Array.isArray(storedActive)?storedActive:[...prevActive]).map(String),historyChanged=JSON.stringify(histArr)!==JSON.stringify(histOld),activeChanged=JSON.stringify(activeArr)!==JSON.stringify(actOld);if(historyChanged)store.set(achievementEarnedKey,histArr);if(activeChanged||!Array.isArray(storedActive))store.set(achievementActiveKey,activeArr);const pendingRewards=rows.filter(a=>a?.id&&active.has(String(a.id))&&achievementRewardPending(a));if(historyChanged||activeChanged){queueUserVaultSync();updateUserChrome();if(routeName()==='user')setTimeout(()=>renderUser(),0)}if(newOrRecovered.length||pendingRewards.length)queueAchievementEffects(newOrRecovered,pendingRewards,showReward);return active}
function achievementHistoryRowsLatestFirst(){const ids=(store.get(achievementEarnedKey,[])||[]).map(String),pos=new Map(ids.map((id,i)=>[id,i]));return achievementRows().filter(a=>a?.id&&pos.has(String(a.id))).sort((a,b)=>(pos.get(String(b.id))??-1)-(pos.get(String(a.id))??-1)||(Number(b.number)||0)-(Number(a.number)||0))}
function activeAchievementsLatestFirst(){const active=evaluateAchievements(false);return achievementHistoryRowsLatestFirst().filter(a=>active.has(String(a.id)))}
function lostAchievementsLatestFirst(){const active=evaluateAchievements(false);return achievementHistoryRowsLatestFirst().filter(a=>!active.has(String(a.id)))}
function achievementDescriptionPreview(text){const full=String(text||'').trim(),words=full.split(/\s+/).filter(Boolean);return{full,short:words.length>3?words.slice(0,3).join(' ')+'…':full}}
function achievementCardHtml(a,lost=false){const p=achievementRequirementProgress(a),desc=achievementDescriptionPreview(a.description||p.label);return `<article class="achievement-earned-card ${lost?'achievement-lost':''}" data-achievement-card role="button" tabindex="0" aria-expanded="false"><span class="achievement-medal" aria-hidden="true">★</span><div><strong>${escapeHtml(a.name||'LOGRO')}</strong>${desc.full?`<small class="achievement-desc-short">${escapeHtml(desc.short)}</small><small class="achievement-desc-full">${escapeHtml(desc.full)}</small>`:''}${lost?'<small class="achievement-lost-label">LOGRO PERDIDO · RECUPÉRALO</small>':''}</div></article>`}
function achievementsPanelHtml(){const active=activeAchievementsLatestFirst(),lost=lostAchievementsLatestFirst(),total=active.length,all=[...active,...lost];return `<div class="user-achievements-section"><div class="user-box-title">${total} LOGROS CONSEGUIDOS</div><div id="achievementEarnedList" class="achievement-earned-list">${all.length?`${active.map(a=>achievementCardHtml(a,false)).join('')}${lost.length?'<span class="achievement-lost-break" aria-hidden="true"></span>':''}${lost.map(a=>achievementCardHtml(a,true)).join('')}`:'<p class="achievement-empty">Todavía no has conseguido ningún logro.</p>'}</div>${all.length>1?`<button id="achievementListToggle" class="achievement-list-toggle hidden" type="button" aria-expanded="false">VER TODOS LOS LOGROS</button>`:''}</div>`}
function setupAchievementCollapser(){const list=$('#achievementEarnedList'),toggle=$('#achievementListToggle');if(!list||!toggle)return;const cards=[...list.querySelectorAll('.achievement-earned-card')];if(cards.length<2)return;
  const resetExpandedLimit=()=>{list.classList.remove('achievement-expanded-scroll');list.style.maxHeight='';list.style.overflowY='';list.style.paddingRight=''};
  const applyExpandedLimit=()=>{resetExpandedLimit();requestAnimationFrame(()=>{const visible=cards.filter(c=>!c.classList.contains('achievement-row-hidden')),tops=[...new Set(visible.map(c=>c.offsetTop))].sort((a,b)=>a-b);if(tops.length<=5)return;const sixthTop=tops[5],sixth=visible.filter(c=>Math.abs(c.offsetTop-sixthTop)<2),rowH=Math.max(1,...sixth.map(c=>c.offsetHeight));const max=Math.max(1,(sixthTop-tops[0])+rowH*.5);list.style.maxHeight=`${Math.round(max)}px`;list.style.overflowY='auto';list.style.paddingRight='4px';list.classList.add('achievement-expanded-scroll')})};
  requestAnimationFrame(()=>{cards.forEach(c=>c.classList.remove('achievement-row-hidden'));const firstTop=cards[0]?.offsetTop??0,extra=cards.filter(c=>c.offsetTop>firstTop+2);if(!extra.length){toggle.classList.add('hidden');return}extra.forEach(c=>c.classList.add('achievement-row-hidden'));toggle.classList.remove('hidden');toggle.dataset.collapsed='1';toggle.textContent='VER TODOS LOS LOGROS';resetExpandedLimit();toggle.onclick=()=>{const collapsed=toggle.dataset.collapsed==='1';extra.forEach(c=>c.classList.toggle('achievement-row-hidden',!collapsed));toggle.dataset.collapsed=collapsed?'0':'1';toggle.setAttribute('aria-expanded',String(collapsed));toggle.textContent=collapsed?'OCULTAR LOGROS':'VER TODOS LOS LOGROS';if(collapsed)applyExpandedLimit();else resetExpandedLimit()}})}
let achievementOutsideCloser=null;
function setupAchievementCardInteractions(){
  const cards=[...document.querySelectorAll('[data-achievement-card]')];if(!cards.length)return;
  const collapseAll=()=>{cards.forEach(c=>{c.classList.remove('achievement-description-open');c.setAttribute('aria-expanded','false')});if(achievementOutsideCloser){document.removeEventListener('click',achievementOutsideCloser,true);achievementOutsideCloser=null}};
  const openCard=card=>{const already=card.classList.contains('achievement-description-open');collapseAll();if(already)return;card.classList.add('achievement-description-open');card.setAttribute('aria-expanded','true');achievementOutsideCloser=e=>{if(card.contains(e.target)){collapseAll();e.stopPropagation();return}collapseAll()};setTimeout(()=>{if(achievementOutsideCloser)document.addEventListener('click',achievementOutsideCloser,true)},0)};
  cards.forEach(card=>{card.onclick=e=>{e.stopPropagation();openCard(card)};card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();openCard(card)}}});
}
function registeredHeroBackground(){const a=avatarById(selectedAvatarId()),u=String(a?.heroBackground||'').trim();return /^https?:\/\//i.test(u)?u:''}
function registeredDisplayName(){return String(userProfile?.display_name||store.get(userNameCacheKey,'')||'').trim()}
function bindUserHeaderShortcut(el){if(!el||el.dataset.userShortcutBound)return;el.dataset.userShortcutBound='1';el.addEventListener('click',()=>go('user'));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go('user')}})}
function updateUserChrome(){const name=registeredDisplayName(),lab=$('#userMenuLabel'),hello=$('#userGreeting'),head=$('#userHeaderAvatar'),headImg=$('#userHeaderAvatarImg'),drawerIcon=$('#userMenuIcon'),drawerImg=$('#userMenuAvatarImg'),a=avatarById(selectedAvatarId()),level=registeredUser?earnedAchievementCount():0,section=$('#sectionIndicator');if(section)section.classList.toggle('hidden',(routeName()==='user'&&!!registeredUser)||!section.innerHTML);if(lab)lab.textContent=registeredUser?(name||'Usuario Registrado'):'Usuario No Registrado';const show=!!registeredUser&&!!name;if(hello){hello.textContent=show?`Hola ${name}`:'';hello.classList.toggle('hidden',!show);bindUserHeaderShortcut(hello)}if(head){const hideOnMyStories=routeName()==='unlocked';head.classList.toggle('hidden',!show||hideOnMyStories);bindUserHeaderShortcut(head);if(headImg&&show&&a){headImg.src=avatarImageUrl(a);headImg.alt=avatarDisplayName(a)||name||'Avatar'}let badge=head.querySelector('.user-level-badge');if(show&&!badge){badge=document.createElement('span');badge.className='user-level-badge';head.append(badge)}if(badge){badge.innerHTML=`<span class="user-level-number">${level}</span><span class="user-level-star">★</span>`;badge.classList.toggle('hidden',!show);badge.classList.toggle('level-multi',level>=10);badge.classList.toggle('level-3plus',level>=100)}}if(drawerIcon){const useAvatar=!!registeredUser&&!!a;drawerIcon.classList.toggle('has-avatar',useAvatar);if(drawerImg&&useAvatar){drawerImg.src=avatarImageUrl(a);drawerImg.alt=avatarDisplayName(a)||name||'Avatar'}let badge=drawerIcon.querySelector('.drawer-level-badge');if(useAvatar&&!badge){badge=document.createElement('span');badge.className='drawer-level-badge';drawerIcon.append(badge)}if(badge){badge.innerHTML=`<span class="user-level-number">${level}</span><span class="user-level-star">★</span>`;badge.classList.toggle('hidden',!useAvatar);badge.classList.toggle('level-multi',level>=10);badge.classList.toggle('level-3plus',level>=100)}}}
function updateUserMenu(){updateUserChrome()}
async function chooseAvatar(id){const a=avatarById(id);if(!avatarAvailable(a))return;store.set(localAvatarKey,id);if(registeredUser&&supabaseClient){try{const {error}=await supabaseClient.from('profiles').update({avatar_id:id,updated_at:new Date().toISOString()}).eq('id',registeredUser.id);if(error)throw error;userProfile={...(userProfile||{}),avatar_id:id}}catch(e){console.warn(e)}}renderUser()}
function avatarChoiceHtml(a){const ok=avatarAvailable(a),sel=a.id===selectedAvatarId(),name=avatarDisplayName(a);return `<button class="avatar-choice ${ok?'':'locked'} ${sel?'selected':''}" data-avatar-id="${escAttr(a.id)}" type="button" ${ok?'':`aria-disabled="true"`}><span class="avatar-choice-frame">${avatarImg(a,'avatar-choice-img')}${ok?'':`<span class="avatar-lock-overlay"><span class="avatar-lock-symbol" aria-hidden="true">${lockSvg(false)}</span><span class="avatar-requirement">${avatarRequirementText(a)}</span></span>`}</span>${name?`<strong class="avatar-visible-name">${escapeHtml(name)}</strong>`:''}</button>`}
function setupUserPageReveal(){const page=$('.user-page');if(!page)return;const boxes=[...page.querySelectorAll('.user-hero,.user-achievements-section,.user-avatar-section,.user-sounds-panel,.user-avatar-loop,.user-account-panel')];page.classList.add('user-page-reveal-ready');let i=0;for(const box of boxes){box.style.setProperty('--user-box-i',i++);let j=0;for(const el of box.querySelectorAll(':scope > *, .achievement-earned-card, .avatar-choice'))el.style.setProperty('--user-item-i',j++)}requestAnimationFrame(()=>requestAnimationFrame(()=>page.classList.add('user-page-reveal-in')))}
function animateRegisteredUserHero(){
  const hero=$('.user-hero.registered');if(!hero)return;
  hero.classList.add('user-hero-v424');
  const avatar=hero.querySelector('.user-avatar-current'),level=hero.querySelector('.user-hero-level'),star=hero.querySelector('.user-hero-level-star'),name=hero.querySelector('.user-hero-name'),status=hero.querySelector('.user-hero-status'),email=hero.querySelector('.user-email'),edit=hero.querySelector('.user-edit-name-btn'),levelNumber=hero.querySelector('.user-hero-level-number');
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const rows=[name,status,email].filter(Boolean).map(el=>({el,text:String(el.textContent||'')}));
  const target=Math.max(0,parseInt(levelNumber?.textContent||'0',10)||0);
  if(reduced){if(levelNumber)levelNumber.textContent=String(target);if(star)star.style.opacity='1';hero.classList.add('user-hero-v424-complete');return}
  if(avatar)avatar.style.opacity='0';if(level)level.style.opacity='0';if(star)star.style.opacity='0';
  for(const row of rows)row.el.textContent='';if(levelNumber)levelNumber.textContent='0';if(edit){edit.style.opacity='0';edit.style.transform='translateY(5px)'}
  const typeTimed=(el,value,startMs,durationMs)=>{if(!el)return;setTimeout(()=>{if(!value)return;const t0=performance.now();const frame=now=>{const p=Math.min(1,(now-t0)/Math.max(1,durationMs)),n=Math.max(1,Math.ceil(value.length*p));el.textContent=value.slice(0,n);if(p<1)requestAnimationFrame(frame);else el.textContent=value};requestAnimationFrame(frame)},startMs)};
  typeTimed(name,rows.find(r=>r.el===name)?.text||'',100,280);typeTimed(status,rows.find(r=>r.el===status)?.text||'',350,190);typeTimed(email,rows.find(r=>r.el===email)?.text||'',520,240);
  setTimeout(()=>{if(!levelNumber)return;if(target<=0){levelNumber.textContent='0';revealStar();return}const t0=performance.now(),dur=620,frame=now=>{const p=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-p,3);levelNumber.textContent=String(Math.min(target,Math.round(target*e)));if(p<1)requestAnimationFrame(frame);else{levelNumber.textContent=String(target);revealStar()}};requestAnimationFrame(frame)},180);
  const revealStar=()=>{if(!star)return;let f=0;const tick=()=>{f++;star.style.opacity=String(Math.min(1,f/10));if(f<10)requestAnimationFrame(tick)};requestAnimationFrame(tick)};
  setTimeout(()=>{if(edit){edit.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out',fill:'both'})}},1080);
  setTimeout(()=>{if(avatar)avatar.style.opacity='1';if(level)level.style.opacity='1';hero.classList.add('user-hero-v424-complete')},1380);
}
function animateUserHeroReadCount(target){const el=$('#userHeroReadCount');if(!el)return;target=Math.max(0,Number(target)||0);if(motionReduced()){el.textContent=String(target);return}const t0=performance.now(),duration=2000;el.textContent='0';const frame=now=>{const p=Math.min(1,(now-t0)/duration),ease=1-Math.pow(1-p,3);el.textContent=String(Math.round(target*ease));if(p<1)requestAnimationFrame(frame);else el.textContent=String(target)};requestAnimationFrame(frame)}
function setupUserAvatarCollapser(){const section=$('.user-avatar-section'),grid=section?.querySelector('.avatar-grid');if(!section||!grid)return;const cards=[...grid.querySelectorAll('.avatar-choice')];grid.querySelector('.avatar-expand-row')?.remove();section.classList.remove('avatars-expanded');cards.forEach((card,i)=>card.classList.toggle('avatar-collapse-extra',i>=8));if(cards.length<=8)return;const row=document.createElement('div');row.className='avatar-expand-row';row.innerHTML='<button class="avatar-expand-toggle" type="button" aria-expanded="false" aria-label="Descolapsar avatares"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>';grid.appendChild(row);const btn=row.querySelector('button');btn.onclick=()=>{const open=!section.classList.contains('avatars-expanded');section.classList.toggle('avatars-expanded',open);btn.setAttribute('aria-expanded',String(open));btn.setAttribute('aria-label',open?'Colapsar avatares':'Descolapsar avatares')}}
function renderUser(){currentStory=null;ensureFreeAvatars();evaluateAchievements(false);const registered=!!registeredUser,avatar=avatarById(selectedAvatarId())||avatarRows()[0],name=registeredDisplayName(),heroBg=registered?registeredHeroBackground():'',levelCount=registered?earnedAchievementCount():0,levelShape=levelCount>=100?'level-3plus':levelCount>=10?'level-multi':'';view.innerHTML=`<section class="section user-page"><div class="user-hero ${registered?'registered':''}">${heroBg?`<div class="user-hero-media" aria-hidden="true"><img class="user-hero-background user-hero-bg-backdrop" src="${escAttr(heroBg)}" alt="" referrerpolicy="no-referrer"><img class="user-hero-background user-hero-bg-ghost user-hero-bg-red" src="${escAttr(heroBg)}" alt="" referrerpolicy="no-referrer"><img class="user-hero-background user-hero-bg-ghost user-hero-bg-cyan" src="${escAttr(heroBg)}" alt="" referrerpolicy="no-referrer"><img class="user-hero-background user-hero-bg-main" src="${escAttr(heroBg)}" alt="" referrerpolicy="no-referrer"></div><span class="user-hero-shade" aria-hidden="true"></span>`:''}<div class="user-avatar-current">${avatar?avatarImg(avatar,'user-avatar-img'):'<span>?</span>'}</div><div class="user-hero-copy">${registered?`<h1 class="user-hero-name">${escapeHtml(name||'Usuario Registrado')}</h1><div class="user-hero-status">USUARIO REGISTRADO</div><div class="user-hero-readcount"><strong id="userHeroReadCount">0</strong> Stories leídas</div><p class="user-email">${escapeHtml(registered.email||'')}</p><button id="userEditName" class="user-edit-name-btn" type="button">EDITAR NOMBRE</button><div id="userNameEditor" class="user-name-editor hidden"><input id="userNameEditInput" type="text" maxlength="30" autocomplete="name" value="${escAttr(name)}" aria-label="Nuevo nombre"><div class="user-name-editor-actions"><button id="userNameSave" type="button">GUARDAR</button><button id="userNameCancel" type="button">CANCELAR</button></div><small id="userNameEditStatus"></small></div>`:`<div class="eyebrow">Usuario No Registrado</div><h1>Usuario No Registrado</h1><p>Tu progreso permanece en este dispositivo. Regístrate para guardarlo y sincronizarlo con tu cuenta.</p>`}</div>${registered?`<div class="user-hero-level ${levelShape}" title="Nivel según logros conseguidos"><span class="user-hero-level-number">${levelCount}</span><span class="user-hero-level-star">★</span></div>`:''}</div>${registered?achievementsPanelHtml():''}<div class="user-avatar-section"><h2>AVATARES DISPONIBLES</h2><div class="avatar-grid">${avatarRows().map(avatarChoiceHtml).join('')||'<div class="empty">Los avatares se cargan desde GitHub y se configuran desde el Importer.</div>'}</div></div>${uiSoundPreferenceHtml()}<div class="user-avatar-loop" aria-hidden="true"><video autoplay muted loop playsinline preload="metadata" tabindex="-1"><source src="${escAttr(PUBLIC_APP_ASSET_BASE+'todasloop.webm')}" type="video/webm"></video></div>${registered?`<div class="user-account-panel user-sync-panel"><strong class="sync-active-title">SINCRONIZACIÓN ACTIVA</strong><p class="user-sync-copy">Tu progreso, desbloqueos y preferencias se sincronizan automáticamente con tu cuenta cada vez que cambian. Un mismo usuario en todos tus dispositivos.</p><button id="userLogout" class="secondary-btn user-logout-btn" type="button">CERRAR SESIÓN</button><p id="userStatus" class="note"></p></div>`:registrationPanelHtml()}</section>`;$$('[data-avatar-id]').forEach(b=>b.onclick=()=>chooseAvatar(b.dataset.avatarId));setupUserAvatarCollapser();bindUiSoundPreference();if(registered){$('#userLogout').onclick=logoutUser;bindUserNameEditor();setupAchievementCollapser();setupAchievementCardInteractions()}else bindRegistrationPanel();bindBrokenImages();updateUserChrome();setupUserPageReveal();if(registered){animateRegisteredUserHero();animateUserHeroReadCount(publishedReadCount());startUserHeroBackgroundMotion()}}


function startUserHeroBackgroundMotion(){
  if(userHeroBgMotionRaf){cancelAnimationFrame(userHeroBgMotionRaf);userHeroBgMotionRaf=0}
  const media=$('.user-hero-media');
  if(!media)return;
  const imgs=[...media.querySelectorAll('.user-hero-background')];
  if(!imgs.length)return;
  const t0=performance.now();
  const tick=now=>{
    if(routeName()!=='user'||!media.isConnected){userHeroBgMotionRaf=0;return}
    const t=(now-t0)/1000;
    // Trayectoria lenta, amplia y no repetitiva: dos frecuencias por eje.
    const x=Math.sin(t*.37)*2.5 + Math.sin(t*.113+1.7)*1.35;
    const y=Math.cos(t*.29+.6)*2.7 + Math.sin(t*.151+2.1)*1.45;
    const sc=1.055 + (Math.sin(t*.19-.8)+1)*.006;
    const ox=50 + Math.sin(t*.21+.3)*42;
    const oy=50 + Math.cos(t*.17+1.1)*41;
    for(const img of imgs){
      img.style.translate=`${x.toFixed(3)}% ${y.toFixed(3)}%`;
      img.style.scale=sc.toFixed(4);
      img.style.objectPosition=`${Math.max(4,Math.min(96,ox)).toFixed(2)}% ${Math.max(5,Math.min(95,oy)).toFixed(2)}%`;
    }
    userHeroBgMotionRaf=requestAnimationFrame(tick);
  };
  userHeroBgMotionRaf=requestAnimationFrame(tick);
}

function bindUserNameEditor(){const open=$('#userEditName'),panel=$('#userNameEditor'),input=$('#userNameEditInput'),save=$('#userNameSave'),cancel=$('#userNameCancel');if(!open||!panel||!input||!save||!cancel)return;const close=()=>{panel.classList.add('hidden');open.setAttribute('aria-expanded','false');input.value=registeredDisplayName()};open.setAttribute('aria-expanded','false');open.onclick=()=>{const willOpen=panel.classList.contains('hidden');panel.classList.toggle('hidden',!willOpen);open.setAttribute('aria-expanded',willOpen?'true':'false');if(willOpen){input.value=registeredDisplayName();requestAnimationFrame(()=>{input.focus();input.select()})}};cancel.onclick=close;save.onclick=async()=>{const next=String(input.value||'').trim().replace(/\s+/g,' '),status=$('#userNameEditStatus');if(next.length<1||next.length>30){if(status){status.textContent='Usa un nombre de entre 1 y 30 caracteres.';status.className='bad'}return}save.disabled=true;if(status){status.textContent='Guardando…';status.className=''}try{const {error}=await supabaseClient.from('profiles').update({display_name:next,updated_at:new Date().toISOString()}).eq('id',registeredUser.id);if(error)throw error;try{await supabaseClient.auth.updateUser({data:{display_name:next}})}catch{}userProfile={...(userProfile||{}),display_name:next};store.set(userNameCacheKey,next);updateUserChrome();renderUser();forcePageTop()}catch(e){if(status){status.textContent=e?.message||'No se pudo cambiar el nombre.';status.className='bad'}}finally{save.disabled=false}};input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();save.click()}else if(e.key==='Escape'){e.preventDefault();close()}})}
function registrationPanelHtml(){return `<div class="user-account-panel"><button id="openExistingLogin" class="user-existing-login-cta" type="button" aria-expanded="false">YA TENGO CUENTA · INICIAR SESIÓN</button><div id="existingLoginPanel" class="user-existing-login-panel hidden"><div class="user-form"><label>EMAIL<input id="loginEmail" type="email" autocomplete="email"></label><label>PASSWORD<input id="loginPassword" type="password" autocomplete="current-password"></label><button id="loginUser" class="cta" type="button">INICIAR SESIÓN</button></div></div><div class="user-register-divider"><span>O CREA TU CUENTA</span></div><h2>REGISTRAR</h2><p>Crea tu usuario registrado sin perder el progreso que ya tienes.</p><div class="user-form"><label>NOMBRE<input id="regName" autocomplete="name" maxlength="50"></label><label>EMAIL<input id="regEmail" type="email" autocomplete="email"></label><label>PASSWORD<input id="regPassword" type="password" autocomplete="new-password" minlength="6"></label><button id="registerUser" class="cta" type="button">REGISTRAR</button></div><p id="userStatus" class="note"></p></div>`}
function bindRegistrationPanel(){const r=$('#registerUser'),l=$('#loginUser'),o=$('#openExistingLogin'),p=$('#existingLoginPanel');if(r)r.onclick=registerUser;if(l)l.onclick=loginUser;if(o&&p)o.onclick=()=>{const willOpen=p.classList.contains('hidden');p.classList.toggle('hidden',!willOpen);o.setAttribute('aria-expanded',String(willOpen));o.classList.toggle('active',willOpen);if(willOpen)setTimeout(()=>$('#loginEmail')?.focus(),50)}}
function userStatus(msg,bad=false){const e=$('#userStatus');if(e){e.textContent=msg;e.classList.toggle('bad',!!bad)}}
async function registerUser(){if(!supabaseClient)return userStatus('Supabase no está disponible.',true);const name=$('#regName')?.value.trim(),email=$('#regEmail')?.value.trim(),password=$('#regPassword')?.value||'';if(!name||!email||password.length<6)return userStatus('Completa nombre, email y una contraseña de al menos 6 caracteres.',true);store.set(userNameCacheKey,name);userStatus('Creando usuario…');const {data,error}=await supabaseClient.auth.signUp({email,password,options:{data:{display_name:name,avatar_id:selectedAvatarId()},emailRedirectTo:location.origin+location.pathname+'#/user'}});if(error)return userStatus(error.message,true);if(data?.session){registeredUser=data.user;await loadRegisteredProfileAndMerge();renderUser()}else userStatus('Cuenta creada. Confirma el email recibido y después inicia sesión aquí.')}
async function loginUser(){if(!supabaseClient)return userStatus('Supabase no está disponible.',true);const email=$('#loginEmail')?.value.trim(),password=$('#loginPassword')?.value||'';if(!email||!password)return userStatus('Introduce email y password.',true);userStatus('Iniciando sesión…');const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)return userStatus(error.message,true);registeredUser=data.user;await loadRegisteredProfileAndMerge();renderUser();forcePageTop();requestAnimationFrame(forcePageTop)}
async function logoutUser(){if(!supabaseClient)return;await syncUserVault();await supabaseClient.auth.signOut();registeredUser=null;userProfile=null;updateUserChrome();renderUser()}
function localVaultSnapshot(){const state={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k||!k.startsWith('disturbing_'))continue;try{state[k]=JSON.parse(localStorage.getItem(k))}catch{state[k]=localStorage.getItem(k)}}return state}
function mergeVaultValue(remote,local,key=''){if(local==null)return remote;if(remote==null)return local;if(Array.isArray(remote)&&Array.isArray(local))return [...new Set([...remote,...local].map(x=>typeof x==='object'?JSON.stringify(x):x))].map(x=>typeof x==='string'&&/^[\[{]/.test(x)?(()=>{try{return JSON.parse(x)}catch{return x}})():x);if(typeof remote==='object'&&typeof local==='object'&&!Array.isArray(remote)&&!Array.isArray(local)){const out={...remote};for(const [k,v] of Object.entries(local))out[k]=mergeVaultValue(remote[k],v,k);return out}if(/progress/i.test(key)&&Number.isFinite(Number(remote))&&Number.isFinite(Number(local)))return Math.max(Number(remote),Number(local));return local}
function mergeVault(remote={},local={}){const out={...remote};for(const [k,v] of Object.entries(local))out[k]=mergeVaultValue(remote[k],v,k);return out}
function applyVault(vault){if(!vault||typeof vault!=='object')return;for(const [k,v] of Object.entries(vault)){if(!String(k).startsWith('disturbing_'))continue;localStorage.setItem(k,JSON.stringify(v))}ensureFreeAvatars()}
async function loadRegisteredProfileAndMerge(){if(!registeredUser||!supabaseClient||userSyncBusy)return;userSyncBusy=true;try{const [{data:profile,error:pe},{data:vaultRow,error:ve}]=await Promise.all([supabaseClient.from('profiles').select('*').eq('id',registeredUser.id).single(),supabaseClient.from('user_vaults').select('*').eq('user_id',registeredUser.id).single()]);if(pe)throw pe;if(ve)throw ve;userProfile=profile;if(userProfile?.display_name)store.set(userNameCacheKey,userProfile.display_name);const merged=mergeVault(vaultRow?.vault||{},localVaultSnapshot());applyVault(merged);const chosen=userProfile?.avatar_id||store.get(localAvatarKey,'avatar1');if(chosen)store.set(localAvatarKey,chosen);await supabaseClient.from('user_vaults').update({vault:localVaultSnapshot(),vault_schema:1,updated_at:new Date().toISOString()}).eq('user_id',registeredUser.id);await evaluateAvatarUnlocks(false);evaluateAchievements(false);updateUserChrome();if(routeName()==='user')renderUser()}catch(e){console.warn('User sync',e)}finally{userSyncBusy=false}}
let userSyncTimer=0;function queueUserVaultSync(){if(!registeredUser||!supabaseClient)return;clearTimeout(userSyncTimer);userSyncTimer=setTimeout(()=>syncUserVault(),650)}
async function syncUserVault(){if(!registeredUser||!supabaseClient||userSyncBusy)return;userSyncBusy=true;try{const {error}=await supabaseClient.from('user_vaults').update({vault:localVaultSnapshot(),vault_schema:1,updated_at:new Date().toISOString()}).eq('user_id',registeredUser.id);if(error)throw error}catch(e){console.warn('Automatic user sync',e)}finally{userSyncBusy=false}}
async function showAchievementReward(a){return new Promise(resolve=>{document.querySelector('.achievement-reward')?.remove();const el=document.createElement('div');el.className='achievement-reward';const n=Number(a?.number)||'',p=achievementRequirementProgress(a),sparks=Array.from({length:14},(_,i)=>`<i class="achievement-reward-spark" style="--spark-i:${i}"></i>`).join('');el.innerHTML=`<div class="achievement-reward-flash"></div><div class="achievement-reward-card"><button class="achievement-reward-close" aria-label="Cerrar">×</button><div class="achievement-reward-icon-stage" aria-hidden="true"><span class="achievement-reward-ring ring-a"></span><span class="achievement-reward-ring ring-b"></span>${sparks}<div class="achievement-reward-medal"><span class="achievement-reward-medal-star">★</span><span class="achievement-reward-gold-sweep"></span></div></div><small>${n?`LOGRO #${n}`:'NUEVO LOGRO'}</small><strong>RECOMPENSA OBTENIDA</strong><h3>${escapeHtml(a?.name||'LOGRO CONSEGUIDO')}</h3><em>${escapeHtml(a?.description||p.label)}</em></div>`;achievementOverlayHost().append(el);requestAnimationFrame(()=>el.classList.add('show'));if(!motionReduced())fiveFrameHaptic();let done=false;const close=()=>{if(done)return;done=true;el.classList.remove('show');setTimeout(()=>{el.remove();resolve()},280)};el.onclick=e=>{if(e.target===el||e.target.closest('.achievement-reward-close'))close()};setTimeout(close,motionReduced()?900:5200)})}
async function showStoryAchievementReward(a,meta){return new Promise(resolve=>{document.querySelector('.story-achievement-reward')?.remove();const el=document.createElement('div');el.className='story-achievement-reward';const poster=displayCover(meta),id=String(meta?.id||''),title=String(meta?.title||''),inGame=routeName()==='game'&&currentHash().split('/')[3]==='play',stayLabel=inGame?'SEGUIR EN EL GAME':'SEGUIR EN LA APP';el.innerHTML=`<div class="story-achievement-reward-flash" aria-hidden="true"></div><div class="story-achievement-reward-card"><button class="story-achievement-reward-close" type="button" aria-label="Cerrar">×</button>${poster?`<img class="story-achievement-reward-poster" src="${escAttr(poster)}" alt="">`:''}<small>STORY DESBLOQUEADA</small><strong>#${escapeHtml(id)}</strong><h3>${escapeHtml(title)}</h3><p>Has obtenido acceso permanente a esta Story exclusiva${a?.name?` por conseguir el logro ${escapeHtml(a.name)}`:''}.</p><div class="story-achievement-reward-actions"><button type="button" data-reward-stay>${stayLabel}</button><button type="button" data-reward-open>ABRIR STORY</button></div></div>`;achievementOverlayHost().append(el);requestAnimationFrame(()=>el.classList.add('show'));playUiSound('confirm');if(!motionReduced())fiveFrameHaptic();let done=false;const close=()=>{if(done)return;done=true;el.classList.remove('show');setTimeout(()=>{el.remove();resolve('stay')},260)};el.querySelector('[data-reward-stay]')?.addEventListener('click',close);el.querySelector('.story-achievement-reward-close')?.addEventListener('click',close);el.addEventListener('click',e=>{if(e.target===el)close()});el.querySelector('[data-reward-open]')?.addEventListener('click',async()=>{if(done)return;done=true;try{if(document.fullscreenElement)await document.exitFullscreen()}catch{}el.classList.remove('show');setTimeout(()=>el.remove(),180);suppressNewClearOnceId=id;go(`story/${encodeURIComponent(id)}`);resolve('open')})})}

function setupUnlockPageReveal(){const page=document.querySelector('.unlock-panel.section');if(!page)return;page.classList.add('unlock-page-reveal-ready');const items=[...page.children];items.forEach((el,i)=>el.style.setProperty('--unlock-item-i',i));requestAnimationFrame(()=>requestAnimationFrame(()=>page.classList.add('unlock-page-reveal-in')))}
function renderUnlockRoute(){showUnlock();setupUnlockPageReveal()}
async function showAvatarReward(a){const seen=new Set(store.get(avatarRewardSeenKey,[]));if(seen.has(a.id))return;seen.add(a.id);store.set(avatarRewardSeenKey,[...seen]);return new Promise(resolve=>{document.querySelector('.avatar-reward')?.remove();const el=document.createElement('div');el.className='avatar-reward';const name=avatarDisplayName(a);el.innerHTML=`<div class="avatar-reward-card"><button class="avatar-reward-close" aria-label="Cerrar">×</button>${avatarImg(a,'avatar-reward-img')}<small>RECOMPENSA</small><strong>NUEVO AVATAR DESBLOQUEADO</strong>${name?`<em>${escapeHtml(name)}</em>`:''}</div>`;document.body.append(el);requestAnimationFrame(()=>el.classList.add('show'));const close=()=>{el.classList.remove('show');setTimeout(()=>{el.remove();resolve()},260)};el.onclick=e=>{if(e.target===el||e.target.closest('.avatar-reward-close'))close()};setTimeout(close,5200)})}

// v6.2 · Sistema de TUTORIALES. TUTORIAL 1: PRIMER CONTACTO.
// La UI de TK usa WebM normales dentro de una ventana propia (sin alpha obligatorio).
// Posición, tamaño y escala son configurables por paso mediante TUTORIAL1_STEPS.
const TUTORIAL1_STEPS=[
  {step:1,route:'home',title:'BIENVENID@',text:'Bienvenid@ a Disturbing Stories App. Aquí podrás leer, explorar y descubrir todo el universo de Disturbing Stories.',tk:'tk_t01_p01.webm',tkLayout:'square',composition:'center-tk-text',tkPlacement:{desktop:{width:'380px',height:'380px'},mobile:{width:'284px',height:'284px'}},bubblePlacement:{desktop:{width:'390px'},mobile:{width:'calc(100vw - 28px)'}},dim:.66},
  {step:2,route:'home',title:'TODAS LAS STORIES',text:'Empieza aquí. En TODAS LAS STORIES encontrarás todas las Stories publicadas.',tk:'tk_t01_p02.webm',tkLayout:'vertical',target:'.nav-btn[data-route="stories"]',composition:'target-stack',focusStrong:true,liftTarget:true,tkPlacement:{desktop:{width:'300px',height:'460px'},mobile:{width:'236px',height:'356px'}},bubblePlacement:{desktop:{width:'390px'},mobile:{width:'calc(100vw - 28px)'}},dim:.70},
  {step:3,route:'stories',title:'PÚBLICAS Y EXCLUSIVAS',text:'Algunas Stories puedes leerlas directamente. Otras son exclusivas y aparecerán bloqueadas.',tk:'tk_t01_p03.webm',tkLayout:'horizontal',composition:'center-stack-lock',tkPlacement:{desktop:{width:'410px',height:'218px'},mobile:{width:'calc(100vw - 32px)',height:'174px'}},bubblePlacement:{desktop:{width:'410px'},mobile:{width:'calc(100vw - 32px)'}},lockMode:'locked',ambientScroll:'start',dim:.54},
  {step:4,route:'stories',title:'DESBLOQUEO POR QR',text:'Cada Story exclusiva tiene su propio QR. Lo encontrarás junto a esa Story en uno de los libros físicos de Disturbing Stories. Escanéalo y quedará desbloqueada.',micro:'1 QR = 1 STORY',tk:'tk_t01_p04.webm',tkLayout:'horizontal',composition:'center-stack-lock',tkPlacement:{desktop:{width:'430px',height:'228px'},mobile:{width:'calc(100vw - 32px)',height:'180px'}},bubblePlacement:{desktop:{width:'430px'},mobile:{width:'calc(100vw - 32px)'}},lockMode:'unlock',unlockDelay:3700,ambientScroll:'continue',dim:.54},
  {step:5,route:'stories',title:'YA PUEDES EMPEZAR',text:'Eso es todo lo que necesitas para empezar.',secondary:'Puedes descubrir el resto cuando quieras.',tk:'tk_t01_p05.webm',tkLayout:'horizontal',composition:'center-tk-text-final',tkPlacement:{desktop:{width:'340px',height:'180px'},mobile:{width:'270px',height:'144px'}},bubblePlacement:{desktop:{width:'450px'},mobile:{width:'calc(100vw - 28px)'}},ambientScroll:'finish',dim:.62}
];
let tutorialTimers=[],tutorialScrollRaf=0,tutorialScrollLast=0,tutorialScrollSpeed=12,tutorialReturnRaf=0,tutorialResizeHandler=null,tutorialAutoScheduled=false;
function tutorialState(){const raw=store.get(tutorialStateKey,{});return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}}
function tutorialInfo(id='tutorial1'){return tutorialState()[id]||{}}
function updateTutorialInfo(id,patch){const all=tutorialState();all[id]={...(all[id]||{}),...patch};store.set(tutorialStateKey,all);return all[id]}
function tutorialViewed(id='tutorial1'){return tutorialInfo(id).viewed===true}
function markTutorialViewed(id='tutorial1'){if(tutorialViewed(id))return;updateTutorialInfo(id,{viewed:true,viewedAt:new Date().toISOString()})}
function clearTutorialTimers(){for(const t of tutorialTimers)clearTimeout(t);tutorialTimers=[]}
function tutorialLater(fn,ms){const t=setTimeout(fn,ms);tutorialTimers.push(t);return t}
function tutorialReducedMotion(){try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}}
function tutorialDevicePlacement(cfg){if(!cfg)return{};return innerWidth<=600?(cfg.mobile||cfg.desktop||{}):(cfg.desktop||cfg.mobile||{})}
function applyTutorialPlacement(el,cfg){if(!el)return;el.removeAttribute('style');const p=tutorialDevicePlacement(cfg);for(const [k,v] of Object.entries(p||{})){if(k==='scale'){el.style.setProperty('--tutorial-scale',String(v));continue}if(k==='translateX'){el.style.setProperty('--tutorial-translate-x',String(v));continue}if(v!=null)el.style[k]=String(v)}}
function tutorialScrollElement(){return document.scrollingElement||document.documentElement}
function tutorialSetScroll(y){const el=tutorialScrollElement();const v=Math.max(0,Number(y)||0);el.scrollTop=v;if(document.body&&document.body!==el)document.body.scrollTop=v}
function stopTutorialStoryScroll(){if(tutorialScrollRaf)cancelAnimationFrame(tutorialScrollRaf);tutorialScrollRaf=0;tutorialScrollLast=0;if(tutorialReturnRaf)cancelAnimationFrame(tutorialReturnRaf);tutorialReturnRaf=0}
function tutorialMaxScroll(){const el=tutorialScrollElement();return Math.max(0,el.scrollHeight-innerHeight)}
function tutorialStoriesStartTop(){const list=document.querySelector('#storiesList'),header=document.querySelector('.topbar');if(!list)return 0;const headerH=header?.getBoundingClientRect().height||70;return Math.max(0,tutorialScrollElement().scrollTop+list.getBoundingClientRect().top-headerH-8)}
function startTutorialStoryScroll(reset=false){if(tutorialReducedMotion())return;if(tutorialReturnRaf){cancelAnimationFrame(tutorialReturnRaf);tutorialReturnRaf=0}if(reset)tutorialSetScroll(tutorialStoriesStartTop());if(tutorialScrollRaf)return;tutorialScrollLast=performance.now();tutorialScrollSpeed=innerWidth<=600?30:38;const tick=now=>{if(!tutorialActive||![3,4].includes(tutorialActive.step)||routeName()!=='stories'){tutorialScrollRaf=0;return}const dt=Math.min(.05,Math.max(0,(now-tutorialScrollLast)/1000));tutorialScrollLast=now;const el=tutorialScrollElement(),max=tutorialMaxScroll();if(el.scrollTop<max-2)tutorialSetScroll(Math.min(max,el.scrollTop+tutorialScrollSpeed*dt));tutorialScrollRaf=requestAnimationFrame(tick)};tutorialScrollRaf=requestAnimationFrame(tick)}
function animateTutorialScrollTo(target,duration=2000){if(tutorialReturnRaf)cancelAnimationFrame(tutorialReturnRaf);const el=tutorialScrollElement(),start=el.scrollTop,delta=target-start,t0=performance.now();return new Promise(resolve=>{const tick=now=>{if(!tutorialActive||tutorialActive.step!==5){tutorialReturnRaf=0;resolve();return}const p=Math.min(1,(now-t0)/duration),e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;tutorialSetScroll(start+delta*e);if(p<1)tutorialReturnRaf=requestAnimationFrame(tick);else{tutorialReturnRaf=0;resolve()}};tutorialReturnRaf=requestAnimationFrame(tick)})}
function finishTutorialStoryScroll(){if(tutorialReducedMotion()){stopTutorialStoryScroll();tutorialSetScroll(0);return}if(tutorialScrollRaf)cancelAnimationFrame(tutorialScrollRaf);tutorialScrollRaf=0;const el=tutorialScrollElement(),start=performance.now(),v0=tutorialScrollSpeed||30,last={t:start};const brake=now=>{if(!tutorialActive||tutorialActive.step!==5)return;const p=Math.min(1,(now-start)/800),dt=Math.min(.05,(now-last.t)/1000);last.t=now;const velocity=v0*Math.pow(1-p,2),max=tutorialMaxScroll();if(el.scrollTop<max-1)tutorialSetScroll(Math.min(max,el.scrollTop+velocity*dt));if(p<1)requestAnimationFrame(brake);else tutorialLater(()=>{if(tutorialActive?.step===5)animateTutorialScrollTo(0,2000)},2000)};requestAnimationFrame(brake)}
function tutorialLockMarkup(mode){if(!mode)return'';if(mode==='unlock')return `<div class="tutorial-lock-stage tutorial-lock-unlock" aria-label="Story desbloqueándose"><span class="tutorial-lock-icon tutorial-lock-red">${lockSvg(false)}</span><span class="tutorial-lock-flash" aria-hidden="true"></span><span class="tutorial-lock-icon tutorial-lock-green">${lockSvg(true)}</span></div>`;return `<div class="tutorial-lock-stage tutorial-lock-locked" aria-label="Story bloqueada"><span class="tutorial-lock-icon tutorial-lock-red">${lockSvg(false)}</span></div>`}
function tutorialButtonMarkup(step){if(step===1)return `<div class="tutorial-controls tutorial-controls-first"><button type="button" class="tutorial-next" data-tutorial-next>SIGUIENTE</button></div>`;if(step===5)return `<div class="tutorial-controls tutorial-controls-final"><button type="button" class="tutorial-back tutorial-nav-box" data-tutorial-back>ATRÁS</button><div class="tutorial-final-actions"><button type="button" class="tutorial-start" data-tutorial-start>EMPEZAR</button><button type="button" class="tutorial-more" data-tutorial-more>¿QUIERES SABER MÁS?</button></div></div>`;return `<div class="tutorial-controls tutorial-controls-nav"><button type="button" class="tutorial-back tutorial-nav-box" data-tutorial-back>ATRÁS</button><button type="button" class="tutorial-next tutorial-nav-box" data-tutorial-next>SIGUIENTE</button></div>`}
function tutorialOverlayHtml(cfg){return `<div id="tutorialOverlay" class="tutorial-overlay-v61 tutorial-step-${cfg.step}${cfg.focusStrong?' tutorial-has-strong-focus':''}" style="--tutorial-dim:${cfg.dim??.64}"><div class="tutorial-dim-v61"></div><div class="tutorial-focus-ring-v61 hidden" aria-hidden="true"></div><div class="tutorial-tk-stage-v61 tutorial-tk-${cfg.tkLayout||'square'}"><div class="tutorial-tk-card"><video src="./assets/tutorials/tk/${escAttr(cfg.tk)}?v=${encodeURIComponent(APP_VERSION)}" autoplay muted loop playsinline preload="auto" aria-label="T.K." onerror="this.classList.add('missing')"></video><div class="tutorial-tk-fallback" aria-hidden="true"><span>TK</span></div></div></div>${tutorialLockMarkup(cfg.lockMode)}<section class="tutorial-bubble-v61" role="dialog" aria-modal="true" aria-label="Tutorial · ${escAttr(cfg.title)}"><button type="button" class="tutorial-close-v61" data-tutorial-close aria-label="Cerrar tutorial">×</button><div class="tutorial-step-label"><i aria-hidden="true"></i>PASO ${cfg.step}/5</div><h2>${escapeHtml(cfg.title)}</h2><p class="tutorial-main-text">${escapeHtml(cfg.text)}</p>${cfg.secondary?`<p class="tutorial-secondary-text">${escapeHtml(cfg.secondary)}</p>`:''}${cfg.micro?`<div class="tutorial-micro-rule">${escapeHtml(cfg.micro)}</div>`:''}${tutorialButtonMarkup(cfg.step)}</section></div>`}
function positionTutorialTargetClone(targetSelector,enabled=false){const overlay=$('#tutorialOverlay');if(!overlay)return;overlay.querySelector('.tutorial-target-clone-v62')?.remove();if(!enabled||!targetSelector)return;const target=document.querySelector(targetSelector);if(!target)return;const r=target.getBoundingClientRect(),clone=target.cloneNode(true);clone.classList.add('tutorial-target-clone-v62');clone.removeAttribute('id');clone.removeAttribute('data-route');clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));Object.assign(clone.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});overlay.append(clone)}
function positionTutorialFocus(targetSelector,strong=false){const ring=$('.tutorial-focus-ring-v61');if(!ring)return;ring.classList.toggle('is-strong',!!strong);if(!targetSelector){ring.classList.add('hidden');return}const target=document.querySelector(targetSelector);if(!target){ring.classList.add('hidden');return}const r=target.getBoundingClientRect(),pad=strong?9:7;ring.classList.remove('hidden');ring.style.left=`${Math.max(5,r.left-pad)}px`;ring.style.top=`${Math.max(5,r.top-pad)}px`;ring.style.width=`${Math.min(innerWidth-10,r.width+pad*2)}px`;ring.style.height=`${r.height+pad*2}px`;ring.style.borderRadius=(parseFloat(getComputedStyle(target).borderRadius)||10)+pad+'px'}
function tutorialClamp(v,min,max){return Math.max(min,Math.min(max,v))}
function tutorialSetBox(el,left,top){if(!el)return;el.style.left=`${Math.round(left)}px`;el.style.top=`${Math.round(top)}px`;el.style.right='auto';el.style.bottom='auto';el.style.transform='none'}
function tutorialCenterX(el){return (innerWidth-el.getBoundingClientRect().width)/2}
function positionTutorialLock(cfg){const lock=$('.tutorial-lock-stage');if(!lock)return;const tk=$('.tutorial-tk-stage-v61');if(tk){const r=tk.getBoundingClientRect(),size=Math.max(112,Math.min(240,Math.min(r.width||150,r.height||150)));lock.style.setProperty('--tutorial-lock-size',`${size}px`)}}
function positionTutorialComposition(cfg){const tk=$('.tutorial-tk-stage-v61'),bubble=$('.tutorial-bubble-v61'),lock=$('.tutorial-lock-stage');if(!tk||!bubble)return;const gap=12,edge=12;if(cfg.composition==='center-tk-text'){const tr=tk.getBoundingClientRect(),br=bubble.getBoundingClientRect();tutorialSetBox(tk,(innerWidth-tr.width)/2,(innerHeight-tr.height)/2);const fresh=tk.getBoundingClientRect();tutorialSetBox(bubble,tutorialClamp((innerWidth-br.width)/2,edge,innerWidth-br.width-edge),fresh.bottom+gap);return}if(cfg.composition==='target-stack'){const target=document.querySelector(cfg.target),tr=tk.getBoundingClientRect(),br=bubble.getBoundingClientRect();if(!target)return;const rr=target.getBoundingClientRect(),desiredBottom=rr.top-16,bTop=desiredBottom-br.height,tTop=bTop-gap-tr.height,groupShift=tTop<edge?edge-tTop:0;tutorialSetBox(tk,tutorialClamp((innerWidth-tr.width)/2,edge,innerWidth-tr.width-edge),tTop+groupShift);tutorialSetBox(bubble,tutorialClamp((innerWidth-br.width)/2,edge,innerWidth-br.width-edge),bTop+groupShift);return}if(cfg.composition==='center-stack-lock'&&lock){const tr=tk.getBoundingClientRect(),br=bubble.getBoundingClientRect(),lr=lock.getBoundingClientRect(),total=lr.height+gap+tr.height+gap+br.height,top=Math.max(edge,(innerHeight-total)/2);tutorialSetBox(lock,(innerWidth-lr.width)/2,top);tutorialSetBox(tk,(innerWidth-tr.width)/2,top+lr.height+gap);tutorialSetBox(bubble,tutorialClamp((innerWidth-br.width)/2,edge,innerWidth-br.width-edge),top+lr.height+gap+tr.height+gap);return}if(cfg.composition==='center-tk-text-final'){const tr=tk.getBoundingClientRect(),br=bubble.getBoundingClientRect(),total=tr.height+gap+br.height,top=Math.max(edge,(innerHeight-total)/2);tutorialSetBox(tk,(innerWidth-tr.width)/2,top);tutorialSetBox(bubble,tutorialClamp((innerWidth-br.width)/2,edge,innerWidth-br.width-edge),top+tr.height+gap)}}
function placeTutorialElements(cfg){applyTutorialPlacement($('.tutorial-tk-stage-v61'),cfg.tkPlacement);applyTutorialPlacement($('.tutorial-bubble-v61'),cfg.bubblePlacement);positionTutorialLock(cfg);positionTutorialFocus(cfg.target,cfg.focusStrong);positionTutorialTargetClone(cfg.target,cfg.liftTarget);requestAnimationFrame(()=>positionTutorialComposition(cfg))}
function destroyTutorialOverlay({keepScroll=false}={}){clearTutorialTimers();document.querySelector('#tutorialOverlay')?.remove();if(tutorialResizeHandler){removeEventListener('resize',tutorialResizeHandler);tutorialResizeHandler=null}if(!keepScroll)stopTutorialStoryScroll()}
function renderTutorialStep(){if(!tutorialActive||tutorialActive.id!=='tutorial1')return;const cfg=TUTORIAL1_STEPS[tutorialActive.step-1];if(!cfg)return;destroyTutorialOverlay({keepScroll:[3,4].includes(tutorialActive.step)});const host=document.createElement('div');host.innerHTML=tutorialOverlayHtml(cfg);document.body.append(host.firstElementChild);requestAnimationFrame(()=>{placeTutorialElements(cfg);requestAnimationFrame(()=>$('#tutorialOverlay')?.classList.add('is-visible'))});tutorialResizeHandler=()=>placeTutorialElements(cfg);addEventListener('resize',tutorialResizeHandler,{passive:true});$('[data-tutorial-close]')?.addEventListener('click',()=>closeTutorial1());$('[data-tutorial-next]')?.addEventListener('click',()=>moveTutorial1(1));$('[data-tutorial-back]')?.addEventListener('click',()=>moveTutorial1(-1));$('[data-tutorial-start]')?.addEventListener('click',()=>finishTutorial1('start'));$('[data-tutorial-more]')?.addEventListener('click',()=>finishTutorial1('more'));if(cfg.ambientScroll==='start')tutorialLater(()=>startTutorialStoryScroll(true),120);else if(cfg.ambientScroll==='continue')tutorialLater(()=>startTutorialStoryScroll(false),80);else if(cfg.ambientScroll==='finish')tutorialLater(()=>finishTutorialStoryScroll(),80);if(cfg.lockMode==='unlock')tutorialLater(()=>$('.tutorial-lock-stage')?.classList.add('is-unlocked'),tutorialReducedMotion()?40:(cfg.unlockDelay||3700))}
function waitTutorialRoute(route,cb){const started=performance.now();const tick=()=>{if(!tutorialActive)return;if(routeName()===route&&view.firstElementChild){requestAnimationFrame(()=>requestAnimationFrame(cb));return}if(performance.now()-started<2200)requestAnimationFrame(tick);else cb()};requestAnimationFrame(tick)}
function showTutorialStep(step){if(!tutorialActive)return;const cfg=TUTORIAL1_STEPS[step-1];if(!cfg)return;tutorialActive.step=step;const current=routeName();if(current===cfg.route){renderTutorialStep();return}destroyTutorialOverlay({keepScroll:false});const target=`#/${cfg.route}`;if(currentHash()!==target)navigateHash(target);else routeFromHash();waitTutorialRoute(cfg.route,renderTutorialStep)}
function moveTutorial1(delta){if(!tutorialActive)return;const next=Math.max(1,Math.min(5,tutorialActive.step+delta));if(next===tutorialActive.step)return;showTutorialStep(next)}
function startTutorial1({manual=false}={}){if(tutorialActive)return;tutorialAutoScheduled=false;tutorialActive={id:'tutorial1',step:1,manual:!!manual};if(!manual)updateTutorialInfo('tutorial1',{autoShown:true,autoShownAt:new Date().toISOString()});showTutorialStep(1)}
function closeTutorial1(){if(!tutorialActive)return;const viewed=tutorialActive.step>=5;if(viewed)markTutorialViewed('tutorial1');tutorialActive=null;destroyTutorialOverlay()}
function finishTutorial1(action='start'){if(!tutorialActive)return;markTutorialViewed('tutorial1');tutorialActive=null;destroyTutorialOverlay();if(action==='more'){if(currentHash()!=='#/tutorials')navigateHash('#/tutorials');else renderTutorials()}}
function renderTutorials(){currentStory=null;const seen=tutorialViewed('tutorial1');view.innerHTML=`<section class="section tutorials-page-v61"><div class="section-title"><div><div class="eyebrow">GUÍA DE LA APP</div><h1>Tutoriales</h1></div></div><p class="tutorials-copy-v61">Elige el tutorial que quieras ver. Puedes repetirlos tantas veces como necesites.</p><div class="tutorial-list-v61"><button type="button" data-start-tutorial="tutorial1"><span class="tutorial-list-number">01</span><span class="tutorial-list-copy"><strong>PRIMER CONTACTO</strong><small>Lo esencial para empezar a explorar Disturbing Stories App.</small></span>${seen?'<em class="tutorial-viewed-badge">VISTO</em>':'<em class="tutorial-new-badge">VER</em>'}</button></div></section>`;$('[data-start-tutorial="tutorial1"]')?.addEventListener('click',()=>startTutorial1({manual:true}))}
function maybeAutoTutorial(context=''){if(context!=='home'||tutorialActive||tutorialAutoScheduled)return;const info=tutorialInfo('tutorial1');if(info.autoShown===true)return;tutorialAutoScheduled=true;setTimeout(()=>{if(routeName()==='home'&&!tutorialActive)startTutorial1({manual:false});else tutorialAutoScheduled=false},900)}


function microReadList(){return store.get(microReadKey,[]).map(String)}
function isMicroRead(id){return microReadList().includes(String(id).padStart(3,'0'))}
function markMicroRead(id){id=String(id||'').padStart(3,'0');const a=microReadList();if(a.includes(id))return false;a.push(id);store.set(microReadKey,a);refreshMicroReadUI(id,true);celebrateMicroRead(id);queueUserVaultSync();return true}
function markMicroUnread(id){id=String(id||'').padStart(3,'0');const before=microReadList(),a=before.filter(x=>x!==id);if(a.length===before.length)return false;store.set(microReadKey,a);refreshMicroReadUI(id,false);queueUserVaultSync();return true}
function refreshMicroReadUI(id,read){const pill=$('#microReadPill');if(pill)pill.classList.toggle('hidden',!read);const rb=$('#microMarkRead'),ub=$('#microMarkUnread');if(rb){rb.textContent=read?'✓ LEÍDA':'MARCAR COMO LEÍDA';rb.disabled=read;rb.classList.toggle('is-read',read)}if(ub)ub.classList.toggle('hidden',!read)}
function microRelationLabel(kind){return({prequel:'PRECUELA',sequel:'SECUELA',same_universe:'MISMO UNIVERSO',parallel_story:'HISTORIA PARALELA',character:'PERSONAJE',place:'LUGAR',event:'EVENTO',other:'OTRA RELACIÓN'})[String(kind||'')]||'RELACIONADA'}
function microMeta(id){id=String(id||'').padStart(3,'0');return (microsData?.items||[]).find(x=>String(x.id||x.number||'').padStart(3,'0')===id)||null}
function microCover(m){return String(m?.cover||'').trim()}
function microCardHtml(m){const id=String(m.id||m.number||'').padStart(3,'0'),read=isMicroRead(id),cover=microCover(m);return `<article class="micro-card" data-micro-id="${escAttr(id)}"><div class="micro-card-cover">${cover?`<img src="${escAttr(cover)}" alt="${escAttr(m.title||('Micro-Pesadilla '+id))}" loading="lazy" referrerpolicy="no-referrer">`:`<span>#${escapeHtml(id)}</span>`}${read?'<b class="micro-card-read">✓ LEÍDA</b>':''}</div><div class="micro-card-copy"><div class="story-number">#${escapeHtml(id)}</div><h3>${escapeHtml(m.title||'')}</h3>${m.relatedStoryId&&(String(m.relationVisibility||'always')!=='after_read'||isRead(String(m.relatedStoryId)))?`<small>${escapeHtml(microRelationLabel(m.relation))} · STORY ${escapeHtml(m.relatedStoryId)}</small>`:''}</div></article>`}
function runCatalogSelectFx(el,done){if(!el||typeof done!=='function')return;if(motionReduced()){done();return}if(el.dataset.selecting==='1')return;el.dataset.selecting='1';el.classList.add('is-selecting');setTimeout(()=>done(),220)}
function bindMicroCards(){$$('[data-micro-id]').forEach(el=>el.onclick=()=>runCatalogSelectFx(el,()=>go(`micro/${encodeURIComponent(el.dataset.microId)}`)))}
function microIntroHtml(){const logo=PUBLIC_APP_ASSET_BASE+'logomicros.png?v='+encodeURIComponent(String(microsData?.logoVersion||APP_VERSION)),badgeText=String(microsData?.headerBadgeText||'NEW').trim(),badge=(microsData?.headerBadgeVisible===true&&badgeText)?`<span class="micro-header-custom-badge">${escapeHtml(badgeText)}</span>`:'';return `<div class="micro-title"><div class="micro-title-media micro-title-homefx"><img class="micro-home-backdrop" src="${escAttr(logo)}" alt="" aria-hidden="true" loading="eager" referrerpolicy="no-referrer"><img class="micro-home-rgb micro-home-rgb-red" src="${escAttr(logo)}" alt="" aria-hidden="true" loading="eager" referrerpolicy="no-referrer"><img class="micro-home-rgb micro-home-rgb-cyan" src="${escAttr(logo)}" alt="" aria-hidden="true" loading="eager" referrerpolicy="no-referrer"><img class="micro-title-logo micro-home-main" src="${escAttr(logo)}" alt="Micro-Pesadillas" loading="eager" referrerpolicy="no-referrer"><div class="home-signal-fx" aria-hidden="true"><span class="signal-darken"></span><span class="signal-scanlines"></span><span class="signal-noise"></span><span class="signal-tracking"></span><span class="signal-ghost signal-ghost-red"></span><span class="signal-ghost signal-ghost-cold"></span><span class="signal-slice signal-slice-a"></span><span class="signal-slice signal-slice-b"></span><span class="signal-red-pulse"></span><span class="signal-vignette"></span></div>${badge}</div><div class="micro-intro-panel" id="microIntroPanel" role="button" tabindex="0" aria-expanded="false" aria-controls="microIntroMore" aria-label="Mostrar información completa"><p class="micro-intro-lead">Conoce una nueva subespecie de Disturbing Stories:</p><div id="microIntroMore" class="micro-intro-more"><strong>¡LAS MICRO-PESADILLAS!</strong><p>Relatos muy breves de terror y ciencia ficción que puedes leer en apenas un par de minutos.</p><strong>¡Descubre nuevas maneras de sorprenderte!</strong><p>Conoce nuevos horrores… y vuelve a encontrarte con viejos conocidos del universo de Disturbing Stories.</p><p>Las Micro-Pesadillas tienen su propia numeración, pero…</p><strong>¡CUIDADO!</strong><strong>¡PUEDEN APARECER EN CUALQUIER MOMENTO!</strong><p class="micro-exclusive-lead">Y recuerda: el hábitat exclusivo de las <b>MICRO-PESADILLAS</b> es</p><strong class="micro-app-name">DISTURBING STORIES APP</strong><img class="micro-app-icon" src="${escAttr(PUBLIC_APP_ASSET_BASE+'app-icon.png')}" alt="Icono Disturbing Stories App" loading="lazy" referrerpolicy="no-referrer"><strong class="micro-exclusive-final">¡SOLO PODRÁS LEERLAS AQUÍ!</strong></div><div id="microIntroToggle" class="micro-intro-toggle" aria-hidden="true"><span class="micro-intro-chevron"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></span></div></div></div>`}
function bindMicroIntroToggle(){const panel=$('#microIntroPanel');if(!panel)return;const toggle=()=>{const open=panel.classList.toggle('expanded');panel.setAttribute('aria-expanded',open?'true':'false');panel.setAttribute('aria-label',open?'Ocultar información':'Mostrar información completa')};panel.onclick=toggle;panel.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}}}
function animateMicroReadCounter(target){const el=$('#microReadCount');if(!el)return;target=Math.max(0,Number(target)||0);if(motionReduced()){el.textContent=String(target);return}let frame=0;const totalFrames=35;el.textContent='0';const tick=()=>{frame++;el.textContent=String(Math.round(target*Math.min(1,frame/totalFrames)));if(frame<totalFrames)requestAnimationFrame(tick)};requestAnimationFrame(tick)}
function renderMicroCatalog(){currentStory=null;currentMicro=null;scrollTo({top:0,behavior:'auto'});const all=[...(microsData?.items||[])].sort((a,b)=>Number(a.number||a.id)-Number(b.number||b.id)),reads=new Set(microReadList()),readCount=all.filter(x=>reads.has(String(x.id||x.number).padStart(3,'0'))).length;let filter='all';const draw=()=>{let rows=all;if(filter==='unread')rows=all.filter(x=>!reads.has(String(x.id||x.number).padStart(3,'0')));if(filter==='read')rows=all.filter(x=>reads.has(String(x.id||x.number).padStart(3,'0')));const box=$('#microCatalogGrid');if(box)box.innerHTML=rows.length?rows.map(microCardHtml).join(''):'<div class="empty">No hay Micro-Pesadillas en este filtro.</div>';$$('[data-micro-filter]').forEach(b=>b.classList.toggle('active',b.dataset.microFilter===filter));bindMicroCards();bindBrokenImages();try{const hi=sessionStorage.getItem('ds_highlight_micro');if(hi){const card=document.querySelector(`[data-micro-id="${CSS.escape(hi)}"]`);if(card){card.classList.add('micro-home-highlight');card.scrollIntoView({behavior:motionReduced()?'auto':'smooth',block:'center'});if(!card.querySelector('.micro-home-new'))card.insertAdjacentHTML('afterbegin','<span class="micro-home-new">NEW</span>')}sessionStorage.removeItem('ds_highlight_micro')}}catch{}};view.innerHTML=`<section class="section micro-section">${microIntroHtml()}<div class="micro-stats"><div><strong>${all.length}</strong><span>PUBLICADAS</span></div><div><strong id="microReadCount">0</strong><span>LEÍDAS</span></div></div><div class="micro-filters"><button class="active" data-micro-filter="all">TODAS</button><button data-micro-filter="unread">NO LEÍDAS</button><button data-micro-filter="read">LEÍDAS</button></div><div id="microCatalogGrid" class="micro-grid"></div></section>`;$$('[data-micro-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.microFilter;draw()});bindMicroIntroToggle();bindBrokenImages();draw();animateMicroReadCounter(readCount)}
async function loadMicroData(meta){const url=String(meta?.data||`./data/micropesadillas/${String(meta?.id||meta?.number||'').padStart(3,'0')}.json`);const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}
function microTextHtml(text){return String(text||'').trim().split(/\n\s*\n+/).filter(Boolean).map(p=>`<p>${escapeHtml(p).replace(/\n/g,'<br>')}</p>`).join('')}
function microStoryRelationHtml(m){const rel=m?.relatedStory;if(!rel?.storyId)return'';if(String(rel.visibility||'always')==='after_read'&&!isRead(String(rel.storyId)))return'';const st=indexData?.stories?.find(x=>String(x.id)===String(rel.storyId));if(!st)return'';const cover=displayCover(st);return `<section class="micro-story-link"><div class="eyebrow">STORY RELACIONADA</div><div class="micro-relation-type">${escapeHtml(microRelationLabel(rel.relation))}</div><button type="button" data-micro-story="${escAttr(st.id)}">${cover?`<img src="${escAttr(cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<span><b>STORY ${escapeHtml(st.id)}</b><strong>${escapeHtml(st.title||'')}</strong>${st.access==='exclusive'&&isLocked(st)?'<small>EXCLUSIVA · BLOQUEADA</small>':''}</span><em>›</em></button></section>`}
function microContentBlocksHtml(m){return (m?.contentBlocks||[]).map(b=>b?.type==='text'?`<div class="micro-text-block">${microTextHtml(b.text)}</div>`:b?.type==='image'&&b.src?`<figure class="micro-image-block"><img src="${escAttr(b.src)}" alt="${escAttr(b.alt||'')}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></figure>`:'').join('')}
function microDocumentHtml(m,{preview=false}={}){const id=String(m?.id||m?.number||'').padStart(3,'0'),read=!preview&&isMicroRead(id),cover=microCover(m),year=String(m?.fictionYear||'').trim();return `<section class="micro-detail ${preview?'is-preview':''}" data-micro-current="${escAttr(id)}"><header class="micro-detail-head"><div class="story-number">#${escapeHtml(id)}</div><h1>${escapeHtml(m?.title||'SIN TÍTULO')}</h1><div class="meta-row">${m?.publicationDate?`<span class="pill">${formatDate(m.publicationDate)}</span>`:''}${year?`<span class="pill">AÑO ${escapeHtml(year)}</span>`:''}<span id="microReadPill" class="pill read-pill ${read?'':'hidden'}">✓ LEÍDA</span></div></header>${cover?`<figure class="micro-cover"><img src="${escAttr(cover)}" alt="Portada ${escAttr(m?.title||'Micro-Pesadilla')}" loading="eager"></figure>`:''}<div class="story-manual-read-row micro-read-controls"><button id="microMarkUnread" class="story-manual-read-btn story-manual-unread-btn ${read?'':'hidden'}" type="button">MARCAR COMO NO LEÍDA</button><button id="microMarkRead" class="story-manual-read-btn ${read?'is-read':''}" type="button" ${read?'disabled':''}>${read?'✓ LEÍDA':'MARCAR COMO LEÍDA'}</button></div><article id="microReader" class="reader micro-reader">${microContentBlocksHtml(m)}</article>${microStoryRelationHtml(m)}</section>`}
function celebrateMicroRead(id){playUiSound('confirm');const total=(microsData?.items||[]).length,count=microReadList().filter(x=>(microsData?.items||[]).some(m=>String(m.id||m.number||'').padStart(3,'0')===String(x).padStart(3,'0'))).length;document.querySelector('.read-celebration')?.remove();const el=document.createElement('div');el.className='read-celebration micro-read-celebration';const sparks=Array.from({length:12},(_,i)=>`<i class="micro-read-spark" style="--micro-spark:${i}"></i>`).join('');el.innerHTML=`<div class="micro-read-light-flash" aria-hidden="true"></div><button class="read-celebration-close" type="button" aria-label="Cerrar">×</button><div class="micro-read-icon-stage" aria-hidden="true"><span class="micro-read-ring ring-a"></span><span class="micro-read-ring ring-b"></span>${sparks}<div class="read-check">✓<i class="micro-read-sweep"></i></div></div><div class="eyebrow">MICRO-PESADILLA #${escapeHtml(id)}</div><strong>LEÍDA</strong><small>${count} / ${total} Micro-Pesadillas publicadas</small>`;document.body.append(el);let timer;const close=()=>{clearTimeout(timer);el.classList.remove('show');setTimeout(()=>el.remove(),260)};el.querySelector('.read-celebration-close').onclick=close;setTimeout(()=>el.classList.add('show'),20);if(!motionReduced())fiveFrameHaptic();timer=setTimeout(close,3200)}
function bindMicroDetail(m,{preview=false}={}){bindBrokenImages();$$('.micro-image-block img').forEach(img=>img.onclick=()=>openLightbox(img.src,img.alt));$$('[data-micro-story]').forEach(b=>b.onclick=()=>storyGo(b.dataset.microStory,false,b));if(preview)return;const id=String(m.id||m.number||'').padStart(3,'0'),rb=$('#microMarkRead'),ub=$('#microMarkUnread');if(rb)rb.onclick=()=>markMicroRead(id);if(ub)ub.onclick=()=>markMicroUnread(id);requestAnimationFrame(updateMicroProgress)}
async function renderMicroDetail(id){currentStory=null;currentMicro=null;id=String(id||'').padStart(3,'0');const meta=microMeta(id);if(!meta){view.innerHTML='<div class="empty">Micro-Pesadilla no encontrada.</div>';return}showLoading();try{currentMicro={...meta,...await loadMicroData(meta)};view.innerHTML=microDocumentHtml(currentMicro);bindMicroDetail(currentMicro)}catch(e){view.innerHTML=`<div class="empty"><h2>Error cargando MICRO #${escapeHtml(id)}</h2><p>${escapeHtml(e.message)}</p></div>`}}
function renderMicroPreview(){currentStory=null;const draft={id:'001',number:1,title:'PREVIEW MICRO-PESADILLA',publicationDate:new Date().toISOString().slice(0,10),fictionYear:'',access:'public',cover:'',contentBlocks:[{type:'text',text:'Añade contenido desde el Importer y pulsa REFRESCAR PREVIEW.'}],relatedStory:null};applyMicroPreviewDraft(draft)}
function applyMicroPreviewDraft(draft){if(routeName()!=='micro-preview'||!draft)return;currentStory=null;currentMicro=draft;view.innerHTML=microDocumentHtml(draft,{preview:true});bindMicroDetail(draft,{preview:true})}
function microLastTextLineRects(){const blocks=$$('#microReader .micro-text-block'),block=blocks[blocks.length-1];if(!block)return[];const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT),rects=[];let node;while((node=walker.nextNode())){if(!String(node.nodeValue||'').trim())continue;const range=document.createRange();try{range.selectNodeContents(node);for(const r of range.getClientRects())if(r.width>1&&r.height>2)rects.push({top:r.top,bottom:r.bottom,left:r.left})}catch{}}rects.sort((a,b)=>a.top-b.top||a.left-b.left);const lines=[];for(const r of rects){const last=lines[lines.length-1];if(!last||Math.abs(last.top-r.top)>2)lines.push({top:r.top,bottom:r.bottom});else last.bottom=Math.max(last.bottom,r.bottom)}return lines.slice(-4)}
function updateMicroProgress(){if(routeName()!=='micro'||!currentMicro||isMicroRead(currentMicro.id))return;const lines=microLastTextLineRects();if(!lines.length)return;const visualHeight=window.visualViewport?.height||innerHeight,visualTop=window.visualViewport?.offsetTop||0,mid=visualTop+(visualHeight/2);const reached=lines.every(line=>line.bottom<=mid);if(reached)markMicroRead(currentMicro.id)}
function gamesForStory(s){const id=String(s?.id||'');return (gamesData?.games||[]).filter(g=>String(g.relatedStoryId||'')===id&&g.published!==false).sort((a,b)=>(Number(a.number)||0)-(Number(b.number)||0))}
function gamesForStoryHtml(s){const rows=gamesForStory(s);if(!rows.length)return'';const title=rows.length===1?'GAME RELACIONADO':'GAMES RELACIONADOS';return `<section id="storyGameRelations" class="story-game-relations"><div class="eyebrow">${title}</div><div class="story-game-relation-grid">${rows.map(g=>{const img=gameAssetUrl(g.listImage||g.cover);return `<button type="button" data-related-game="${escAttr(g.id)}">${img?`<img src="${escAttr(img)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<span><b>GAME #${String(Number(g.number)||0).padStart(2,'0')}</b><strong>${escapeHtml(g.title||g.id)}</strong></span></button>`}).join('')}</div></section>`}
function bindRelatedGameLinks(){$$('[data-related-game]').forEach(b=>b.onclick=()=>go(`game/${encodeURIComponent(b.dataset.relatedGame)}`))}
function microRelationsForStory(s){const id=String(s?.id||'');return (microsData?.items||[]).filter(m=>String(m.relatedStoryId||'')===id&&(String(m.relationVisibility||'always')!=='after_read'||isRead(id))).sort((a,b)=>Number(a.number||a.id)-Number(b.number||b.id))}
function microRelationsForStoryHtml(s){const rows=microRelationsForStory(s);if(!rows.length)return'';const title=rows.length===1?'MICRO-PESADILLA RELACIONADA':'MICRO-PESADILLAS RELACIONADAS';return `<section id="storyMicroRelations" class="story-micro-relations"><div class="eyebrow">${title}</div><div class="story-micro-grid">${rows.map(m=>{const id=String(m.id||m.number||'').padStart(3,'0'),cover=microCover(m);return `<button type="button" data-related-micro="${escAttr(id)}">${cover?`<img src="${escAttr(cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<span><b>MICRO #${escapeHtml(id)}</b><strong>${escapeHtml(m.title||'')}</strong><small>${escapeHtml(microRelationLabel(m.relation))}</small></span></button>`}).join('')}</div></section>`}
function bindRelatedMicroLinks(){$$('[data-related-micro]').forEach(b=>b.onclick=()=>go(`micro/${encodeURIComponent(b.dataset.relatedMicro)}`))}
function refreshStoryMicroRelations(){if(routeName()!=='story'||!currentStory)return;const old=$('#storyMicroRelations'),html=microRelationsForStoryHtml(currentStory);if(old){if(!html)old.remove();else{const tmp=document.createElement('div');tmp.innerHTML=html;old.replaceWith(tmp.firstElementChild);bindRelatedMicroLinks()}}else if(html){const reader=$('#reader');if(reader){reader.insertAdjacentHTML('afterend',html);bindRelatedMicroLinks()}}}


function gameById(id){id=String(id||'').trim();return (gamesData?.games||[]).find(g=>String(g.id||'')===id)||null}
function gameAssetUrl(v){v=String(v||'').trim();if(!v)return'';if(/^https?:\/\//i.test(v)||/^data:/i.test(v)||/^blob:/i.test(v))return v;return v.replace(/^\.\//,'')}
function gameHeroUrl(){const raw=gameAssetUrl(gamesData?.heroImage||'');if(!raw)return'';const ver=String(gamesData?.heroVersion||'').trim();return ver?`${raw}${raw.includes('?')?'&':'?'}v=${encodeURIComponent(ver)}`:raw}
function gameCompatibilityLabel(v){return({mobile_desktop:'MÓVIL + DESKTOP',desktop_recommended:'MÓVIL + DESKTOP · MEJOR EN DESKTOP',desktop_only:'SOLO DESKTOP'})[String(v||'')]||'MÓVIL + DESKTOP'}
function gameCompatibilityShort(v){return({mobile_desktop:'MÓVIL + DESKTOP',desktop_recommended:'MEJOR EN DESKTOP',desktop_only:'SOLO DESKTOP'})[String(v||'')]||'MÓVIL + DESKTOP'}
function gameOrientationLabel(v){return({landscape:'HORIZONTAL RECOMENDADO',portrait:'VERTICAL RECOMENDADO',any:'ORIENTACIÓN INDIFERENTE'})[String(v||'')]||'ORIENTACIÓN INDIFERENTE'}
function gameTypeLabel(v){return String(v||'game')==='educational'?'GAME DIDÁCTICO':'GAME'}
function gameVersionLabel(v){v=String(v||'').trim();return v?( /^v/i.test(v)?v:`v${v}` ):''}
function gameStory(g){return g?.relatedStoryId?(indexData?.stories||[]).find(x=>String(x.id)===String(g.relatedStoryId)):null}
function gameSaga(g){return g?.relatedSagaId?(sagasData?.sagas||[]).find(x=>String(x.id)===String(g.relatedSagaId)):null}
function gameCompatibilityIconHtml(v,compact=false){const phone=`<svg viewBox="0 0 24 36" aria-hidden="true"><rect x="3" y="2" width="18" height="32" rx="3"></rect><line x1="9" y1="6" x2="15" y2="6"></line><circle cx="12" cy="29" r="1.2"></circle></svg>`,desktop=`<svg viewBox="0 0 40 34" aria-hidden="true"><rect x="3" y="3" width="34" height="22" rx="2"></rect><line x1="20" y1="25" x2="20" y2="31"></line><line x1="12" y1="31" x2="28" y2="31"></line></svg>`;const kind=String(v||'mobile_desktop'),desktopOnly=kind==='desktop_only',recommended=kind==='desktop_recommended';return `<span class="game-device-badge ${desktopOnly?'desktop-only':recommended?'desktop-recommended':'mobile-desktop'} ${compact?'compact':''}"><span class="game-device-icons"><i class="game-device-phone ${desktopOnly?'is-disabled':''}">${phone}${desktopOnly?'<b>×</b>':''}</i><i class="game-device-desktop">${desktop}</i></span><span class="game-device-copy"><strong>${escapeHtml(gameCompatibilityShort(kind))}</strong>${compact?'':`<small>${desktopOnly?'NO JUGABLE EN MÓVIL':recommended?'JUGABLE EN MÓVIL · EXPERIENCIA RECOMENDADA EN ORDENADOR':'JUGABLE EN MÓVIL Y ORDENADOR'}</small>`}</span></span>`}
function gameCardHtml(g,i=0){const listImage=gameAssetUrl(g.listImage||g.cover),num=Math.max(0,Number(g.number)||0);return `<button class="game-card section-entry-item" style="--entry-i:${i}" type="button" data-game-id="${escAttr(g.id)}">${listImage?`<img src="${escAttr(listImage)}" alt="${escAttr(g.title||'Game')}" loading="lazy" referrerpolicy="no-referrer">`:'<div class="game-card-placeholder">GAME</div>'}<div class="game-card-copy"><span>${num?`GAME #${String(num).padStart(2,'0')}`:'GAME'}${String(g.type||'game')==='educational'?' · DIDÁCTICO':''}</span><h2>${escapeHtml(g.title||g.id)}</h2>${gameCompatibilityIconHtml(g.compatibility,true)}</div></button>`}
function bindGameCards(){$$('[data-game-id]').forEach(b=>b.onclick=()=>runCatalogSelectFx(b,()=>go(`game/${encodeURIComponent(b.dataset.gameId)}`)))}
function animateGameAvailableCount(target){const el=$('#gamesAvailableCount');if(!el)return;target=Math.max(0,Number(target)||0);if(motionReduced()){el.textContent=String(target);return}const duration=1000,start=performance.now();el.textContent='0';const tick=now=>{const p=Math.min(1,(now-start)/duration),e=1-Math.pow(1-p,3);el.textContent=String(Math.round(target*e));if(p<1)requestAnimationFrame(tick);else el.textContent=String(target)};requestAnimationFrame(tick)}
function typeGamesIntro(){
  const el=$('#gamesIntroTyping');if(!el)return;
  if(motionReduced())return;
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes=[];let n;
  while((n=walker.nextNode()))nodes.push({node:n,text:n.nodeValue||''});
  const total=nodes.reduce((sum,x)=>sum+x.text.length,0);if(!total)return;
  nodes.forEach(x=>x.node.nodeValue='');
  const duration=Math.max(900,Math.min(2100,total*22)),start=performance.now();
  const tick=now=>{const p=Math.min(1,(now-start)/duration),visible=Math.round(total*p);let left=visible;for(const x of nodes){const take=Math.max(0,Math.min(x.text.length,left));x.node.nodeValue=x.text.slice(0,take);left-=take}if(p<1)requestAnimationFrame(tick)};
  requestAnimationFrame(tick);
}
let gamesCatalogFilter='all';
function gamesFilterIcon(kind){if(kind==='mobile')return `<svg viewBox="0 0 24 36" aria-hidden="true"><rect x="3" y="2" width="18" height="32" rx="3"></rect><line x1="9" y1="6" x2="15" y2="6"></line><circle cx="12" cy="29" r="1.2"></circle></svg>`;if(kind==='desktop')return `<svg viewBox="0 0 40 34" aria-hidden="true"><rect x="3" y="3" width="34" height="22" rx="2"></rect><line x1="20" y1="25" x2="20" y2="31"></line><line x1="12" y1="31" x2="28" y2="31"></line></svg>`;return `<svg viewBox="0 0 36 36" aria-hidden="true"><rect x="3" y="3" width="12" height="12" rx="2"></rect><rect x="21" y="3" width="12" height="12" rx="2"></rect><rect x="3" y="21" width="12" height="12" rx="2"></rect><rect x="21" y="21" width="12" height="12" rx="2"></rect></svg>`}
function gameMatchesCatalogFilter(g,filter){const c=String(g?.compatibility||'mobile_desktop');if(filter==='mobile')return c==='mobile_desktop'||c==='desktop_recommended';if(filter==='desktop')return c==='desktop_recommended'||c==='desktop_only';return true}
function drawGamesCatalogRows(rows){const grid=$('#gamesCatalogGrid');if(!grid)return;const filtered=rows.filter(g=>gameMatchesCatalogFilter(g,gamesCatalogFilter));grid.innerHTML=filtered.length?filtered.map((g,i)=>gameCardHtml(g,i)).join(''):'<div class="empty games-filter-empty">No hay Games para este filtro.</div>';$$('[data-game-filter]').forEach(b=>{const active=b.dataset.gameFilter===gamesCatalogFilter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active?'true':'false')});bindGameCards();bindBrokenImages()}
function bindGamesCatalogFilters(rows){$$('[data-game-filter]').forEach(b=>b.onclick=()=>{gamesCatalogFilter=b.dataset.gameFilter||'all';drawGamesCatalogRows(rows)})}
function renderGamesCatalog(){currentStory=null;currentMicro=null;currentGame=null;if(!featurePortalEnabled('games'))return renderFuturePlaceholder('GAMES','rosa');const rows=[...(gamesData?.games||[])].filter(g=>g&&g.published!==false).sort((a,b)=>(Number(b.number)||0)-(Number(a.number)||0)||new Date(b.publicationDate||0)-new Date(a.publicationDate||0));const hero=gameHeroUrl(),intro=String(gamesData?.heroText||'Algunos están diseñados especialmente para ordenador; consulta la compatibilidad antes de jugar.'),introHtml=String(gamesData?.heroHtml||'').trim()?safeGameRichHtml(gamesData.heroHtml):safeGameRichHtml(escapeHtml(intro).replace(/\n/g,'<br>'));view.innerHTML=`<section class="section games-section section-entry-page"><div class="games-hero section-entry-block ${hero?'has-image':''}">${hero?`<img class="games-hero-image" src="${escAttr(hero)}" alt="" referrerpolicy="no-referrer">`:''}<span class="games-hero-pixel-fx" aria-hidden="true"></span></div><div class="games-intro-box section-entry-block"><div id="gamesIntroTyping" class="games-intro-rich">${introHtml}</div></div><div class="games-summary section-entry-block"><div class="games-summary-count"><strong id="gamesAvailableCount">0</strong><span>${rows.length===1?'GAME DISPONIBLE':'GAMES DISPONIBLES'}</span></div><div class="games-filter-icons" role="group" aria-label="Filtrar Games por dispositivo"><button type="button" data-game-filter="mobile" aria-pressed="false" title="Móvil">${gamesFilterIcon('mobile')}<small>MÓVIL</small></button><button type="button" data-game-filter="desktop" aria-pressed="false" title="Desktop">${gamesFilterIcon('desktop')}<small>DESKTOP</small></button><button type="button" data-game-filter="all" aria-pressed="true" title="Todos">${gamesFilterIcon('all')}<small>TODO</small></button></div></div><div id="gamesCatalogGrid" class="games-grid"></div></section>`;gamesCatalogFilter='all';drawGamesCatalogRows(rows);bindGamesCatalogFilters(rows);animateGameAvailableCount(rows.length);typeGamesIntro()}
function safeGameRichHtml(value){
  const tpl=document.createElement('template');tpl.innerHTML=String(value||'');
  const allowed=new Set(['B','STRONG','I','EM','U','BR','P','DIV']);
  [...tpl.content.querySelectorAll('*')].forEach(el=>{if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);return}const rawStyle=el.getAttribute('style')||'',match=rawStyle.match(/text-align\s*:\s*(left|center|right|justify)/i),align=match?match[1].toLowerCase():'';[...el.attributes].forEach(a=>el.removeAttribute(a.name));if(align)el.style.textAlign=align});
  return tpl.innerHTML;
}
function gameStoryLinkHtml(g){const st=gameStory(g);if(!st)return'';const cover=displayCover(st);return `<div class="game-related-story"><div class="eyebrow">STORY RELACIONADA</div><button type="button" data-game-story="${escAttr(st.id)}">${cover?`<img src="${escAttr(cover)}" alt="">`:''}<span><b>STORY ${escapeHtml(st.id)}</b><strong>${escapeHtml(st.title||'')}</strong></span><em>›</em></button></div>`}
function gameSagaLinkHtml(g){const sg=gameSaga(g);if(!sg)return'';const banner=sagaListBanner(sg)||sagaHeroBanner(sg);return `<div class="game-related-saga"><div class="eyebrow">SAGA RELACIONADA</div><button type="button" data-game-saga="${escAttr(sg.id)}">${banner?`<img src="${escAttr(banner)}" alt="">`:'<span class="game-related-saga-placeholder">SAGA</span>'}<span><b>SAGA</b><strong>${escapeHtml(sg.name||sg.id)}</strong></span><em>›</em></button></div>`}
function gameScreenshotsHtml(g){const rows=Array.isArray(g?.screenshots)?g.screenshots.map(gameAssetUrl).filter(Boolean):[];if(!rows.length)return'';return `<div class="game-screenshots section-entry-block" aria-label="Capturas del Game">${rows.map((src,i)=>`<button type="button" class="game-screenshot" data-game-screenshot="${escAttr(src)}" aria-label="Abrir captura ${i+1}"><img src="${escAttr(src)}" alt="Captura ${i+1} de ${escAttr(g.title||'Game')}" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}</div>`}
function renderGameDetail(id){currentStory=null;currentMicro=null;const g=gameById(id);currentGame=g;if(!g||g.published===false){view.innerHTML='<div class="empty">Game no encontrado.</div>';return}const cover=gameAssetUrl(g.cover),orientation=gameOrientationLabel(g.orientation),version=gameVersionLabel(g.version),num=Math.max(0,Number(g.number)||0),descHtml=String(g.descriptionHtml||'').trim()||escapeHtml(String(g.description||'')).replace(/\n/g,'<br>');view.innerHTML=`<section class="section game-detail section-entry-page"><button id="backToGamesBtn" class="game-back-btn game-back-btn-top section-entry-block" type="button">VOLVER A GAMES<span class="game-back-sweep" aria-hidden="true"></span></button><div class="game-detail-poster section-entry-block">${cover?`<img src="${escAttr(cover)}" alt="${escAttr(g.title||'Game')}" class="game-detail-cover">`:''}</div><div class="game-detail-info section-entry-block"><div class="game-detail-topline"><span>${num?`GAME #${String(num).padStart(2,'0')} · `:''}${escapeHtml(gameTypeLabel(g.type))}</span>${g.publicationDate?`<small>${formatDate(g.publicationDate)}</small>`:''}</div>${gameCompatibilityIconHtml(g.compatibility,false)}<div class="game-badges"><b class="game-orientation-badge">${escapeHtml(orientation)}</b>${version?`<b class="game-version-badge">${escapeHtml(version)}</b>`:''}</div>${descHtml?`<div class="game-description">${safeGameRichHtml(descHtml)}</div>`:''}${gameScreenshotsHtml(g)}</div>${g.instructions?`<div class="game-instructions section-entry-block"><strong>INSTRUCCIONES</strong><p>${escapeHtml(g.instructions).replace(/\n/g,'<br>')}</p></div>`:''}<div class="game-actions section-entry-block"><button id="gamePlayBtn" class="game-play-btn" type="button">JUGAR</button></div>${gameStoryLinkHtml(g)}${gameSagaLinkHtml(g)}</section>`;$('#gamePlayBtn').onclick=()=>go(`game/${encodeURIComponent(g.id)}/play`);$('#backToGamesBtn').onclick=()=>go('games');$$('[data-game-story]').forEach(b=>b.onclick=()=>go(`story/${encodeURIComponent(b.dataset.gameStory)}`));$$('[data-game-saga]').forEach(b=>b.onclick=()=>go(`saga/${encodeURIComponent(b.dataset.gameSaga)}`));$$('[data-game-screenshot]').forEach(b=>b.onclick=()=>openLightbox(b.dataset.gameScreenshot,''));bindBrokenImages()}

let gameEventBridgeBound=false;
function expectedGameOrigin(g){try{return new URL(String(g?.url||''),location.href).origin}catch{return''}}
function gameMessageOriginAllowed(event,g){const expected=expectedGameOrigin(g);if(!expected)return false;if(event.origin===expected)return true;return event.origin==='null'&&expected===location.origin}
function handleGamePlayerMessage(event){const data=event?.data;if(!data||typeof data!=='object'||data.type!=='DISTURBING_GAME_EVENT'||data.event!=='GAME_COMPLETED')return;const frame=$('#gameFrame'),g=currentGame;if(!frame||!g||routeName()!=='game'||currentHash().split('/')[3]!=='play')return;if(event.source!==frame.contentWindow)return;const gameId=String(data.gameId||'').trim();if(!gameId||gameId!==String(g.id||'').trim())return;if(!gameMessageOriginAllowed(event,g)){console.warn('GAME EVENT origin rechazado',event.origin,expectedGameOrigin(g));return}registerGameCompletion(gameId).catch(e=>console.warn('GAME completion',e))}
function bindGameEventBridge(){if(gameEventBridgeBound)return;gameEventBridgeBound=true;window.addEventListener('message',handleGamePlayerMessage)}
window.DisturbingStoriesGames=window.DisturbingStoriesGames||{};window.DisturbingStoriesGames.hasCompletedGame=hasCompletedGame;
function pauseAppAudioForGame(){try{stopStormForOtherMedia()}catch{}const a=$('#globalPlayerAudio');if(a&&!a.paused){try{a.pause()}catch{}}}
function gameSandboxTokens(url){const tokens=['allow-scripts','allow-forms','allow-pointer-lock','allow-modals','allow-downloads'];try{const u=new URL(String(url||''),location.href);if(u.origin!==location.origin)tokens.splice(1,0,'allow-same-origin')}catch{}return tokens.join(' ')}
function updateGameFullscreenButton(){const b=$('#gameFullscreenBtn');if(!b)return;b.innerHTML=document.fullscreenElement?'↙ SALIR DE PANTALLA COMPLETA':'⛶ PANTALLA COMPLETA'}
async function toggleGameFullscreen(){const shell=$('#gamePlayShell');if(!shell)return;if(document.fullscreenElement){try{await document.exitFullscreen()}catch{}updateGameFullscreenButton();return}if(shell.requestFullscreen){try{await shell.requestFullscreen();updateGameFullscreenButton();return}catch(e){console.warn('GAME fullscreen',e)}}shell.classList.add('game-pseudo-fullscreen');toast('Pantalla completa del sistema no disponible: usando vista completa de la App')}
async function leaveGamePlayer(id){if(document.fullscreenElement){try{await document.exitFullscreen()}catch{}}go(`game/${encodeURIComponent(id)}`)}
function renderGamePlayer(id){currentStory=null;currentMicro=null;const g=gameById(id);currentGame=g;if(!g||g.published===false){view.innerHTML='<div class="empty">Game no encontrado.</div>';return}if(!/^https?:\/\//i.test(String(g.url||''))){view.innerHTML='<div class="empty">Este Game no tiene una URL válida configurada.</div>';return}pauseAppAudioForGame();const title=escapeHtml(g.title||g.id);view.innerHTML=`<section id="gamePlayShell" class="game-play-shell ${g.orientation==='landscape'?'prefers-landscape':g.orientation==='portrait'?'prefers-portrait':''}"><div class="game-play-toolbar"><button id="gameExitBtn" type="button">× SALIR</button><strong>${title}</strong>${g.fullscreen!==false?'<button id="gameFullscreenBtn" type="button">⛶ PANTALLA COMPLETA</button>':'<span></span>'}</div><div class="game-frame-wrap"><div id="gameFrameLoading" class="game-frame-loading">CARGANDO GAME…</div><iframe id="gameFrame" src="${escAttr(g.url)}" title="${escAttr(g.title||'Game')}" sandbox="${escAttr(gameSandboxTokens(g.url))}" allow="autoplay; gamepad" referrerpolicy="no-referrer"></iframe></div><div class="game-play-hint">${escapeHtml(gameCompatibilityLabel(g.compatibility))} · ${escapeHtml(gameOrientationLabel(g.orientation))}</div></section>`;$('#gameExitBtn').onclick=()=>leaveGamePlayer(g.id);const fs=$('#gameFullscreenBtn');if(fs)fs.onclick=toggleGameFullscreen;const frame=$('#gameFrame');if(frame)frame.addEventListener('load',()=>$('#gameFrameLoading')?.classList.add('hidden'),{once:true});document.removeEventListener('fullscreenchange',updateGameFullscreenButton);document.addEventListener('fullscreenchange',updateGameFullscreenButton);updateGameFullscreenButton()}
function renderFuturePlaceholder(title,tone){currentStory=null;view.innerHTML=`<section class="section v2-section future-placeholder ${escAttr(tone)}"><h1>${escapeHtml(title)}</h1><div class="future-placeholder-box"><strong>PRÓXIMAMENTE</strong></div></section>`}

function updateStormButton(){const btn=$('#stormHeaderBtn');if(!btn)return;btn.classList.toggle('active',stormEnabled);btn.classList.toggle('inactive',!stormEnabled);btn.setAttribute('aria-pressed',stormEnabled?'true':'false');btn.setAttribute('aria-label',stormEnabled?'Tormenta activada':'Tormenta desactivada');btn.title=stormEnabled?'Tormenta activada':'Tormenta desactivada'}
function ensureStormAudioContext(){
  if(stormAudioCtx)return stormAudioCtx;
  const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return null;
  try{stormAudioCtx=new Ctx();stormGainNode=stormAudioCtx.createGain();stormGainNode.gain.value=STORM_VOLUME;stormGainNode.connect(stormAudioCtx.destination);return stormAudioCtx}catch{return null}
}
function analyseStormLoopBounds(buffer){
  const sr=buffer.sampleRate||44100,maxTrim=Math.min(buffer.length-2,Math.floor(sr*.28)),threshold=.0018;
  let first=0,last=buffer.length-1;
  const activeAt=i=>{let m=0;for(let c=0;c<buffer.numberOfChannels;c++){const a=Math.abs(buffer.getChannelData(c)[i]||0);if(a>m)m=a}return m>threshold};
  for(let i=0;i<maxTrim;i++){if(activeAt(i)){first=Math.max(0,i-Math.floor(sr*.004));break}}
  for(let j=0;j<maxTrim;j++){const i=buffer.length-1-j;if(activeAt(i)){last=Math.min(buffer.length-1,i+Math.floor(sr*.004));break}}
  if(last-first<sr*.5){first=0;last=buffer.length-1}
  return {start:first/sr,end:Math.max((first+1)/sr,last/sr)};
}
async function prepareStormBuffer(){
  if(stormBuffer)return stormBuffer;
  if(stormBufferPromise)return stormBufferPromise;
  const ctx=ensureStormAudioContext();if(!ctx)return null;
  stormBufferPromise=(async()=>{try{const r=await fetch(PUBLIC_APP_ASSET_BASE+'storm.mp3',{cache:'force-cache'});if(!r.ok)throw new Error(`storm HTTP ${r.status}`);const ab=await r.arrayBuffer();const buf=await ctx.decodeAudioData(ab.slice(0));stormBuffer=buf;const bounds=analyseStormLoopBounds(buf);stormLoopStart=bounds.start;stormLoopEnd=bounds.end;return buf}catch(e){console.warn('STORM WebAudio',e);return null}})();
  return stormBufferPromise;
}
function analyseStormIntroEnd(buffer){
  const sr=buffer.sampleRate||44100,maxTrim=Math.min(buffer.length-2,Math.floor(sr*.30)),threshold=.0009;
  let last=buffer.length-1;
  const activeAt=i=>{let m=0;for(let c=0;c<buffer.numberOfChannels;c++){const a=Math.abs(buffer.getChannelData(c)[i]||0);if(a>m)m=a}return m>threshold};
  for(let j=0;j<maxTrim;j++){const i=buffer.length-1-j;if(activeAt(i)){last=Math.min(buffer.length-1,i+Math.floor(sr*.004));break}}
  const effective=Math.max(.05,last/sr);return Math.min(buffer.duration,effective);
}
async function prepareStormIntroBuffer(){
  if(stormIntroBuffer)return stormIntroBuffer;
  if(stormIntroBufferPromise)return stormIntroBufferPromise;
  const ctx=ensureStormAudioContext();if(!ctx)return null;
  stormIntroBufferPromise=(async()=>{try{const r=await fetch(PUBLIC_APP_ASSET_BASE+'stormintro.mp3',{cache:'force-cache'});if(!r.ok)throw new Error(`stormintro HTTP ${r.status}`);const ab=await r.arrayBuffer();stormIntroBuffer=await ctx.decodeAudioData(ab.slice(0));stormIntroEnd=analyseStormIntroEnd(stormIntroBuffer);return stormIntroBuffer}catch(e){console.warn('STORM INTRO WebAudio',e);return null}})();
  return stormIntroBufferPromise;
}
function stopStormIntroSource(){
  if(stormIntroFallbackTimer){clearTimeout(stormIntroFallbackTimer);stormIntroFallbackTimer=0}
  if(stormIntroBufferSource){try{stormIntroBufferSource.onended=null;stormIntroBufferSource.stop()}catch{}try{stormIntroBufferSource.disconnect()}catch{}stormIntroBufferSource=null}
  if(stormIntroAudioEngine){try{stormIntroAudioEngine.onended=null;stormIntroAudioEngine.pause()}catch{}}
}
async function startStormIntroTransition(){
  if(stormIntroTransitionStarted||!stormEnabled)return false;
  stormIntroTransitionStarted=true;
  const ctx=ensureStormAudioContext();
  if(ctx){
    try{
      await ctx.resume();
      const [introBuf,loopBuf]=await Promise.all([prepareStormIntroBuffer(),prepareStormBuffer()]);
      if(introBuf&&loopBuf&&stormEnabled){
        stopStormIntroSource();stopStormBufferSource();
        const introSrc=ctx.createBufferSource(),loopSrc=ctx.createBufferSource();
        introSrc.buffer=introBuf;introSrc.connect(stormGainNode);
        loopSrc.buffer=loopBuf;loopSrc.loop=true;loopSrc.loopStart=Math.max(0,stormLoopStart||0);loopSrc.loopEnd=Math.min(loopBuf.duration,stormLoopEnd||loopBuf.duration);loopSrc.connect(stormGainNode);
        const startAt=ctx.currentTime+.018,endAt=startAt+(stormIntroEnd||introBuf.duration);
        stormGainNode.gain.setValueAtTime(STORM_VOLUME,ctx.currentTime);
        introSrc.start(startAt);
        loopSrc.start(endAt,loopSrc.loopStart);
        stormIntroBufferSource=introSrc;stormBufferSource=loopSrc;
        introSrc.onended=()=>{stormIntroBufferSource=null;stormStarted=true;updateStormButton()};
        stormIntroFallbackTimer=setTimeout(()=>{stormIntroFallbackTimer=0;if(stormEnabled){stormStarted=true;updateStormButton()}},Math.max(0,(endAt-ctx.currentTime)*1000+30));
        return true;
      }
    }catch(e){console.warn('STORM INTRO transition WebAudio',e)}
  }
  // Fallback HTMLAudio: mantiene el orden stormintro -> storm cuando Web Audio no está disponible.
  try{
    const a=stormIntroAudioEngine;if(!a)throw new Error('stormintro audio unavailable');
    a.pause();a.currentTime=0;a.volume=STORM_VOLUME;
    a.onended=()=>{a.onended=null;startStormAmbient()};
    const playPromise=a.play();if(playPromise&&typeof playPromise.catch==='function')playPromise.catch(()=>startStormAmbient());
    return true;
  }catch(e){console.warn('STORM INTRO fallback',e);startStormAmbient();return false}
}
function stopStormBufferSource(){if(stormBufferSource){try{stormBufferSource.onended=null;stormBufferSource.stop()}catch{}try{stormBufferSource.disconnect()}catch{}stormBufferSource=null}}
function primeStormAudio(){
  if(stormPrimed)return;stormPrimed=true;
  const ctx=ensureStormAudioContext();
  if(ctx){try{const p=ctx.resume();if(p&&typeof p.catch==='function')p.catch(()=>{})}catch{}prepareStormBuffer().catch(()=>{});prepareStormIntroBuffer().catch(()=>{})}
  const a=$('#stormAudio');if(a){try{a.volume=STORM_VOLUME;a.preload='auto';a.load()}catch{}}
  if(stormIntroAudioEngine){try{stormIntroAudioEngine.volume=STORM_VOLUME;stormIntroAudioEngine.preload='auto';stormIntroAudioEngine.load()}catch{}}
}
async function startStormAmbient(){
  if(!stormEnabled)return;
  const ctx=ensureStormAudioContext();
  if(ctx){
    try{await ctx.resume();const buf=await prepareStormBuffer();if(buf&&stormEnabled){stopStormBufferSource();const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;src.loopStart=Math.max(0,stormLoopStart||0);src.loopEnd=Math.min(buf.duration,stormLoopEnd||buf.duration);src.connect(stormGainNode);stormGainNode.gain.setValueAtTime(STORM_VOLUME,ctx.currentTime);src.start(0,src.loopStart);stormBufferSource=src;stormStarted=true;const a=$('#stormAudio');if(a){try{a.pause()}catch{}}updateStormButton();return}}catch(e){console.warn('STORM start WebAudio',e)}
  }
  // Fallback para navegadores donde Web Audio no esté disponible.
  const a=$('#stormAudio');if(!a||!stormEnabled)return;try{a.volume=STORM_VOLUME;const p=a.play();if(p&&typeof p.then==='function')p.then(()=>{stormStarted=true;updateStormButton()}).catch(()=>{stormStarted=false;updateStormButton()})}catch{stormStarted=false}
}
function stopStormAmbient(disable=true){
  stopStormIntroSource();stopStormBufferSource();
  const a=$('#stormAudio');if(a){try{a.pause()}catch{}}
  stormStarted=false;if(disable)stormEnabled=false;updateStormButton()
}
function stopStormForOtherMedia(){if(stormStarted||stormBufferSource||!$('#stormAudio')?.paused)stopStormAmbient(true)}
function toggleStormAmbient(){stormEnabled=!stormEnabled;if(stormEnabled)startStormAmbient();else stopStormAmbient(false);updateStormButton()}

function bindGlobalStormMediaStop(){document.addEventListener('play',e=>{const t=e.target;if(!(t instanceof HTMLMediaElement))return;if(t.id==='stormAudio'||t.id==='introVideo')return;if(t.muted||Number(t.volume)===0)return;stopStormForOtherMedia()},true)}
let introWhiteHandoffSafetyTimer=0;
let introWhiteHandoffRaf=0;
function hideIntroWhiteHandoff(){
  const layer=$('#introWhiteHandoff');
  clearTimeout(introWhiteHandoffSafetyTimer);introWhiteHandoffSafetyTimer=0;
  if(introWhiteHandoffRaf){cancelAnimationFrame(introWhiteHandoffRaf);introWhiteHandoffRaf=0}
  if(!layer)return;
  layer.style.opacity='0';layer.classList.add('hidden');layer.classList.remove('fade-out');layer.setAttribute('aria-hidden','true');
}
function prepareIntroWhiteHandoff(){
  const layer=$('#introWhiteHandoff');if(!layer)return;
  clearTimeout(introWhiteHandoffSafetyTimer);
  if(introWhiteHandoffRaf){cancelAnimationFrame(introWhiteHandoffRaf);introWhiteHandoffRaf=0}
  layer.classList.remove('hidden','fade-out');layer.setAttribute('aria-hidden','false');layer.style.opacity='1';
  // v5.24 · El aspecto normal vuelve a ser exactamente el fundido suave por
  // frames. Este timer es solo una red de seguridad tardía si la navegación o
  // WebKit interrumpen por completo el handoff antes de que pueda arrancar.
  introWhiteHandoffSafetyTimer=setTimeout(hideIntroWhiteHandoff,2600);
}
function startIntroWhiteHandoff(){
  const layer=$('#introWhiteHandoff');if(!layer||layer.classList.contains('hidden'))return;
  clearTimeout(introWhiteHandoffSafetyTimer);introWhiteHandoffSafetyTimer=0;
  if(introWhiteHandoffRaf){cancelAnimationFrame(introWhiteHandoffRaf);introWhiteHandoffRaf=0}
  let frame=0,finished=false;
  const finish=()=>{if(finished)return;finished=true;hideIntroWhiteHandoff()};
  // Failsafe tardío: no participa en la animación normal, solo evita una capa
  // blanca permanente si el navegador deja de entregar frames.
  introWhiteHandoffSafetyTimer=setTimeout(finish,2200);
  const tick=()=>{
    if(finished)return;
    frame++;
    if(frame<=15){layer.style.opacity='1'}
    else if(frame<=30){const p=(frame-15)/15;layer.style.opacity=String(Math.max(0,1-p))}
    else{return finish()}
    introWhiteHandoffRaf=requestAnimationFrame(tick);
  };
  introWhiteHandoffRaf=requestAnimationFrame(tick);
}
async function playEntryIntro(){if(introPlayed)return false;introPlayed=true;const gate=$('#entryGate'),gateBtn=$('#entryGateButton'),layer=$('#introLayer'),video=$('#introVideo');if(!layer||!video)return false;if(!gate||!gateBtn)return playEntryIntroDirect(layer,video);gate.classList.remove('hidden');gate.setAttribute('aria-hidden','false');return new Promise(resolve=>{let started=false;const enter=()=>{if(started)return;started=true;primeStormAudio();primeUiSounds();gateBtn.disabled=true;gateBtn.classList.add('entry-confirm');startIntroMedia(layer,video,resolve);setTimeout(()=>{gate.classList.add('leaving');setTimeout(()=>{gate.classList.add('hidden');gate.classList.remove('leaving');gate.setAttribute('aria-hidden','true')},190)},330)};gateBtn.addEventListener('click',enter,{once:true})})}
function playEntryIntroDirect(layer,video){return new Promise(resolve=>startIntroMedia(layer,video,resolve))}
function startIntroMedia(layer,video,resolve){
  layer.classList.remove('hidden');layer.setAttribute('aria-hidden','false');
  let finished=false,bridgeStarted=false,bridgeRaf=0;
  const leadSeconds=60/60;
  try{video.currentTime=0;video.muted=false;video.volume=1}catch{}
  const triggerBridge=()=>{if(bridgeStarted)return;bridgeStarted=true;startStormIntroTransition().catch(()=>startStormAmbient())};
  const watchBridge=()=>{
    if(finished)return;
    const duration=Number(video.duration),current=Number(video.currentTime);
    if(Number.isFinite(duration)&&duration>0&&Number.isFinite(current)&&current>=Math.max(0,duration-leadSeconds)){triggerBridge();return}
    bridgeRaf=requestAnimationFrame(watchBridge);
  };
  const done=(withWhite=true)=>{
    if(finished)return;finished=true;clearTimeout(fallback);if(bridgeRaf)cancelAnimationFrame(bridgeRaf);
    if(withWhite&&!bridgeStarted)triggerBridge();
    try{video.pause()}catch{}
    if(withWhite)prepareIntroWhiteHandoff();
    layer.classList.add('hidden');layer.setAttribute('aria-hidden','true');resolve(!!withWhite)
  };
  const fallback=setTimeout(()=>done(false),10000);
  layer.onclick=()=>done(true);
  video.addEventListener('ended',()=>done(true),{once:true});
  video.addEventListener('error',()=>done(false),{once:true});
  bridgeRaf=requestAnimationFrame(watchBridge);
  const p=video.play();if(p&&typeof p.catch==='function')p.catch(()=>done(false))
}
bindGlobalStormMediaStop();
async function registerSW(){if('serviceWorker'in navigator){try{const reg=await navigator.serviceWorker.register('./sw.js?v=6.2.0',{updateViaCache:'none'});try{await reg.update()}catch{} }catch(e){console.warn('SW',e)}}}
boot();
