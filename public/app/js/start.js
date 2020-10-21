let ts = new Date(); // current timestamp
let th = ts.getHours(); 
let dt = {}; // img: image url, msg: string of "Morning", "Afternoon", or "Evening"
let theme = window.matchMedia("(prefers-color-scheme: dark)").matches?'dark':'light';
let updating = false; 

window.matchMedia("(prefers-color-scheme: dark)").addListener(() => {
  theme = window.matchMedia("(prefers-color-scheme: dark)").matches?'dark':'light';
  $('#css-theme').prop('href', `css/start-${theme}.css`); 
})

if (th > 2 && th <=11){ 
  dt = {img: (th<6?'n':'d-sr'), msg: 'Morning'}}
else if (th <= 17){ 
  dt = {img: (th == 17?'d-ss':'d-af'), msg: 'Afternoon'}}
else{
  dt = {img: (th == 18?'d-ss':'n'), msg: 'Evening'}}

function handleError(err){
  $('#div-pb').hide(); 
  if(err.toLowerCase().indexOf('not authenticated') !== -1){
    localStorage.removeItem('sessionData');
    localforage.removeItem('gbd-metadata');
    localforage.removeItem('gbd-cache');
    localforage.removeItem('gbd-hist');
    rlib.toast.info('Session expired'); 
    $('#div-msg-skipFetch').hide(); 
    $('#div-msg-text').text('Your session is no longer valid.');
    $('#p-sessExp').show(); 
    $('#div-signin').show(); 
    return; 
  }
  rlib.toast.error('Failed to update: '+(err?err:'Could not reach the server.'));
}

function openGB(){
  if(!updating){
    window.open('../dashboard?app=1', '_self') 
  }
  else{
    updating = 2 } // signal updater to open GB after done updating
}

async function fetchGB(cacheTimestamp){
  $('#div-msg-opts').hide(); 
  $('#div-msg').show();
  $('#div-pb').show(); 
  $('#div-msg-text').text('Connecting to OpenVUE...');

  let cached = await svcore.fetchCurrentGB(2); 

  if(cached.ok){ // Give option to use cache instead
    $('#div-msg-skipFetch').show(); 
    $('#div-msg-skipFetch-duration').text(moment().to(cached.ts*1000)); 
  }

  svcore.fetchCurrentGB(0).then(r => {
    reqDone = true; 
    if(!r.ok){
      handleError(r.error); 
      return; 
    }
    $('#div-pb').hide(); 
    $('#div-msg-opts').hide(); 
    $('#div-msg-text').html(`<i class='fas fa-check green-text'></i> Done!<br><br>Opening Gradebook...`);
    $('#div-msg-skipFetch').hide(); 
    setTimeout(function(){
      sessionStorage.setItem('app_fromStart', '1');
      openGB(); 
    }, 500); 
  }); 
}

function forceCachedGB(){
  sessionStorage.app_forceCached = '1'; 
  openGB(); 
}

function installSW(){
  return new Promise(res => {
    navigator.serviceWorker
      .register('../sw.js')
      .then(function(reg) {
        // reg.addEventListener('updatefound', () => { // future: better update handling
        //   const newWorker = reg.installing; 
        //   newWorker.addEventListener('statechange', () => {
        //     if(newWorker.state === 'installed'){
        //       $('#div-upd').show(); 
        //       rlib.toast.success('OpenVUE is updating...');
        //     }
        //   })
        // })
        res(0); 
      })
      .catch(function(err) {
        console.warn('Service Worker Failed to Register', err);
        res(err); 
      })
  })
}

function initStart(){
  if(localStorage.sessionData){
    let session = JSON.parse(atob(localStorage.sessionData)); 
    $('#msg-header').text(`Good ${dt.msg}, ${session.name}!`);
    if(Date.now() > session.exp){
      $('#p-sessExp').show(); 
      $('#div-signin').show(); 
      return; 
    }
    if(sessionStorage.app_persistLaunchPage || document.location.search.indexOf('persist=1') !== -1){
      $('#div-signin-alt').show();
      $('#div-toGB').show(); 
      sessionStorage.removeItem('app_persistLaunchPage');
      return; 
    }
    fetchGB(); 
  }
  else{
    $('#div-signin').show(); 
  }
}

window.onload = function(){
  $('#init').hide();
  $('#main').show();
  $('#ver').text(`${window.svueVer.build} (${window.svueVer.str})`)
  $('#css-theme').prop('href', `css/start-${theme}.css`)
  $('#bk').css('background-image', `url(images/${dt.img}.jpg)`)
  navigator.serviceWorker.getRegistrations().then(res => {
    if(res.length === 0){
      $('#div-msg').show(); 
      $('#div-msg-text').html(`Installing the latest OpenVUE...</i>`);
      installSW().then(r => {
        if(!r){ // installSW returns 0 if successful
          $('#div-msg').hide(); 
          initStart(); 
        }
        else{ 
          $('#div-pb').hide(); 
          $('#div-msg-text').html(`<i class='fas fa-exclamation-triangle'></i> Installation failed: Could not install service worker.<br><span class='grey-text>Details:  ${r.stack}</span><br><br><a href='#' onclick='location.reload()'>Reload and Try Again</a>`); 
        }
      })
    }
    else{
      let sw = res[0]; 
      sw.addEventListener('updatefound', () => {
        updating = true; 
        $('#div-msg').show(); 
        $('#div-msg-text').html(`Updating OpenVUE...`);
        console.log(sw); 
        const newWorker = sw.installing; 
        console.log(newWorker); 
        newWorker.addEventListener('statechange', () => {
          console.log(newWorker.state); 
          if(newWorker.state === 'activated' || newWorker.state === 'redundant'){
            if(newWorker.state === 'redundant'){
              rlib.toast.warn('Update failed. OpenVUE will retry again in the future.')}
            else{rlib.toast.success('OpenVUE has been updated.')}
            if(updating === 2){ // gradebook ready to open, was waiting for updates
              $('#div-msg-text').html(`Starting OpenVUE...`);
              updating = false; 
              setTimeout(openGB, 1000); 
              return }
            updating = false; 
          }
        }); 
      }); 
      initStart(); // Immediately start loading GB, OVUE will update files in the background if needed
    }
  });
  navigator.serviceWorker.addEventListener('message', function(event){
    $('#div-msg-text').html(`OpenVUE has finished updating!`);
  }); 
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function(event) {
    if(event.data.code !== 200){ // not success 
      rlib.toast.success(event.data.msg) }
  });
}