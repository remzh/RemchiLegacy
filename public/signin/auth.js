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

function showSuccess(){
  $('#div-msg').addClass('msg-success');
  $('#msg-title').show();
  $('#msg-title').text('Success.');
  $('#msg-content').text(`You're now signed in.`);

  if($('#c_rem')[0].checked){
    localStorage.adm_remUser = $('#i_user').val()}
  else{
    localStorage.removeItem('adm_remUser')}

  setTimeout(function(){
    window.open('../admin/dashboard', '_self')
  }, 900); 
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

function login(){
  if(!canLogin){return}
  if(!navigator.onLine){
    showError('You appear to be offline (20).')
    return; 
  }
  else if($('#i_user').val().length < 4){
    $('#i_user').focus();
    $('#l_user').addClass('active');
    showError('Your username is invalid (21).')
    return; 
  }
  else if($('#i_pass').val().length < 6){
    $('#i_pass').focus();
    $('#l_pass').addClass('active');
    showError('Your password is invalid (22).')
    return; 
  }
  
  canLogin = false; // Prevent duplicate logins
  loadBar.start(2500);
  let reqDone = false;
  let req = $.post('../admin/signin', {user: $('#i_user').val(), pass: $('#i_pass').val()}, (res) => {
    reqDone = true;
    if(res.type !== 'success'){
      lb.pause();
      loadBar.finish('#e53');
      setTimeout(function(){
        canLogin = true;
        loadBar.hide(); 
      }, 200)
      showError(`${res.error}`)
    }
    else{
      lb.pause();
      loadBar.finish('#1c3');
      showSuccess();
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

$('#i_user, #i_pass').on('keypress', (e) => {
  if(e.which === 13){
    login();
  }
  hideMsg();
})

window.onload = function(){
  setTimeout(function(){
    if(localStorage.adm_remUser){
      $('#i_user').val(localStorage.adm_remUser); 
      $('#l_user').addClass('active');
      $('#i_pass').focus();
      $('#l_pass').addClass('active');
      $('#c_rem')[0].checked = true;
    }
    else{
      $('#i_user').focus();
      $('#l_user').addClass('active');
    }
  }, 1)
}