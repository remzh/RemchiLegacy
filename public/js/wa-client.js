/**
 * wa-client.js
 * Implements support for Web Authentication APIs for OVUE. 
 */

function ab2str(buf) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
}

function str2ab(str) {
  return new Uint8Array(atob(str).split('').map(r => r.charCodeAt(0))).buffer;
}

async function waSignup(mode) {
  let init = await fetch('/secure/wa/setup').then(r => r.json()).catch(r => {
    return false; 
  }); 
  if (!init || !init.ok) {
    return {ok: false, error: init.error}; 
  }
  let pkOptions = init.config; 
  pkOptions.challenge = str2ab(pkOptions.challenge); 
  pkOptions.user = init.user; 
  pkOptions.user.id = Uint8Array.from(pkOptions.user.id, c => c.charCodeAt(0)); 
  if (mode) pkOptions.authenticatorSelection.authenticatorAttachment = 'cross-platform'; 
  let credentials = await navigator.credentials.create({
    publicKey: pkOptions
  }).catch(e => {
    // alert(e); 
    return false; 
  }); 
  if (!credentials) {
    return {ok: false, error: 'Timed out and/or declined by user.'}; 
  }
  loadBar.start(2500);
  let res = await fetch('/secure/wa/setup', {
    method: 'POST', 
    headers: {'Content-Type': 'application/json'}, 
    body: JSON.stringify({
      rawId: ab2str(credentials.rawId), 
      attestationObject: ab2str(credentials.response.attestationObject), 
      clientDataJSON: ab2str(credentials.response.clientDataJSON), 
      friendlyName: $('#i_keyName').val()
    })
  }).then(r => r.json()).catch(r => {
    return {ok: false, error: r}; 
  }); 
  return res; 
}

async function waLogin() {
  let init = await fetch('/signin/wa').then(r => r.json()).catch(r => {
    return {ok: false}; 
  }); 
  if (!init.ok) {
    return {ok: false}; 
  }
  let pkOptions = init.payload; 
  pkOptions.challenge = str2ab(pkOptions.challenge); 
  // pkOptions.user = init.user; 
  // pkOptions.user.id = Uint8Array.from(pkOptions.user.id, c => c.charCodeAt(0)); 
  let credentials = await navigator.credentials.get({
    publicKey: pkOptions
  }).catch(e => {
    return false; 
  }); 

  if (!credentials) {
    return {
      ok: false
    }
  }

  loadBar.start(2500);
  let res = await fetch('/signin', {
    method: 'POST', 
    headers: {'Content-Type': 'application/json'}, 
    body: JSON.stringify({
      wa: true, 
      rawId: ab2str(credentials.rawId), 
      authenticatorData: ab2str(credentials.response.authenticatorData), 
      clientDataJSON: ab2str(credentials.response.clientDataJSON), 
      signature: ab2str(credentials.response.signature), 
      userHandle: ab2str(credentials.response.userHandle), 
      rem: document.getElementById('c_rem').checked
    })
  }).then(r => r.json()).catch(r => {
    return {
      ok: false, 
      error: r
    } 
  }); 
  return res; 
}

/**
 * 
 * @param {object} [event] - keyboard event, if triggered from a key press 
 */
async function openWALogin(event) {
  if (event) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return; 
    }
  }
  let res = await waLogin(); 
  if (res.ok || res.type === 'success') {
    // console.log(res); 
    if (lb) lb.pause();
    loadBar.finish('#1c3');
    localStorage.sessionData = btoa(JSON.stringify({name: res.data.firstName, exp: res.data.expires}));
    showSuccess(res.data.firstName, false);
  } else {
    if (lb) lb.pause();
    loadBar.finish('#e53');
    showError('' + (res.error ? res.error:'Failed to authenticate.'));
    setTimeout(loadBar.hide, 400);  
  }
}