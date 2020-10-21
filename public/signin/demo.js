let currentTheme = 'light'; 
if(localStorage.cfg_theme === 'dark' || (window.matchMedia("(prefers-color-scheme: dark)").matches && localStorage.cfg_theme !== 'light')){
  $('#a-theme').text('Light Theme'); 
  currentTheme = 'dark'; 
  $('head').append(`<link id='css-dark' rel='stylesheet' type='text/css' href='../css/auth-dark.css'>`)}
else{
  $('#a-theme').text('Dark Theme')}

window.matchMedia("(prefers-color-scheme: dark)").addListener(() => {
  if(window.matchMedia("(prefers-color-scheme: dark)").matches){
    currentTheme = 'dark'; 
    $('#a-theme').text('Light Theme'); 
    $('head').append(`<link id='css-dark' rel='stylesheet' type='text/css' href='../css/auth-dark.css'>`)
  }
  else{
    $('#a-theme').text('Dark Theme'); 
    $('#css-dark').remove(); 
  }
}); 

M.AutoInit();
let canLogin = true; 
let loadBar = {
  start: (t) => {
    lb = anime({
      targets: '#div-loadbar',
      duration: t?t:1500,
      width: '90%',
      easing: 'easeInOutSine'
    });
  },
  finish: (bk) => {
    anime({
      targets: '#div-loadbar',
      duration: 200,
      width: '100%',
      background: bk,
      easing: 'easeOutSine'
    }); 
  },
  hide: () => {
    anime({
      targets: '#div-loadbar',
      duration: 400,
      opacity: 0,
      easing: 'easeOutSine', 
      complete: function(anim){
        $('#div-loadbar').css({'width': '0', 'opacity': '1', 'background': ''});
      }
    }); 
  }
}

function showError(msg, h){
  if(h){$('#msg-title').hide()} else{$('#msg-title').show()}
  $('#msg-title').text('Error:');
  $('#msg-content').html(msg);
  anime({
    targets: '#div-msg',
    duration: 400,
    opacity: 1, 
    height: '32px',
    marginTop: '2px',
    marginBottom: '6px',
    paddingTop: '4px',
    paddingBottom: '4px',
    easing: 'easeOutSine'
  });
}

function showSuccess(user, isNew){
  $('#div-msg').addClass('msg-success');
  $('#msg-title').show();
  if(!isNew){
    $('#msg-title').text('Success.');
    $('#msg-content').text(`You're now signed in with the demo account!`);
    if($('#demo-showWelcome')[0].checked){sessionStorage.isNew = '1'}
    setTimeout(function(){
      window.open('../dashboard', '_self')
    }, 1500); 
  }
  else{
    $('#msg-title').text('');
    $('#msg-content').text(`The demo account isn't set up. Contact devs.`);
  }
  anime({
    targets: '#div-msg',
    duration: 400,
    opacity: 1, 
    height: '32px',
    marginTop: '2px',
    marginBottom: '6px',
    paddingTop: '4px',
    paddingBottom: '4px',
    easing: 'easeOutSine'
  });
}

function login(){
  if(!canLogin){return}
  if(!navigator.onLine){
    showError('You appear to be offline (20).')
    return; 
  }

  canLogin = false; // Prevent duplicate logins
  loadBar.start(2500);
  let reqDone = false;
  let req = $.post('demo/auth', {}, (res) => {
    reqDone = true;
    if(res.type !== 'success'){
      lb.pause();
      loadBar.finish('#e53');
      setTimeout(function(){
        canLogin = true;
        loadBar.hide(); 
      }, 200)
      showError(`${res.msg} (${res.error})`)
    }
    else{
      lb.pause();
      loadBar.finish('#1c3');
      sessionStorage.fullName = res.data.fullName;
      sessionStorage.school = res.data.school;
      localStorage.sessionData = btoa(JSON.stringify({name: res.data.firstName, exp: res.data.expires}));
      showSuccess(res.data.firstName, res.data.new, res.data.new?[res.data.fullName, res.data.school]:null);
    }
  })
  setTimeout(() => {
    if(!reqDone){
      req.abort(); 
      lb.pause();
      loadBar.finish('#e53');
      setTimeout(function(){
        canLogin = true;
        loadBar.hide();
      }, 200); 
      showError('The request timed out. Please try again (29).')}
  }, 4750);
}