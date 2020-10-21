M.AutoInit();
let canLogin = true; 
let cont = false; 
let lb = false; 
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
  if(ele1 === '#ccD'){updateDomain()}
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

$('#a-theme').on('click', () => {
  if(currentTheme === 'light'){
    currentTheme = 'dark'; 
    $('#a-theme').text('Light Theme'); 
    $('head').append(`<link id='css-dark' rel='stylesheet' type='text/css' href='css/auth-dark.css'>`)
  }
  else{
    currentTheme = 'light'; 
    $('#a-theme').text('Dark Theme'); 
    $('#css-dark').remove(); 
  }
  localStorage.cfg_theme = currentTheme; 
}) 

function showError(msg, h, ext){
  if(h){$('#msg-title').hide()} else{$('#msg-title').show()}
  $('#msg-title').text('Error:');
  $('#msg-content').html(msg);
  anime({
    targets: '#div-msg',
    duration: 400,
    opacity: 1, 
    height: ext?'56px':'32px',
    marginTop: '2px',
    marginBottom: '6px',
    paddingTop: '4px',
    paddingBottom: '4px',
    easing: 'easeOutSine'
  });
}

function showSuccess(user, isNew, data){
  $('#div-msg').addClass('msg-success');
  $('#msg-title').show();
  if(!isNew){
    $('#msg-title').text('Success.');
    $('#msg-content').text(`Welcome back, ${user}!`);
    setTimeout(function(){
      window.open(cont?`../${cont}${location.hash}`:'../dashboard', '_self')
    }, 900); 
  }
  else{
    $('#msg-title').text('');
    $('#cc4_name').text(user);
    $('#msg-content').text(`Hi ${user}, Welcome to OpenVUE!`);
    setTimeout(function(){reqConsent(...data)}, 1200);
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

function reqConsent(name, school){
  $('#cc2_name').text(name); 
  $('#cc2_school').text(school); 
  loadBar.hide();
  transition('#cc1', '#cc2');
}

function consent(m){
  if(!m){
    window.open('../signout', '_self')
  }
  else if(m === 2){
    transition('#cc2', '#cc3'); 
  }
  else{
    $('#tosAccCancel').hide(); 
    $('#tosAcc').prop('disabled', true); 
    $('#tosAcc').html(`Creating Account...`);
    loadBar.start(9500); 
    let reqDone = false;
    let req = $.post('auth/setConsent', {'ts': Date.now()}, (res) => {
      reqDone = true;
      if(res.status === 'error'){
        loadBar.finish('#e53');
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
        $('#msg2-content').text(res.error);
      }
      else{
        $('#tosAcc').html(`Account Created!`);
        sessionStorage.isNew = '1'; 
        lb.pause();
        loadBar.finish('#1c3');
        transition('#cc3', '#cc4');
        setTimeout(loadBar.hide, 800);
      }
    });
    setTimeout(() => {
      if(!reqDone){
        req.abort(); 
        lb.pause();
        loadBar.finish('#e53');
        setTimeout(function(){
          canLogin = true;
          loadBar.hide();
        }, 200); 
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
        $('#tosAccCancel').show(); 
        $('#tosAcc').prop('disabled', false); 
        $('#tosAcc').html(`Retry`);
        $('#msg2-content').text('The request timed out. Please try again (29).');
      }
    }, 12000);
  }
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
  else if($('#i_pass').val().length < 4){
    $('#i_pass').focus();
    $('#l_pass').addClass('active');
    showError('Your password is invalid (22).')
    return; 
  }
  
  canLogin = false; // Prevent duplicate logins
  loadBar.start(2500);
  let reqDone = false;
  let req = $.post('/signin', {user: $('#i_user').val(), pass: $('#i_pass').val(), domain: localStorage.domain.split('\\')[1], rem: $('#c_rem')[0].checked}, (res) => {
    reqDone = true;
    if(res.type !== 'success'){
      lb.pause();
      loadBar.finish('#e53');
      setTimeout(function(){
        canLogin = true;
        loadBar.hide(); 
      }, 200)
      if(res.msgExt){
        showError(`${res.msgExt} (${res.error})`, 0, 1)
      } else{
        showError(`${res.msg} (${res.error})`)
      }
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

function drop(b){
  M.Dropdown.getInstance($('#div-domain')[0]).close(); 
  if(b){ // change district
    transition('#cc1', '#ccD');
  } else{ // open district portal
    window.open(`https://${localStorage.domain.split('\\')[1]}`, '_blank');
  }
}

function showDrop(){
  M.Dropdown.getInstance($('#div-domain')[0]).open(); 
}

function selDomain(e, v){
  let ele = $(e)
  localStorage.domain = `${$(ele).children().first().text()}\\${$(ele).children().last().text()}`;  
  transition('#ccD', '#cc1')
}

function updateDomain(){
  $('#s-domain').text(localStorage.domain.split('\\')[0]); 
  $('#s-domainURL').text(localStorage.domain.split('\\')[1]); 
}

function lookupDomain(){
  delete $('#h_domain')[0].dataset.success; 
  loadBar.start(2500);
  let reqDone = false;
  let req = $.post('/signin/lookup', {input: $('#i_domain').val()}, (res) => {
    reqDone = true;
    if(res.type !== 'success'){
      lb.pause();
      loadBar.finish('#e53');
      setTimeout(function(){
        loadBar.hide(); 
      }, 200)
      $('#h_domain')[0].dataset.error = res.msg;
      $('#i_domain').removeClass('valid'); 
      $('#i_domain').addClass('invalid'); 
    }
    else{
      lb.pause();
      loadBar.finish('#1c3');
      setTimeout(loadBar.hide, 200);
      if(res.url){
        $('#h_domain')[0].dataset.success = 'Success! Select your district to confirm.';
        $('#domainOut').html(`<div class='domain' tabindex='0' onkeypress='selDomain(this)' onclick='selDomain(this)'><span class='domainName'>${res.name}</span><span class='domainURL'>${res.url}</span></div>`)
      } else if(res.list){
        $('#h_domain')[0].dataset.success = 'Success! Select your district below.';
        $('#domainOut').html('');
        res.list.forEach(r => {
          $('#domainOut').append(`<div class='domain' tabindex='0' onkeypress='selDomain(this)' onclick='selDomain(this)'><span class='domainName'>${r.name}</span><span class='domainURL'>${r.url}</span></div>`)
        })
      } else{
        $('#h_domain')[0].dataset.error = 'Response data missing. Contact devs.';
        $('#i_domain').removeClass('valid'); 
        $('#i_domain').addClass('invalid'); 
      }
    }
  })
  setTimeout(() => {
    if(!reqDone){
      req.abort(); 
      lb.pause();
      loadBar.finish('#e53');
      setTimeout(function(){
        loadBar.hide();
      }, 200); 
      $('#h_domain')[0].dataset.error = 'Request timed out. Try again.';
      $('#i_domain').removeClass('valid'); 
      $('#i_domain').addClass('invalid'); 
    }
  }, 4750);
}

$('#i_user, #i_pass').on('keypress', (e) => {
  if(e.which === 13){
    login();
  }
  hideMsg();
})

$('#i_domain').on('keypress', (e) => {
  if(e.which === 13){
    lookupDomain(); 
  }
  hideMsg();
})

window.onload = function(){
  $('#ccL').hide();
  if(localStorage.domain){
    updateDomain(); 
    $('#cc1').show(); 
  } else{
    $('#ccD').show(); 
  }
  M.Dropdown.init($('#div-domain')[0], {
    constrainWidth: false, 
    closeOnClick: false, 
    container: document.body
  }); 
  let params = new this.URLSearchParams(this.location.search); 
  if(params.get('from')){
    if(params.get('from').indexOf(':') === -1){
      cont = params.get('from')}
    if(localStorage.sessionData){localStorage.removeItem('sessionData')}
    showError('Please sign in to continue.', 1)}
  if(window.svueVer.app){
    $('#lnk-app').show()}
  setTimeout(function(){
    $('#i_user').focus();
    $('#l_user').addClass('active');
  }, 1)
}