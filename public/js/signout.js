if(localStorage.cfg_theme === 'dark' || ((localStorage.cfg_theme === 'match' || !localStorage.cfg_theme) && window.matchMedia('(prefers-color-scheme: dark)').matches)){
  $('head').append(`<link rel='stylesheet' type='text/css' href='css/auth-dark.css'>`)}

function clearPrefs(){
  localforage.removeItem('localImage'); 
  localStorage.removeItem('cfg_markPendingAsNew');
  localStorage.removeItem('cfg_nickname');
  localStorage.removeItem('cfg_theme');
  localStorage.removeItem('cfg_main');
  $('#so').html('You have successfully signed out. <br><span style="font-weight:300">If you haven\'t already, consider closing any other open windows of OpenVUE.</span><br/><br/>Your preferences have been removed.')
}

window.onload = function(){
  if(window.svueVer.app){$('#btn-home').text('Launch Page')}
  $('#btn-home').on('click', () => {
    if(window.svueVer.app){
      window.open('../app/start?persist=1', '_self')}
    else{
      window.open('..','_self')}
  }); 
  localforage.removeItem('gbd-metadata');
  localforage.removeItem('gbd-cache');
  localforage.removeItem('gbd-hist');
  $.get('signout/status', (r) => {
    $('button').prop('disabled', false);
    sessionStorage.removeItem('fullName');
    localStorage.removeItem('sessionData');
    if(r.status === 'error'){
      $('#so').html(`Your session information couldn\'t be completely removed. Try reloading the page.<br><br><span style="font-weight:300">Error Info: ${r.error}</span>`)
    }
    else{
      $('#so').html('You have successfully signed out. <br><span style="font-weight:300">If you haven\'t already, consider closing any other open windows of Remchi.</span><br/><br/>Preferences are kept by default in case you sign in again. <br><span style="font-weight:300">If you would also like to delete your preferences, <a href="#" onclick="clearPrefs()">click/tap here</a>.</span>')
    }
  })
}