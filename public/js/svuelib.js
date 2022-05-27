// StudentVUE Function Library
// (C) 2021 Ryan Zhang. All Rights Reserved. 
// 
// Helper functions for SVUE (parsing, manipulation, server communication)

const rlib = {
  isMobile: window.matchMedia('only screen and (max-width : 600px)').matches, // screen size check only
  toast: {
    error: (msg, dur=4000) => {
      return M.toast({
        html: `<i style='padding-right: 4px' class='fas fa-times-circle fa-fw'></i> ${msg}`, 
        classes: 'red darken-1', 
        displayLength: dur
      })
    }, 
    warn: (msg, dur=4000) => {
      return M.toast({
        html: `<i style='padding-right: 4px' class='fas fa-exclamation-triangle fa-fw'></i> ${msg}`, 
        classes: 'yellow lighten-1 black-text', 
        displayLength: dur
      })
    }, 
    success: (msg, dur=4000) => {
       return M.toast({
        html: `<i style='padding-right: 4px' class='fas fa-check fa-fw'></i> ${msg}`, 
        classes: 'green darken-2', 
        displayLength: dur
      }); 
    }, 
    info: (msg, dur=4000) => {
       return M.toast({
        html: `<i style='padding-right: 4px' class='fas fa-info-circle fa-fw'></i> ${msg}`, 
        classes: 'blue darken-1', 
        displayLength: dur
      }); 
    }
  }, 
  parseFloat: (num) => { // parseFloat that supports commas in numbers
    return parseFloat(num.replace(/,/g, '')); 
  }, 
  trim: (str, l=20) => {
    if(str.length <= l+4) return str; 
    str = str.slice(0, l+4); 
    if(str.slice(l-4).indexOf(' ') !== -1){
      return str.slice(0, (str.slice(l-4).indexOf(' ') + (l-4))) + '...'
    }
    return str.slice(0, l) + '...'
  }, 
  curPopup: false, 
  popup: function (url, w, h) {
    if(this.curPopup)(this.curPopup.close()); 
    let dualScreenLeft = window.screenLeft != undefined ? window.screenLeft : window.screenX;
    let dualScreenTop = window.screenTop != undefined ? window.screenTop : window.screenY;
    let width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
    let height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;
    let systemZoom = width / window.screen.availWidth;
    let left = (width - w) / 2 / systemZoom + dualScreenLeft
    let top = (height - h) / 2 / systemZoom + dualScreenTop
    this.curPopup = window.open(url, '_blank', 'scrollbars=yes, width=' + w / systemZoom + ', height=' + h / systemZoom + ', top=' + top + ', left=' + left);
    if(!this.curPopup){
      // popup blocked 
      this.deferredURL = url; 
      M.Modal.init($('#modal-confirmPass')[0], {'dismissible': false}); 
      M.Modal.getInstance($('#modal-confirmPass')[0]).open(); 
    }
    else{
      this.curPopup.onunload = window.cancelSudo; 
    }
    // if (this.curPopup.focus) this.curPopup.focus();
  }, 
  openDeferredPopup: function(){
    this.curPopup = window.open(this.deferredURL, '_blank');
    this.curPopup.onunload = window.cancelSudo; 
    M.Modal.getInstance($('#modal-confirmPass')[0]).close(); 
  }, 
  closePopup: function(){
    this.curPopup.close(); 
    this.curPopup = false; 
  }, 
  errorStack: [], 
  copyStack: function(){
    $('#modal-errorStack-ta').show(); 
    $('#modal-errorStack-ta').val($('#modal-errorStack-data').text());  
    let dt = $('#modal-errorStack-ta')[0]; 
    dt.select(); 
    dt.setSelectionRange(0, 999999); 
    document.execCommand('copy'); 
    dt.blur(); 
    $('#modal-errorStack-ta').hide(); 
    this.toast.success('Copied to Clipboard.');
  }
}

window.addEventListener('error', function(event) { 
  if(rlib.errorStack.length === 0){
    $('#li-error').show(); 
    $('#modal-errorStack-data').append(`<span class='bw light-blue-text'>[UA] ${this.navigator.userAgent}</span>\n`); 
  } else {
    $('#li-error-msg').text(`${rlib.errorStack.length} Errors`); 
  }
  let errorDetails = event.error; 
  if (!errorDetails) {
    errorDetails = {
      message: 'Cross-origin script error.', 
      stack: 'Must open browser console to view details.'
    }; 
  }
  rlib.errorStack.push({event: errorDetails, time: Date.now()});   
  $('#modal-errorStack-data').append(`<span class='bw red-text'>[${rlib.errorStack.length}] [Window] ${moment().format('MM/DD/YY hh:mm:ss A')}</span>\n<span class='bw yellow-text'>${errorDetails.message}</span>\n<span class='bw orange-text'>${errorDetails.stack}</span>\n`);
  if(rlib.isMobile){
    rlib.toast.error('Remchi has encountered an error. Open your sidebar for more details.');
  }
})

if (typeof Vue !== 'undefined') {
  Vue.config.errorHandler = function(error, v, info) {
    if(rlib.errorStack.length === 0){
      $('#li-error').show(); 
      $('#modal-errorStack-data').append(`<span class='bw light-blue-text'>[UA] ${this.navigator.userAgent}</span>\n`); 
    } else {
      $('#li-error-msg').text(`${rlib.errorStack.length} Errors`); 
    }
    rlib.errorStack.push({event: error, time: Date.now()});   
    $('#modal-errorStack-data').append(`<span class='bw red-text'>[${rlib.errorStack.length}] [Vue: ${info}] ${moment().format('MM/DD/YY hh:mm:ss A')}</span>\n<span class='bw yellow-text'>${error.message}</span>\n<span class='bw orange-text'>${error.stack}</span>\n`);
    if(rlib.isMobile){
      rlib.toast.error('Remchi has encountered an error. Open your sidebar for more details.');
    }
  }
}

window.onresize = () => {
  rlib.isMobile = window.matchMedia('only screen and (max-width : 600px)').matches; 
}

const gcEngine = {
  weighted: function(cur){
    let c = cur / 100; 
    let v = parseFloat(cb.gc.worth); // item point values
    let t = parseFloat(cb.gc.targetGrade) / 100; // target grade
    let p = parseFloat(cb.weights[cb.gc.category].$.Points); // current points in category
    let q = parseFloat(cb.weights[cb.gc.category].$.PointsPossible); // total points in category
    let w = parseFloat(cb.weights[cb.gc.category].$.Weight) / 100; // weight of category selected
    // console.log(c, v, t, p, q, w);
    
    let d = (t-c); // grade difference desired
    let r; 
    if(q > 0){
      // (p/q)*w = ((p+(r*v))/(q+v))*w - d, solve for r
      // https://www.wolframalpha.com/input/?i=(p%2Fq)*w+%3D+((p%2B(r*v))%2F(q%2Bv))*w+-+d,+solve+for+r
      r = (d*(q+v))/(v*w) + (p/q);
    }
    else{
      // Case where there isn't anything in the category (and Synergy adjusts the other categories to make up for it)
      // t = c(1-w) + r*w
      // https://www.wolframalpha.com/input/?i=t+%3D+c(1-w)+%2B+r*w,+solve+for+r
      r = (t-c*(1-w))/w;
    }
    
    return (Math.round(r * 100000)/1000); // Round to 3 decimal places
  }, 
  unweighted: function(cur, total){ // cur = current total points, total = total points in (unweighted) class
    let r = parseFloat(cb.gc.targetGrade) / 100; // target grade
    let v = parseFloat(cb.gc.worth); // point value of assignment
    let c = cur, t = total; 
    let s = r*(t+v) - c; // points needed
    return (Math.round((s/v) * 100000)/1000); 
  }
}

const gradeEngine = {
  // function markup
  // @param items - input as "Assignment" object from SVUE
  // @param weights - optional - weights from "AssignmentGradeCalc" object
  // NOTE items are directly modified, no return produced
  markup: function(items, preserve=false) {
    let index = 0; 
    if(!preserve) items = items.filter(e => !e.$.$custom); // remove custom items
    
    for(let item of items){
      item.$.$index = index; 
      index++; 
      if(preserve && item.$.$originalScore){
        continue; // preserve modification
      }
      if(item.$.$originalScore) delete item.$.$originalScore; // remove any modifications present
      if(item.$.Points.indexOf('/') === -1){
        if(item.$.Points.indexOf('Points Possible') !== -1){
          if(item.$.$points) delete item.$.$points; 
          item.$.$totalPoints = parseFloat(item.$.Points)}
        continue}
      let points = item.$.Points.split('/'); 
      item.$.$hasScore = true; 
      if(item.$.Notes === '(Not For Grading) '){
        item.$.$points = 0;  
        item.$.$totalPoints = 0;  
        continue; 
      }
      item.$.$points = parseFloat(points[0]); 
      item.$.$totalPoints = parseFloat(points[1]); 
    }

    return items; 
  }, 
  markChange: function(items, weights=false){
    items.reverse(); 
    let cg = 0; // current grade
    for(let i = 0; i < items.length; i++){
      let item = items[i]; 
      let grade = this.calcGrade(items.slice(0, i+1), weights); 
      item.$.$gradeAtTime = grade.toFixed(2) + '%'; 
      if(typeof item.$.$points !== 'undefined'){
        let diff = Math.round(100*(grade-cg))/100; 
        if(diff > 0){
          item.$.$change = `+${diff.toFixed(2)}%`;
          item.$.$changeColor = 'green-text bw'; 
        }
        else if(diff < 0){
          item.$.$change = `${diff.toFixed(2)}%`;
          item.$.$changeColor = `${diff<-1.5?'red-text':'orange-text'} bw`; 
        }
        else{
          item.$.$change = '+0.00%'; 
          item.$.$changeColor = 'bw'; 
        }
        cg = grade; 
      }
      else{
        item.$.$change = 'n/a'; 
        item.$.$changeColor = 'gray'; 
      }
    }
    items.reverse(); 
  }, 
  // note that this requires $points and $totalPoints
  calcGrade: function(items, rawWeights){
    if(items.length === 0){return 0}
    if(rawWeights){
      let weights = {}; 
      for(weight of rawWeights){
        if(weight.$.Type === 'TOTAL'){continue}
        weights[weight.$.Type] = {
          weight: parseFloat(weight.$.Weight), 
          pts: 0, 
          total: 0
        }
      }
      for(let i of items){
        if(typeof i.$.$points !== 'undefined' && weights[i.$.Type]){ // item isn't counted if it doesn't have points (ie. items that are "not graded"), nor if it points to a nonexistent category
          weights[i.$.Type].pts += i.$.$points; 
          weights[i.$.Type].total += i.$.$totalPoints; 
        }
      }
      let s = 0; // score / grade
      let z = 0; // % of weights with no points - Synergy ignores those fields
      for(let n in weights){
        let i = weights[n]; 
        if(i.pts !== 0){
          z += i.weight; 
          s += ((i.pts / i.total) * i.weight); 
        }
      }
      if(z !== 100){
        s = s * (100 / z)}
      return Math.round(s*10000)/10000; 
    }
    else{
      let pts = 0; 
      let total = 0; 
      for(let i of items){
        if(typeof i.$.$points !== 'undefined'){
          pts += i.$.$points; 
          total += i.$.$totalPoints; 
        }
      }
      return Math.round(1000000*pts/total)/10000; 
    }
  },
  // function genChartData
  // @param items - FORMATTED items (items must have been passed through this.markChange first)
  genChartData: function(items, weights=false) {
    let out1 = []; 
    let out2 = []; 
    let out2names = []; 
    let out_min = 80; 
    let out_max = 100;
    let itemsSorted = items.slice(0); // do not change input
    itemsSorted = itemsSorted.sort((a, b)=>{ // sort by date
      return (moment(a.$.Date, 'MM/DD/YYYY') - moment(b.$.Date, 'MM/DD/YYYY')); 
    })
    for(let v = 0; v < itemsSorted.length; v++){
      let i = itemsSorted[v]; 
      if(!i.$.$gradeAtTime){continue;} // item has no grade
      let actualGrade = this.calcGrade(itemsSorted.slice(0, v+1), weights); 
      if(actualGrade < out_min){out_min = actualGrade}
      else if(actualGrade > out_max){out_max = actualGrade}
      out1.push({
        x: i.$.Date, 
        y: Math.round(actualGrade*10)/10
      }); 
      if(i.$.$totalPoints > 0){
        let itemScore = Math.round(1000 * (i.$.$points/i.$.$totalPoints))/10; 
        out2.push({
          x: i.$.Date, 
          y: itemScore
        }); 
        out2names.push({
          measure: i.$.Measure,
          score: `${i.$.$points} / ${i.$.$totalPoints}`
        }); 
        if(itemScore < out_min){out_min = itemScore}
        else if(itemScore > out_max){out_max = itemScore}
      }
      else if(i.$.$points > 0 && i.$.$totalPoints === 0){ // extra credit
        out2.push({
          x: i.$.Date, 
          y: 100
        }); 
        out2names.push({
          measure: '' + i.$.Measure,
          score: `+${i.$.$points} EC`, 
          ec: true
        })
      }
    }
    return {
      overall: out1, 
      individual: out2, 
      supplemental: out2names,
      overallMin: Math.floor(out_min), 
      overallMax: Math.ceil(out_max)
    }
  }
}

let markHistory = {}; // Used for undoing marking
const svueLib = { 
  parseAssignments: (data) => {
    try {
      let res = {}; 
      let courses = data;
      if (!courses) { // no courses
        return {}; 
      }
      for(let i = 0; i < courses.length; i++){
        let id = courses[i]; 
        let itemList = []; 
        let pendingList = []; 
        if (!courses[i].Marks || courses[i]._m) {
          // Not a course (metadata item)
          continue; 
        }
        let marks =  courses[i].Marks[0]; 
        if(!marks){ // Selected class does not have gradebook data
          res[id.$.Title] = {
            grade: -2, 
            items: [] };
          continue; 
        }
        let items = marks.Mark[0].Assignments[0].Assignment; 
        if(!items){ // No assignments in the selected class
          res[id.$.Title] = {
            grade: -1, 
            items: [] };
          continue; 
        }
        for(let j = 0; j < items.length; j++){
          if(items[j].$.Score.slice(0, 3) === 'Not'){
            pendingList.push(items[j].$.GradebookID)}
          itemList.push(items[j].$.GradebookID); 
        }
        res[id.$.Title] = {
          grade: parseFloat(id.Marks[0].Mark[0].$.CalculatedScoreRaw), 
          items: itemList, 
          pending: pendingList
        };
      }
      return res;
    }
    catch(err){
      rlib.toast.error('(Contact Devs!) fatal: unhandled exception at svueLib.parseAssignments: ' + err.message);
      console.error(err);
      return []; 
    }
  }, 
  diffAssignments: (current, stored) => {
    let diff = {}; 
    for(let i in current){
      if(!stored[i]){diff[i] = current[i]; continue}
      diff[i] = {}; 
      diff[i]['items'] = current[i]['items'].filter(item => stored[i]['items'].indexOf(item) === -1); 
      if(localStorage.cfg_markPendingAsNew !== '1'){ 
        if(current[i]['pending']){ 
          for(let j of current[i]['pending']){ // Remove pending items from "new" (items) and add to pending
            if(diff[i]['items'].indexOf(j) !== -1){
              diff[i]['items'].splice(diff[i]['items'].indexOf(j), 1); 
              // if(stored[i]['pending'])
              if(diff[i]['pending']){
                diff[i]['pending'].push(j)}
              else{
                diff[i]['pending'] = [j]}
            }
          }
        }
      }
    }
    return diff;
  }, 
  mark: (course, ids, mode, hideMsg) => {
    return new Promise((resolve) => {
      if(!navigator.onLine){
        rlib.toast.warn('You cannot mark items when offline.')
        resolve({type: 'error', msg: 'No internet connection'});
        return; 
      }
      if(typeof ids === 'string') {ids = [ids]};
      $.post('../data/updateHistory', {
        course: course, 
        data: ids.join(','), 
        mode: mode
      }).done((res) => {
        if(mode){
          cbDiff[course]['items'] = cbDiff[course]['items'].filter(item => ids.indexOf(item) === -1)}
        else{
          cbDiff[course]['items'].push(...ids)}
        let rID = 'r'+Math.round(Math.random()+100000*899999); 
        markHistory[rID] = [course, ids, mode];
        if(!hideMsg) {
          let t = rlib.toast.success(`Marked ${ids.length} item${ids.length===1?'':'s'} as ${mode?'seen':'new'}.&nbsp;<a href='#' class='light-blue-text text-lighten-3' data-id='${rID}' onclick='svueLib.undoMark(this)'>(Undo)</a>`); 
          markHistory[rID][3] = t; 
        }
        resolve({type: 'success', res: res}); 
      }).fail((res) => {
        M.toast({
          html: `<i style='padding-right: 4px' class='fas fa-exclamation-triangle fa-fw'></i> An error occured: ${JSON.parse(res.response).msg}`, 
          classes: 'yellow lighten-1 black-text'
        });
        if(JSON.parse(res.response).desc){
          M.toast({
            html: `<i style='padding-right: 4px' class='fas fa-caret-right fa-fw'></i>${JSON.parse(res.response).desc}`, 
            classes: 'yellow lighten-1 black-text'
          });
        }
        console.log(res); 
        resolve({type: 'success', res: res}); 
      })
    })
  }, 
  undoMark: (ele) => {
    let id = ele.dataset.id; 
    let obj = markHistory[id]; 
    svueLib.mark(obj[0], obj[1], (obj[2]?0:1), true).then(r => { // server doesn't accept "true" or "false", so obj[2]?0:1 is used instead
      if(r.type === 'success'){
        M.Toast.getInstance(obj[3].el).dismiss(); 
        rlib.toast.success(`Undid marking ${obj[1].length} item${obj[1].length===1?'':'s'}.`);
        cb.$forceUpdate(); 
        cbList.cl.$forceUpdate();
      }
    })
  }
}