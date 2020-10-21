window.onload = function(){
  M.AutoInit();
  $('#ios').html($.ua.os.name + ' '+$.ua.os.version);
  $('#ios-p').addClass(theme==='dark'?'darken-3':'accent-1');
  $('.grey-text').addClass(theme==='dark'?'text-lighten-1':'text-darken-2'); 
  if($.ua.os.name !== 'iOS'){
    $('#ios-p').addClass('red');
    $('#ios-details').html(`<i class='fas fa-exclamation-triangle'></i> We're not sure how you got here, but there's nothing for you to do here.`); 
  }
  else{
    let ver = parseFloat($.ua.os.version.split('.').slice(0, 2).join('.'));
    if(ver < 11.3){
      $('#ios-p').addClass('orange');
      $('#ios-details').html(`<i class='fas fa-exclamation-triangle'></i> Your device is not compatible.<br>Update to a newer version of iOS if you can, otherwise, your device simply won't support the app.`); 
    }
    else if(ver < 12.2){
      $('#ios-p').addClass('yellow');
      $('#ios-details').html(`While the app will run on iOS 11.3-12.1, app sessions won't persist (along with other issues).<br>This means that exiting the app will also immediately force the app to close.`); 
      $('#instructions').show(); 
      $('#add-img').prop('src', `images/ios-add-${theme}.jpg`); 
    }
    else{
      $('#ios-p').addClass('green');
      $('#ios-details').html(`You're ready to go! Installation only takes a few seconds. Read on for instructions.`); 
      $('#instructions').show(); 
      $('#add-img').prop('src', `images/ios-add-${theme}.jpg`); 
    }
  }
}

window.matchMedia("(prefers-color-scheme: dark)").addListener(() => {
  theme = window.matchMedia("(prefers-color-scheme: dark)").matches?'dark':'light';
  $('#add-img').prop('src', `images/ios-add-${theme}.jpg`); 
  $('#ios-p').removeClass('darken-3 accent-1');
  $('#ios-p').addClass(theme==='dark'?'darken-3':'accent-1');
  $('.grey-text').removeClass('text-lighten-1 text-darken-2');
  $('.grey-text').addClass(theme==='dark'?'text-lighten-1':'text-darken-2'); 
})