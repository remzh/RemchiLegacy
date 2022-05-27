let pwaPrompt; 

function swInstall(){
  navigator.serviceWorker
    .register('../sw.js')
    .then(function(registration) {
      console.log('Service Worker Registered');
      console.log(registration);
    })
    .catch(function(err) {
      console.log('Service Worker Failed to Register', err);
    })
}

function checkRes(v){
  $('#div-check').hide(); 
  if(v === 0){ // Not all requirements were met
    $('#div-msg').show(); 
    $('#msg-icon').addClass('red-text fa-exclamation-triangle'); 
    $('#msg-txt').text(`Your browser is too old to support the Remchi Web App.`);
    $('#div-minRequirements').show();
  }  
  else if(v === 1){
    $('#div-ready').show(); 
    $('#installBtn').on('click', (e) => {
      $('#installBtn').prop('disabled', true); 
      pwaPrompt.prompt(); 
      pwaPrompt.userChoice.then((res) => {
        if(res.outcome === 'accepted'){
          localStorage.app_installed = '1';
          $('#div-ready').hide(); 
          $('#div-installed').show(); 
        }
        else{
          $('#msg-refresh').show();
        }
      })
    })
  }
  else if(v === 2){
    $('#div-installed').show(); 
  }
  else if(v === 3){
    $('#div-msg').show(); 
    $('#msg-icon').html(`'<i class='fas fa-info-circle blue-text'></i>`)
    $('#msg-txt').text(`You're already in the Remchi App!`);
  }
}

function runChecks(){
  $('#div-browserInfo').show(); 
  $('#info-browser').html(`${$.ua.browser.name} ${$.ua.browser.major}`);
  $('#info-os').html(`${$.ua.os.name} ${$.ua.os.version}`);
  switch($.ua.os.name){
    case 'iOS': 
      $('.sp-os').html(`<i class='fab fa-apple'></i>`); 
      break; 
    case 'Android': 
      $('.sp-os').html(`<i class='fab fa-android'></i>`); 
      break; 
    case 'Windows': 
      $('.sp-os').html(`<i class='fab fa-windows'></i>`); 
      break; 
    default: 
      $('.sp-os').html(`<i class='fas fa-mobile-alt'></i>`); 
      break }
  if ('serviceWorker' in navigator) {
    swInstall(); 
    if(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true){
      checkRes(3); 
      return; 
    }
    else if($.ua.os.name === 'iOS'){
      window.open('install-ios', '_self');
    }
    setTimeout(function(){
      if(!pwaPrompt){
        $('#div-check').hide(); 
        if(localStorage.app_installed === '1'){
          $('#div-msg').show(); 
          $('#msg-icon').html(`<i class='fas fa-check green-text'></i>`)
          $('#msg-txt').text(`It looks like you've already installed the Remchi app.`);
        }
        else{
          setTimeout(function(){ // may take ~5s before everything gets installed and ready
            if(!pwaPrompt){
              $('#div-msg').show(); 
              $('#msg-icon').html(`'<i class='fas fa-exclamation-triangle orange-text'></i>`)
              $('#msg-txt').text(`Your browser does not appear to support installing Remchi.`);
              $('#div-minRequirements').show(); 
            }
          }, 7500); 
        }
      }
    }, 1500); 
  }
  else{
    checkRes(0); 
  }
}

window.onload = function(){
  setTimeout(runChecks, 400);
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); 
  pwaPrompt = e; 
  checkRes(1); 
})

window.addEventListener('onappinstalled', (e) => {
  e.preventDefault(); 
  localStorage.app_installed = '1';
  checkRes(2);
})