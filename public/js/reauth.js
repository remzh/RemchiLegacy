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

function transition(ele1, ele2){
  anime({
    targets: ele1, 
    translateX: '-110%', 
    duration: 400, 
    easing: 'easeInSine', 
    complete: ((anim) => {
      $(ele1).hide();
      $(ele2).show();
      $(ele2).css({'transform':'translateX(110%)'});
      anim.reset(); 
      anime({
        targets: ele2, 
        translateX: '0%', 
        duration: 400, 
        easing: 'easeOutSine'
      })
    })
  })
}

let currentTheme = 'light'; 
if(localStorage.cfg_theme === 'dark' || (window.matchMedia("(prefers-color-scheme: dark)").matches && localStorage.cfg_theme !== 'light')){
  $('#a-theme').text('Light Theme'); 
  currentTheme = 'dark'; 
  $('head').append(`<link id='css-dark' rel='stylesheet' type='text/css' href='css/auth-dark.css'>`)}
else{
  $('#a-theme').text('Dark Theme')}

window.matchMedia("(prefers-color-scheme: dark)").addListener(() => {
  if(window.matchMedia("(prefers-color-scheme: dark)").matches){
    currentTheme = 'dark'; 
    $('#a-theme').text('Light Theme'); 
    $('head').append(`<link id='css-dark' rel='stylesheet' type='text/css' href='css/auth-dark.css'>`)
  }
  else{
    $('#a-theme').text('Dark Theme'); 
    $('#css-dark').remove(); 
  }
}); 

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

function showSuccess(b){
  $('#div-msg').addClass('msg-success');
  $('#msg-title').show();
  $('#msg-title').text('Success.');
  if(window.opener && !b){
    $('#msg-content').text('Please wait...');
    window.opener.window.confirmSudo(); 
  } else{
    if (location.search === '?action=registerKey') {
      $('#msg-content').html('<a href="/account" target="_self">Click here</a> if you\'re not redirected shortly.');
    } else {
      $('#msg-content').text('You can now close this tab.');
    }
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

function hideMsg(){
  anime({
    targets: '#div-msg',
    duration: 200,
    opacity: 0, 
    height: '0px',
    marginTop: '0px',
    marginBottom: '0px',
    paddingTop: '0px',
    paddingBottom: '0px',
    easing: 'easeOutSine'
  });
}

function cancel(){
  canLogin = false; 
  $('#btn-continue').prop('disabled', true); 
  showSuccess(1); 
  window.close(); 
  if (location.search === '?action=registerKey') {
    window.open('/account', '_self');
  }
}

function login(){
  if(!canLogin){return}
  if(!navigator.onLine){
    showError('You appear to be offline (20).')
    return; 
  }
  else if($('#i_conf').val().length < 4){
    $('#i_conf').focus();
    $('#i_conf').addClass('active');
    showError('Your password is invalid (22).')
    return; 
  }
  
  canLogin = false; // Prevent duplicate logins
  loadBar.start(2500);
  let reqDone = false;
  let req = $.post('/signin/sudo', {pass: $('#i_conf').val()}, (res) => {
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
      if (location.search === '?action=registerKey') {
        transition('#cc1', '#cc2')
        loadBar.hide(); 
      } else {
        showSuccess();
      }
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

async function waInit(mode) {
  let res = await waSignup(mode); 
  if (res && res.ok) {
    loadBar.finish('#1c3');
    transition('#cc2', '#cc3'); 
  } else {
    loadBar.finish('#e53');
    $('#waError-msg').text(res.error ? res.error:'An unknown error occurred.');
    anime({
      targets: '#div-msg2',
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
}

$('#i_conf').on('keypress', (e) => {
  if(e.which === 13){
    login();
  }
  hideMsg();
})

window.onload = function(){
  if(sessionStorage.fullName){
    $('#i_user').val(sessionStorage.fullName);
  } else if(localStorage.sessionData){
    try {
      $('#i_user').val(JSON.parse(atob(localStorage.sessionData)).name)}
    catch (e) {
      $('#i_user').val('User')
    }
  } else{
    $('#i_user').val('User')
  }
  setTimeout(function(){
    $('#i_conf').focus();
  }, 1)
}