let opaqueNavbar = false; 
window.onscroll = function(){
  if(window.scrollY > 60 && !opaqueNavbar){
    opaqueNavbar = true; 
    $('#nav').removeClass('nav-top'); 
  }
  else if(window.scrollY <= 60 && opaqueNavbar){
    opaqueNavbar = false; 
    $('#nav').addClass('nav-top'); 
  }
}

if(localStorage.cfg_theme === 'dark' || (localStorage.cfg_theme === 'match' && window.matchMedia('(prefers-color-scheme: dark)').matches) || (!localStorage.cfg_theme && window.matchMedia('(prefers-color-scheme: dark)').matches)){
  $('#a-theme').html(`<i class='fas fa-sun'></i>`);
  document.head.insertAdjacentHTML('beforeend', `<link id='css-dark' rel='stylesheet' href='css/landing-dark.css'/>`);
} else {
  $('#top').css('background-image', `url('/images/scenic.jpg')`); 
}

$('#a-theme').on('click', () => {
  if($('#css-dark').length > 0){
    $('#a-theme').html(`<i class='fas fa-moon'></i>`);
    $('#top').css('background-image', `url('/images/scenic.jpg')`);
    $('#css-dark').remove(); 
    localStorage.cfg_theme = 'light'; 
  } else{
    $('#a-theme').html(`<i class='fas fa-sun'></i>`);
    $('#top').css('background-image', '');
    document.head.insertAdjacentHTML('beforeend', `<link id='css-dark' rel='stylesheet' href='css/landing-dark.css'/>`);
    localStorage.cfg_theme = 'dark'; 
  }
})

async function validateSession() {
  $.get('account/sessionState').then(r => {
    if(!r.signedIn){
      localStorage.removeItem('sessionData'); 
      window.open('../?signout=exp', '_self');
    }
  }); 
}

const quotes = {
  next: () => {
    M.Slider.getInstance($('#quotes')[0]).next(); 
  }, 
  prev: () => {
    M.Slider.getInstance($('#quotes')[0]).prev(); 
  }
}

window.onload = function(){
  M.AutoInit(); 
  M.Dropdown.init($('#btn-more')[0], {
    constrainWidth: false
  }); 
  M.Slider.init($('#quotes')[0], {
    indicators: false
  })
  window.onscroll();
  $('#ver-str').text(`${window.svueVer.stage} ${window.svueVer.str} (${window.svueVer.date})`);
  $('#ver-build').text(window.svueVer.build);
  $('#ver').show();

  if(location.hostname === 'itsryan.tk'){
    $('#notice').show(); 
  }

  let params = new this.URLSearchParams(this.location.search); 
  if(params.get('signout')){
    switch(params.get('signout')){
      case 'true': 
        M.toast({
          html: `<i style='padding-right: 4px' class='fas fa-check fa-fw'></i> You've signed out.`, 
          classes: 'green darken-2', 
          displayLength: 4000
        }); 
        break; 
      case 'all': 
        M.toast({
          html: `<i style='padding-right: 4px' class='fas fa-check fa-fw'></i> You've signed out everywhere.`, 
          classes: 'green darken-2', 
          displayLength: 6000
        }); 
        break; 
      case 'exp': 
        M.toast({
          html: `<i style='padding-right: 4px' class='fas fa-info-circle fa-fw'></i> Your session has expired.`, 
          classes: 'blue darken-1', 
          displayLength: 6000
        }); 
    }
  }

  let icon = false;  
  if($.ua.os.name === 'Android'){
    icon = 'fab fa-android'} 
  else if($.ua.os.name === 'iOS'){
    icon = 'fab fa-apple'}
  else if($.ua.os.name === 'Windows' && $.ua.browser.name === 'Chrome'){
    icon = 'fab fa-chrome'}
  else if($.ua.os.name === 'Windows' && $.ua.browser.name === 'Edge' && parseInt($.ua.browser.version) > 78){ // chromium based edge
    icon = 'fab fa-edge'}
  if(icon) {
    $('#btn-app').prop('href', 'https://svue.itsryan.org/app/install');
    $('#btn-app-inner').prop('disabled', false)
    $('#btn-app-inner').prepend(`<i id='btn-app-icon' class='${icon}'></i> `)
  }
  if(localStorage.sessionData){
    try{
      let s = JSON.parse(atob(localStorage.sessionData)); 
      if(s.exp < Date.now()){
        localStorage.removeItem('sessionData'); 
        return }
      $('#header').text(`Hi ${s.name}!`);
      $('#btn-signin').hide(); 
      $('#btn-open').show(); 
      $('#btn-more').show();
      $('#a-nav-start').text('Open Dashboard');
      $('#a-nav-start').prop('href', 'dashboard'); 
      validateSession();
    } catch (err) {
      localStorage.removeItem('sessionData'); 
    }
  }
}