let theme = window.matchMedia("(prefers-color-scheme: dark)").matches?'dark':'light';
window.matchMedia("(prefers-color-scheme: dark)").addListener(() => {
  theme = window.matchMedia("(prefers-color-scheme: dark)").matches?'dark':'light';
  $('#css-theme').prop('href', `css/start-${theme}.css`); 
})
$('#css-materialize')[0].href = `../css/materialize/${theme}.css`
$('#css-theme').prop('href', `css/start-${theme}.css`); 

let dt = {}, th = new Date().getHours(); ; 
if (th > 2 && th <=11){ 
  dt = {img: (th<6?'n':'d-sr'), msg: 'Morning'}}
else if (th <= 17){ 
  dt = {img: (th == 17?'d-ss':'d-af'), msg: 'Afternoon'}}
else{
  dt = {img: (th == 18?'d-ss':'n'), msg: 'Evening'}}
$('#bk').css('background-image', `url(images/${dt.img}.jpg)`);

M.AutoInit(); 