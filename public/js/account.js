let ahFull = {}; 
let lhFull = {};

function parseUA(uaStr){
  if(!uaStr){return 'Not available'}
  let ua = new UAParser(uaStr); 
  return `<b>${ua.getBrowser().name} ${ua.getBrowser().version}</b> on ${ua.getOS().name} ${ua.getOS().version}`
}

function signOutEverywhere(){
  rlib.popup('signin/reauth', 400, 500); 
  pendingSudo = true; 
}

let pendingSudo; 
window.confirmSudo = function(){
  rlib.closePopup(); 
  $.post('account/secure/signoutAll').then(r => {
    localStorage.removeItem('sessionData'); 
    window.open('../?signout=all', '_self'); 
  })
}
window.cancelSudo = function(){
  return;  
}

function showFull(n){
  if(!n){ // access history
    $('#tb_access').html(''); 
    for(let i of ahFull){
      $('#tb_access').append(`<tr><td>${moment(i.ts).format('ddd M/D h:mm A')}</td><td>${i.method}</td><td>${i.ip}</td></tr>`)
    }
  }
  else{
    $('#tb_login').html(''); 
    for(let i of lhFull){
      $('#tb_login').append(`<tr><td>${i.time?moment(i.time).format('ddd M/D h:mm A'):'n/a'}</td><td>${parseUA(i.ua)}</td><td>${i.ip}</td></tr>`)
    }
  }
}

window.onload = function() {
  M.AutoInit(); 
  $.get('account/data').then(r => {
    // Profile
    if (r.demoUser) $('#about-demo').show(); 
    $('#user').text(r.profile.fullName); 
    $('#userStr').text(r.userID); 
    $('#userJoin').text(moment(r.created).format('MMMM D, YYYY'))
    $('#tcg_user').text(r.stats.checksPerDay); 
    // $('#tcg_avg').text(r.stats.checksPerDayAvg); 
    $('#trm_user').text(r.stats.totalRequests);
    $('#sp-gr').text(r.profile.grade); 
    $('#sp-school').text(r.profile.school); 
    // History and Sessions
    for(let n = 0; n < r.accessHistory.length; n++){
      let i = r.accessHistory[n]; 
      if(n === 15){
        ahFull = r.accessHistory; 
        $('#tb_access').append(`<tr><td colspan='3' class='light-blue-text bw' style='cursor: pointer' onclick='showFull(0)'><i class='fas fa-plus'></i> Show ${r.accessHistory.length - 15} more entries</td></tr>`); 
        break; }
      $('#tb_access').append(`<tr><td>${moment(i.ts).format('ddd M/D h:mm A')}</td><td>${i.method}</td><td>${i.ip}</td></tr>`)
    }
    for(let n = 0; n < r.loginHistory.length; n++){
      let i = r.loginHistory[n]; 
      if(n === 10){
        lhFull = r.loginHistory; 
        $('#tb_login').append(`<tr><td colspan='3' class='light-blue-text bw' style='cursor: pointer' onclick='showFull(1)'><i class='fas fa-plus'></i> Show ${r.loginHistory.length - 10} more entries</td></tr>`); 
        break; }
      $('#tb_login').append(`<tr><td>${i.time?moment(i.time).format('ddd M/D h:mm A'):'n/a'}</td><td>${parseUA(i.ua)}</td><td>${i.ip}</td></tr>`)
    }
    for(let i of r.activeSessions){
      $('#tb_sessions').append(`<tr><td>${i.session.lastAccessed?moment(i.session.lastAccessed).subtract(7, 'days').format('ddd M/D h:mm A'):'n/a'}${i.session.preserve?'':'<b class="red-text bw">*</b>'}</td><td>${parseUA(i.session.ua)}</td><td>${i.session.loginIP}</td><td>${i.session.ip}</td></tr>`)
    }
    // Security keys
    if (r.waKeys.length > 0) {
      $('#keys-count').html(`You currently have <b class='light-green-text bw'>${r.waKeys.length}</b> security key${r.waKeys.length===1?'':'s'} registered with OpenVUE.`)
      $('#tb_keys').html(r.waKeys.reduce((c, r) => c+`<tr><td>${r.name?r.name:'<i>No Friendly Name</i>'}</td><td title="${r.keyId}">${(r.keyId).slice(0,12)}...</td><td>${moment(r.lastUsed).format('ddd M/D h:mm A')}</td></tr>`, '')); 
    } else {
      $('#keys-table').hide(); 
    }
    // Show contents
    $('#loading').hide(); 
    $('.section').show();
  }).fail(r => {
    if(r.status === 403){
      window.open('../signin?from=account', '_self'); 
    } else{
      $('#loading').html(`<h4><i class='fas fa-exclamation-triangle'></i> Unable to load account info.</h4>`)
    }
  }); 
}