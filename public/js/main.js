// main.js
// (C) 2021 Ryan Zhang. All Rights Reserved. 
// 
// Main script, used for all functions in the Gradebook tab as well as global / shared functions (settings, page navigation, etc.)

let cbList = { 
  cl: !1, 
  rp: !1, 
  ts: 0, // timestamp the current list was loaded
  isUpdating: false, // while true, any calls to changeRP and refresh won't do anything
  openRP: () => {
    if (cbList.rp) cbList.rp.all = svcore.getRPList(); 
    M.Modal.getInstance($('#modal-reportingPeriod')[0]).open(); 
  }, 
  /**
   * Changes the reporting periods shown in the course list. 
   * @param {boolean} [reset=false] Whether to reset the reporting periods to default 
   * @returns {undefined}
   */
  changeRP: function(reset) {
    if (!cbList.rp) {
      // No reporting periods exist
      rlib.toast.info(`You do not have any other reporting periods.`); 
      M.Modal.getInstance($('#modal-reportingPeriod')[0]).close(); 
      return;
    }
    let target; 
    if (reset) {
      let isDefault = true; 
      for (let i of cbList.rp.all) {
        if (i.default !== i.selected) isDefault = false; 
      }
      if (isDefault) {
        rlib.toast.info(`You're already in the default reporting periods.`); 
        return; 
      }
      target = cbList.rp.all.filter(r => r.default).map(r => r._guid); 
    } else {
      target = cbList.rp.all.filter(r => r.selected).map(r => r._guid); 
    }
    if (target.length === 0) {
      rlib.toast.error('You must select at least one reporting period.'); 
    } else {
      M.Modal.getInstance($('#modal-reportingPeriod')[0]).close(); 
      this.refresh(target); 
    }
  }, 
  /**
   * Either forces an update of both the gradebook and the item history, or switches the reporting periods shown (called via @function changeRP above) 
   * @param {array} [rp] - array of reporting periods to change to, if desired 
   * @param {number} [mode=1] - mode to fetch (0 = cache first, 1 = network only, 2 = cache only)
   */
  refresh: async function(rp, mode=1) {
    if (this.isUpdating && mode !== 2) return; 
    this.isUpdating = true;
    updateWeather(); 
    cbList.cl.banner.refresh = rp?'L-Loading your selected reporting periods...':'L-Refreshing your gradebook...'; 
    let gb; 
    if (!rp && svcore._rpSel.length === 0) {
      gb = await svcore.fetchCurrentGB(mode); 
    } else {
      gb = await svcore.fetchGradebook(rp?rp:svcore._rpSel, mode?mode:(rp?0:1)); 
    }
    let hist = await svcore.getItemHist();
    if (gb.ok) {
      if (this.cl && this.cl.banner.cache) this.cl.banner.cache = false; // remove "cache available" popup
      cbData = gb.data;
      cbDiff = svueLib.diffAssignments(svueLib.parseAssignments(cbData), hist);
      cbList.cl.course = cbData; 
      cbList.cl.$forceUpdate(); 
      if (mode !== 2) {
        cbList.cl.banner.refresh = 'C-Successfully updated.'; 
        $('.sp-lastUpdated').html(`<i class='fas fa-check fa-fw'></i> Just Updated`)
        cbList.ts = Date.now(); 
      } else {
        cbList.cl.banner.refresh = `C-You're now using a cached version of your gradebook.`; 
        cbList.ts = gb.ts*1000; 
        $('.sp-lastUpdated').html(`<i class='fas fa-info-circle fa-fw'></i> Last updated ${moment().to(cbList.ts)}`); 
        if (!bellSchedule.dispData.school) bellSchedule.init(svcore.getSchool()); // init bell schedule since it wasn't previously done
      }
      setTimeout(function() {
        cbList.isUpdating = false; 
        cbList.cl.banner.refresh = false; 
      }, mode!==2?1600:2400); 
    } else {
      setTimeout(() => {
        cbList.isUpdating = false; 
        cbList.pushMessage({icon: 'e', bk: 'e', text: `Failed to update: ${gb.error}`}); 
      }, 490); 
      setTimeout(() => {
        cbList.cl.banner.refresh = false; 
      }, 370); 
      // cbList.cl.banner.refresh = `E-Failed to update: ${gb.error}`; 
    }
  }, 
  /**
   * Pushes a message to the message stack, to be shown as one or more banners on top of the course list. If a duplicate message is requested, it will be ignored. 
   * @param {object} obj - {[icon]: ("E"/"I"/"C" for error, info, or checkmark respectively), [bk]: ("E"/"C" for error or check/success respectively), text: (string to display)}
   */
  pushMessage: function (obj) {
    if (this.cl.banner.messages && !this.cl.banner.messages.find(r => r.text === obj.text))
    this.cl.banner.messages.push({
      icon: obj.icon?obj.icon.toUpperCase():false, 
      bk: obj.bk?obj.bk.toUpperCase():false, 
      text: obj.text
    }); 
  }, 
  /**
   * Opens the changelog, dismisses the "new update" banner, and updates the most recently seen changelog to the current one.
   */
  showChangelog: function () {
    this.cl.banner.update = false; 
    if (!localStorage.lastChangelog) this.pushMessage({icon: 'I', text: `You can return to the changelog anytime under More Actions 🡒 Show Changelog.`});
    M.Modal.getInstance($('#modal-whatsnew')[0]).open();
    localStorage.lastChangelog = $('#modal-whatsnew')[0].dataset.build;
  }, 
  /**
   * 
   */
  dismissChangelog: function () {
    this.cl.banner.update = false; 
    if (!localStorage.lastChangelog) this.pushMessage({icon: 'I', text: `Message dismissed. To show the changelog again, go to More Actions 🡒 Show Changelog.`});
    localStorage.lastChangelog = $('#modal-whatsnew')[0].dataset.build;
  }, 
}
let cbData, cbDiff = {}; 
let cbChart, cbChartSup; // cbChart instance, supplementary cbChart data

let reporting = {current: null, all: null, school: null}; // reporting periods / concurrent schools

let currentPage = 'gradebook';
let gbTimestamp = 0; // timestamp of when grades were last fetched
let fb_shown = 0; // "fixed bar" - the thing that comes down when scrolling down a course

// Initiation
function initMaterialize(){
  M.AutoInit();
  $('.dropdown-trigger').each((i, e) => { // drop: no constraint (on width)
    M.Dropdown.getInstance(e).options.closeOnClick = false;
    if(!e.className.includes('drop-ncl')){ // emulate close on click behavior (unless .drop-ncl exists), bc Materialize manages to somehow screw it up in iOS 13
      $('#'+e.dataset.target).on('click', () => {
        M.Dropdown.getInstance(e).close(); 
      })
    }
  }); 
  $('.drop-nc').each((i, e) => { // drop: no constraint (on width)
    M.Dropdown.getInstance(e).options.constrainWidth = false;
  })
}

function initDropdown(e) {
  // same as initMaterialize, except for JIT-created dropdowns
  M.Dropdown.init(e, {
    closeOnClick: false
  }); 
  $('#'+e.dataset.target).on('click', () => {
    M.Dropdown.getInstance(e).close(); 
  })
}

// Main / shared libraries

let v_shared = {
  showNew: true, // whether courselist and gradelist will mark "new" assignments as new -- can be disabled in settings for current reporting period, and always disabled for non-current reporting periods
  trimTitle: (str) => {
    if(str.indexOf('(') !== -1){
      str = str.slice(0, str.lastIndexOf('('))}
    let sem = str.match(/S\d/)
    if(sem){str = str.slice(0, sem.index)}
    if(str.slice(-1) === ' '){str = str.slice(0, -1)}
    if(str === 'ExtendedLearningOpportunity'){return 'ELO'}
    return str
  }, 
  getID: (str) => {
    if(str.indexOf('(') === -1) {return '0000'}
    return str.slice(str.lastIndexOf('(')+1, str.lastIndexOf(')'))
  },
  svueLib: svueLib, 
  gradeEngine: gradeEngine
}

let config = { // Client-side configurations
  animSpeed: '1', // Multiplier. JS doesn't care if you're multiplying a number by a string!
  matchTheme: true, // match system preference
  theme: 'light', // light or dark
  noHighlights: false, // not used
  usePointValue: false,  // Use "Points" (or "Score" instead, if disabled)
  sidenavHL: true, // whether current tab is highlighted or not
  newIndicator: true, // disabling it will supress the new indicator
  markPendingAsNew: false, // when disabled, items won't be marked as "new" until they have a grade (no longer pending)
  skipMarkingWait: false, // when enabled, opening a course and immediately closing out will still mark the items as seen
  alwaysShowGC: true, // grade changes, NOT grade calculator
  quickActions: ['trends', 'filter']
}

let systemScheme = window.matchMedia("(prefers-color-scheme: light)"); 
if(config.matchTheme){
if(systemScheme.matches) {
  config.theme = 'light'}
else{
  config.theme = 'dark'}}
if(systemScheme.addEventListener){
  systemScheme.addEventListener('change', () => {
    if(!config.matchTheme) {return}
    config.theme = systemScheme.matches?'light':'dark'; 
    updateTheme(); 
  }); 
}
else if(systemScheme.addListener){
  systemScheme.addListener(() => {
    if(!config.matchTheme) {return}
    config.theme = systemScheme.matches?'light':'dark'; 
    updateTheme(); 
  }); 
}
else{
  rlib.toast.error('Your device is not supported. Features may not work properly.')
}

if(!config.matchTheme && (localStorage.cfg_theme === 'dark' || localStorage.cfg_theme === 'light')){
  config.theme = localStorage.cfg_theme}

if(localStorage.cfg_main){
  try{
    let configTmp = JSON.parse(atob(localStorage.cfg_main)); 
    for (i in configTmp){ 
      config[i] = configTmp[i]}
    updateSettings(0, 1); 
  }
  catch(e){rlib.toast.warn('It appears your settings file is corrupted. They have been reset to default settings.'); rlib.toast.warn(e.stack)}
}

function updateTheme(){ // does the "theme" subset of updateSettings
  if(cbChart){
    Chart.defaults.global.defaultFontColor = (config.theme==='light'?'black':'white');
    cbChart.update()}
  $('#css-theme')[0].href = `css/materialize/${config.theme}.css`
  if(config.imgTheme){
    $('#css-theme-secondary')[0].href = `css/bkimg-${config.theme}.css`}}
updateTheme();

let pending = {
  course: '', 
  items: [], 
  time: 0
}

function updateDiffDB(){ // store changes made in gbDiff to indexedDB
  localforage.setItem('gbDiff', { 
    timestamp: Date.now(), 
    diff: cbDiff
  }); 
}

function pushAllActions(){ // Marks everything that's "unseen" as "seen" in the current class
  if(cbDiff[pending.course]['items'].length > 0){
    svueLib.mark(pending.course, cbDiff[pending.course]['items'], 1).then((r) => {
      updateDiffDB(); 
      cb.$forceUpdate();
      pending.items = []; // Remove items from "pending"
    });
  }
  else{
    rlib.toast.success('You\'ve already seen everything!')
  }
}

function pushPendingActions(){ // Mark items as seen after leaving the page if >1.6s has passed
  if(!v_shared.showNew || !navigator.onLine){
    return; // don't do it if it's disabled or if offline
  }
  pending.items = pending.items.filter((item) => {
    return (cbDiff[pending.course]['items'].indexOf(item) !== -1) // 
  }); 
  if(pending.items.length > 0){
    if(Date.now() > pending.time + 1600 || config.skipMarkingWait){
      svueLib.mark(pending.course, pending.items, 1).then((r) => {
        updateDiffDB();
        cbList.cl.$forceUpdate();
      });
    }
  }
  pending.items = []; 
}

function detImportance(name, cat){ // Figure out how "important" an assignment is
  /* Scale: 
  0 - Not Important (homework, classwork, etc.)
  1 - Important (quizzes, essays, labs, timed writes, etc.)
  2 - Very Important (tests / exams, projects, summatives)
  3 - Extremely Important (finals, and only finals)
  */
  let imp = 0; 
  let n = name.toLowerCase();  
  let c = cat.toLowerCase(); 
  let b = `${c} ${n}`; // both name and category
  if(b.match(/pre.?test/) || b.match(/sign.?up/) || b.indexOf('practice') !== -1 || b.indexOf('correction') !== -1){
    return 0}
  if(b.indexOf('final') !== -1){
    return 3} 
  let imp2 = ['test', 'exam', 'assessment', 'free response', 'project', 'summative']; 
  for(let i = 0; i < imp2.length; i++){
    if(b.indexOf(imp2[i]) !== -1){
      return 2
    }
  }
  let imp1 = ['quiz', 'timed write', 'essay', 'lab', 'formative', 'case study', 'challenge problem']; 
  for(let i = 0; i < imp1.length; i++){
    if(n.indexOf(imp1[i]) !== -1){
      return 1}
    else if(c.indexOf(imp1[i]) !== -1){
      if(c.indexOf('assignment') !== -1 || c.indexOf('homework') !== -1 || c.indexOf('lab') !== -1 && n.indexOf('lab') === -1){
        continue}
      else{return 1}
    }
  }
  return 0; 
}

function hideElement(ele){
  return new Promise((res) => {
    if(config.noAnim){$(ele).hide(); res(ele)}
    else{
      anime({
        targets: ele, 
        duration: 270 * config.animSpeed, 
        opacity: 0, 
        translateY: config.reduceMotion?'':'-20%', 
        easing: 'easeInSine', 
        complete: (() => {
          $(ele).hide();
          res(ele);
        })
      })
    }
  })
}

function showElement(ele){
  return new Promise((res) => {
    if(config.noAnim){$(ele).show(); $(ele).css({'opacity': 1, 'transform': '', 'display': 'block', 'position': 'relative'}); res(ele)}
    else{
      $(ele).css({'opacity':0, 'transform': config.reduceMotion?'':'translateY(-20%)'});
      $(ele).show();
      anime({
        targets: ele, 
        duration: 270 * config.animSpeed, 
        opacity: 1, 
        translateY: 0,
        easing: 'easeOutSine', 
        complete: (() => {
          res(ele); 
        })
      });
    }
  })
}

function aw_timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))}

/**
 * Navigates between different pages, and creates a fetch request to load content if necessary.
 * As of build 817, this function will enforce connectivity requirements for external pages (attendance, messages, etc.)
 * @param {string} targetPage - page to go to
 * @param {boolean} [hideOnly] - if true, will hide targetPage instead of showing it
 * @param {boolean} [noHist=false] - whether to create a history entry or not
 */
let _pageNav_inProgress = false; 
async function pageNav(targetPage, hideOnly, noHist){ 
  if((targetPage == 'notifier' || targetPage == 'export' || (targetPage == 'attendance' && !attendance.loaded) || (targetPage == 'messages' && !messages.loaded)) && !navigator.onLine){
    rlib.toast.error(`You'll need an internet connection for that.`)
    return; 
  }
  if (_pageNav_inProgress) return; 

  _pageNav_inProgress = true; 
  $('.sidenav-hl').removeClass('sidenav-hl'); 

  if(typeof hideOnly === 'object'){ // add highlighting 
    if(config.sidenavHL){
      $(hideOnly).parent().addClass('sidenav-hl'); 
    }
    hideOnly = false; 
  }

  switch(hideOnly?targetPage:currentPage){
    case 'gradebook': 
      await hideElement('#v-gradeList');
      break; 
    case 'schedule': 
      await hideElement('#v-schedule');
      break; 
    case 'notifier': 
      await hideElement('#v-notifier'); 
      break;
    case 'gradebook-details':
      hideCourseDetails(1); // Hide and also push any updates (ex: marking things as seen) for #v-course-outer
      await aw_timeout(300); 
      break; 
    case 'attendance': 
      await hideElement('#v-attendance');
      break;
    case 'messages': 
      await hideElement('#v-messages'); 
      break;
    case 'courseHistory': 
      await hideElement('#courseHistory'); 
      break; 
    case 'roadmap': 
      await hideElement('#ext-roadmap');
      break;
    case 'export': 
      await hideElement('#ext-export');
      break;
    case 'settings': 
      await hideElement('#v-settings');
      break;
  }
  $('.material-tooltip').css({top: false, left: false, transform: false}); // move tooltips that shouldn't be there out of the way
  if(hideOnly){_pageNav_inProgress = false; return; }
  window.scrollTo(0, 0); // return to top
  let pagePath = false; 
  switch(targetPage){
    case 'gradebook': 
      await showElement('#v-gradeList');
      break;
    case 'schedule': 
      bellSchedule.update(); 
      await showElement('#v-schedule');
      break; 
    case 'notifier': 
      if(!nt.ready) nt.update(); 
      await showElement('#v-notifier'); 
      break;
    case 'attendance': 
      if(!attendance.loaded) attendance.update(); 
      await showElement('#v-attendance');
      break;
    case 'messages': 
      if(!messages.loaded) messages.update(); 
      await showElement('#v-messages'); 
      break;
    case 'courseHistory': 
      await showElement('#courseHistory'); 
      break; 
    case 'roadmap': 
      loadExternal('ext-roadmap', '/static/roadmap'); 
      await showElement('#ext-roadmap');
      break;
    case 'export': 
      pagePath = 'export'; 
      loadExternal('ext-export', '/static/export'); 
      await showElement('#ext-export');
      break; 
    case 'settings': 
      await showElement('#v-settings');
      v_config.$_init(); 
      break;
  }
  currentPage = targetPage;
  if(!noHist){
    window.history.pushState({
      'type': 'page', 
      'page': targetPage
    }, '', pagePath?pagePath:'/dashboard#'+targetPage); 
  }
  _pageNav_inProgress = false; 
  return true;
}

// Gradebook module

let cb = new Vue({
  el: '#v-course-outer',
  diff: cbDiff,
  data: {
    items: [], 
    history: [],
    shared: v_shared, 
    filters: {
      categories: [], 
      string: '',
      points: {
        min: null, 
        max: null
      }
    },
    gc: { // grade calculator
      category: '0', 
      worth: 100, 
      targetGrade: 90, 
      result: '', // Score needed (as a string) 
      resDetails: '', // Point information for unweighted grades and items not out of 100 pts
      helper: '' // Helper text for score
    },
    course: {
      Title: '', // Kept uppercase to maintain consistency with Synergy
      Staff: '', 
      Period: '', 
      $index: -1 // position in cbData
    }, 
    grade: {
      CalculatedScoreRaw: '', 
      CalculatedScoreString: ''
    }, 
    weighted: false, 
    showWeights: false, 
    showFilter: false,
    showGC: false, 
    showTrends: false, 
    showChanges: false, // tied to config.alwaysShowGC 
    weights: [], 
    currentDropItem: {
      id: '', 
      details: {}, 
      new: false, 
      custom: false
    }, 
    addWhatIf: { // fields in the "add what-if" modal
      category: '(Select One)', 
      name: '', 
      pts: '', 
      total: ''
    }
  }, 
  methods: {
    $_trim: v_shared.trimTitle, 
    $_getScore: (item) => { // returns [(num) score, (num) score out of, (num) percentage, (bool) isEC], or false if there is no score
      if(item.Score.slice(0, 3) === 'Not' && !item.$originalScore){return false}
      if(item.$originalScore){ // edited assignment
        let res = [item.$points, item.$totalPoints, item.$points / item.$totalPoints, (item.$points !== 0 && item.$totalPoints === 0)];
        if(!config.usePointValue && !res[3] && item.$hasScore){ // score conversion is only done if a) enabled in settings, b) item is not an extra credit assignment, and c) item had an original score (aka not pending)
          let scoreOutOf = parseFloat(item.Score.split(' out of ')[1]);
          if(item.$originalScore[1] !== scoreOutOf && item.$totalPoints === item.$originalScore[1]){ // scale points to score if the totalPoints value wasn't modified
            let scale = scoreOutOf / item.$totalPoints; 
            res[0] = Math.round(item.$points * scale * 100) / 100; 
            res[1] = scoreOutOf; 
          }
        }
        return res; 
      }
      else{ // non edited assignment
        if(item.Points.indexOf('/') === -1){
          return [-1, -1, 0, 0]} // no grade ("__ points possible")
        let raw = (config.usePointValue || item.Score.indexOf(' out of ') === -1)?item.Points.split('/'):item.Score.split(' out of '); 
        return [parseFloat(raw[0]), parseFloat(raw[1]), parseFloat(raw[0])/parseFloat(raw[1]), (parseFloat(item.Points.split('/')[0]) !== 0 && parseFloat(item.Points.split('/')[1]) === 0)]; 
      }
    }, 
    $_formatPerc: function(item) {
      let score = this.$_getScore(item); 
      if(!score || isNaN(score[2])){
        return ''}
      if(score[3]){
        return 'EC'
      }
      let vals = score[2]; 
      vals *= 1000; 
      if(vals >= 1000){vals = Math.round(vals / 10)} // No decimal point for >= 100%
      else{vals = Math.round(vals) / 10}
      return vals + '%'; 
    }, 
    $_formatScore: function (item) {
      let score = this.$_getScore(item); 
      if(!score){
        if(parseFloat(item.Points) > 0){return item.Score + ` (${parseFloat(item.Points)} pts)`}
        return item.Score // Not Graded, Not Due, etc.
      }
      if(score[3]){
        return `(+${score[0]} pt${score[0]===1?'':'s'})`;
      }
      if(!this.$_isCounted(item) && score[1] === 0 && item.Score.indexOf(' out of ') === -1){
        return `(Raw: ${item.Score})`; // raw, uncounted value
      }
      return `(${score[0]}/${score[1]})`; 
    }, 
    $_formatPB: function (item) { // Progress bar coloring
      let score = this.$_getScore(item); 
      if(!score){
        return ['', '']}
      let color = 'green'
      let perc = score[2]; 
      let isEC = score[3]; 
      if(perc > 1 || isEC){perc = 1; color = 'cyan'}
      else{
        if (perc < 0.8){color = 'yellow'}
        if(perc < 0.85){color = 'lime'}
        else if(perc < 0.9){color = 'light-green'}}
      return [color, `width: ${Math.round(perc*100)}%`];
    }, 
    $_formatPt: (item) => {
      return rlib.parseFloat(item.$.Points) + '/' + rlib.parseFloat(item.$.PointsPossible);
    }, 
    $_formatAvg: (item) => {
      if(rlib.parseFloat(item.$.PointsPossible) === 0){return 'N/A'}
      let mark = item.$.CalculatedMark; 
      let avg = rlib.parseFloat(item.$.Points) / rlib.parseFloat(item.$.PointsPossible); 
      return Math.round(avg*1000)/10 + `% (${mark})`;
    }, 
    $_detClass: (v, item) => {
      // if(config.noHighlights){return {}}
      // let isNew = false;
      let classes = [];
      let imp = 0; 
      if(v === 2){
        imp = detImportance('', item)} // Category-only filter
      else{
        imp = detImportance(item.Measure, item.Type)}
      if(imp > 0){
        if(v){classes.push('hlt')} // Styled "category" box
        classes.push('hl-i'+imp) // Push highlight "importance"
      }

      if(cbDiff[cb.course.Title]){ // make sure cbDiff for course exists
        if(v_shared.showNew && cbDiff[cb.course.Title].items.indexOf(item.GradebookID) !== -1){
          classes.push('hl-new')} // New item
      }
      return classes;
    }, 
    $_calcNew: (id, mode) => { // Calculate how many new items are in a class
      if(v_shared.showNew && cbDiff[id]){
        if(mode) {return (cbDiff[id]['items'].length === 0 ? 'gray':'green-text bw')}
        return cbDiff[id]['items'].length}
      return mode?'gray':0
    },
    $_isNew: (id) => {
      if(v_shared.showNew && cbDiff[cb.course.Title].items.indexOf(id) !== -1){return true}
      return false
    }, 
    $_isPending: (id) => {
      if(!cbDiff[cb.course.Title]){return false}
      if(cbDiff[cb.course.Title]['pending']){
        if(cbDiff[cb.course.Title]['pending'].indexOf(id) !== -1){
          return true}
        return false}
      return false
    }, 
    $_isModified: (item) => { // Whether the assignment was edited or not
      if(item.$originalScore) return true; 
      return false; 
    },
    $_setActionDrop: function(event, item){ // Show the dropdown for the item
      let currentTarget = event.currentTarget; // Bind target so that event.currentTarget doesn't become null after closing dropdown
      let id = item.$.GradebookID; 
      this.currentDropItem.pending = this.$_isPending(id); 
      this.currentDropItem.new = this.$_isNew(id); 
      this.currentDropItem.custom = item.$.$custom; 
      this.currentDropItem.id = id; 
      this.currentDropItem.details = item.$; 
      this.currentDropItem.details.imp = detImportance(item.$.Measure, item.$.Type); 
      this.currentDropItem.details.imp_class = this.$_detClass(1, item.$); 
      this.currentTarget = currentTarget; // iOS 13 glitch workaround

      M.Dropdown.init(currentTarget, {
        constrainWidth: false, 
        closeOnClick: false, // fixes iOS 13 glitch
      }); 
      M.Dropdown.getInstance(currentTarget)._placeDropdown(); 
      setTimeout(() => {
        M.Dropdown.getInstance(currentTarget).open(); 
      }, 1);
    }, 
    $_showNote: function(event, note){ // Create a tooltip with the item's note
      let target = event.currentTarget; 
      M.Tooltip.init(target, {
        position: 'top', 
        html: note, 
        margin: 0
      }); 
      M.Tooltip.getInstance(target).open();
    }, 
    $_isCounted: function (item){ // returns false if an item has the note "Not For Grading" or is entered as 0/0 pts with a non-zero score
      let pts = item.Points.split('/'); 
      let score = item.Score.split('out of'); 
      if(item.Notes.trim() === '(Not For Grading)'){
        return false;
      }
      if(pts.length === 2 && score.length === 2){
        if(parseFloat(pts[0]) === 0 && parseFloat(pts[1]) === 0 && parseFloat(score[0]) !== 0){
          return false;
        }
        else if(item.$points === 0 && item.$totalPoints === 0){
          return false;
        }
      }
      return true; 
    }, 
    $_dropAction: function(action){ // An action was clicked on the dropdown menu
      M.Dropdown.getInstance(this.currentTarget).close(); 
      if(action === 0 || action === 1){
        svueLib.mark(this.course.Title, [this.currentDropItem.id], action).then((r) => {
          if(r.type === 'success'){
            updateDiffDB(); 
            this.$forceUpdate(); 
          }
        })
      }
      else if(action === 2){ 
        svueLib.mark(this.course.Title, [this.currentDropItem.id], 1, 1).then((r) => { // mark as "seen" and hide message
          if(r.type === 'success'){
            cbDiff[this.course.Title].pending.splice(cbDiff[this.course.Title].pending.indexOf(this.currentDropItem.id), 1);
            if(cbDiff[this.course.Title].pending.length === 0){
              delete cbDiff[this.course.Title].pending}
            updateDiffDB(); 
            this.$forceUpdate(); 
            rlib.toast.success('Removed "Pending" tag.')
          }
        }); 
      }
      else if(action === 3){ // edit item
        $('#medit-item').text(this.currentDropItem.details.Measure); 
        $('#medit-points').val(this.currentDropItem.details.$points); 
        $('#medit-totalPoints').val(this.currentDropItem.details.$totalPoints); 
        M.Modal.init($('#modal-editItem')[0], {'dismissible': !window.matchMedia("only screen and (max-width : 600px)").matches}); 
        M.Modal.getInstance($('#modal-editItem')[0]).open(); 
        setTimeout(() => {$('#medit-points').focus()}, 251); 
      }
      else if(action === 4){ // revert modifications
        let det = this.currentDropItem.details; 
        if(det.$originalScore[0] !== -1){
          det.$points = det.$originalScore[0]}
        else{
          delete det.$points}
        det.$totalPoints = det.$originalScore[1]; 
        delete det.$originalScore; 
        gradeEngine.markChange(cb.items); 
        rlib.toast.success('Modifications reverted.');
      }
      else if(action === 5){ // use in grade calc
        if(cb.weighted){
          cb.gc.category = cb.weights.filter((e) => {return e.$.Type === cb.currentDropItem.details.Type})[0].$index; 
        }
        cb.gc.worth = cb.currentDropItem.details.$totalPoints;
        cb.showGC = true; 
        window.scrollTo(0, $('#li-gc')[0].offsetTop - 40); 
        cb.$_gcRun(); 
      }
      else if(action === 6){ // delete current item
        cb.items.splice(this.currentDropItem.details.$index, 1);
        gradeEngine.markup(this.items, true); // update index values
      }
    }, 
    $_filter_toggleAllCat: function(type){
      if(cb.filters.categories.length > 1){
        cb.filters.categories = [type]; 
      }
      else{
        cb.filters.categories = []; 
        for(let i = 0; i < cb.weights.length; i++){
          if(cb.weights[i].$.Type === 'TOTAL'){continue}
          cb.filters.categories.push(cb.weights[i].$.Type)}
      }
    }, 
    $_gcCheck: function(){
      let totalPointsPossible = rlib.parseFloat(cb.weights[cb.gc.category].$.PointsPossible); // max points, using .replace to remove commas
      this.gc.emptyCat = (totalPointsPossible === 0)
      // emptyCat
    }, 
    $_gcRun: function(){
      let grade = this.weighted?gcEngine.weighted(gradeEngine.calcGrade(cb.items, cb.weights)):gcEngine.unweighted(...this.points_raw);
      let gradef = grade.toFixed(2); 
      if(this.isModified){$('#gc-modNotice').show()}
        else{$('#gc-modNotice').hide()}
      this.gc.resDetails = ''; 
      if(grade < 0){
        this.gc.result = '<0'
        this.gc.helper = 'You don\'t even need to show up!'}
      else if(grade > 200){
        this.gc.result = '>200'
        this.gc.helper = 'Did you mistype something?'}
      else{
        this.gc.result = `a${grade < 90 && grade >= 80? 'n':''} ` + gradef
        if(grade < 65){this.gc.helper = 'Looks like it\'ll be a piece of cake!'}
        else if(grade < 75){this.gc.helper = 'Maybe spend a few minutes studying?'}
        else if(grade < 85){this.gc.helper = 'That\'s not bad at all!'}
        else if(grade < 92){this.gc.helper = 'Do some studying, you\'ll be fine!'}
        else if(grade <= 100){this.gc.helper = 'You can do it!'}
        else {this.gc.helper = 'That\'s not good.'}
        if(!this.weighted || parseFloat(this.gc.worth) !== 100){
          let w = parseFloat(this.gc.worth); 
          this.gc.resDetails = ` (${Math.round(grade*w/10)/10}/${Math.round(w*10)/10} pts)` // extra spacing at the beginning for padding
        }
      }
    }, 
    $_showQA: function(param) {
      return (config.quickActions.indexOf(param) !== -1); 
    },
    $_updateChart: function(){
      let data = gradeEngine.genChartData(cb.items, cb.weighted?cb.weights:false); 
      if(!cbChart){initChart()}
      else if(cbChart.canvas.width === 0){initChart()} // chart not rendering to dom
      cbChart.options.scales.yAxes[0].ticks.min = data.overallMin; 
      cbChart.options.scales.yAxes[0].ticks.max = data.overallMax; 
      cbChart.data = {
        datasets: [{
          label: 'Overall Grade', 
          backgroundColor: 'rgba(54, 162, 235, 0.2)', 
          borderColor: 'rgba(54, 162, 235, 0.8)',
          pointBackgroundColor: 'rgb(54, 162, 235)',
          data: data.overall, 
          lineTension: 0
        }, {
          label: 'Individual Assignments', 
          pointBackgroundColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgb(75, 192, 192)',
          borderColor: 'transparent',
          data: data.individual, 
          type: 'scatter',
          fill: false
        }]
      }; 
      cbChartSup = data.supplemental; 
      cbChart.update();
    }, 
    $_toggleTrends: function(){
      this.showTrends = !this.showTrends; 
      if(this.showTrends){
        this.$_updateChart(); 
      }
    }, 
    $_processEdit: function(e){
      if(e){ // check for enter key
        if(e.keyCode !== 13){return}
        else {M.Modal.getInstance($('#modal-editItem')[0]).close()}
      }
      let item = this.currentDropItem.details; // object tied to cb.items[n]
      let pts = $('#medit-points').val(); 
      let total = $('#medit-totalPoints').val(); 
      if(pts === '' && !item.$hasScore){
        rlib.toast.success('Modifications reverted.');
        delete item.$points; 
        if(item.$originalScore){
          item.$totalPoints = item.$originalScore[1]; 
          delete item.$originalScore}
        gradeEngine.markChange(this.items, this.weights); 
        cb.$_updateChart(); 
        return; 
      }
      if(parseFloat(pts).toString() !== pts || parseFloat(total).toString() !== total){
        rlib.toast.warn('Your input was invalid.'); 
        return}
      pts = parseFloat(pts); 
      total = parseFloat(total); 
      if(!item.$originalScore){
        rlib.toast.success('Item modified.');
        if(pts !== item.$points || total !== item.$totalPoints){
          if(item.$hasScore){
            item.$originalScore = [item.$points, item.$totalPoints]}
          else{item.$originalScore = [-1, item.$totalPoints]}
        }}
      else if(pts === item.$originalScore[0] && total === item.$originalScore[1]){
        rlib.toast.success('Modifications reverted.');
        delete item.$originalScore}
      item.$points = pts; 
      item.$totalPoints = total; 
      gradeEngine.markChange(this.items, this.weights); 
      cb.$_updateChart(); 
    }, 
    $_revertAllEdits: function() {
      this.items = gradeEngine.markup(this.items); 
      gradeEngine.markChange(this.items, this.weights); 
      rlib.toast.success('All edits reverted.'); 
    }, 
    $_addWhatIf: function() {
      if(!this.weighted) { // no categories
        this.addWhatIf.category = 'Assignment'}
      if(this.addWhatIf.category === '(Select One)' || this.addWhatIf.pts === '' || this.addWhatIf.total === ''){
        rlib.toast.warn('One or more fields are incomplete.'); 
        return; 
      }
      let measure = this.addWhatIf.name.length > 0 ? this.addWhatIf.name : 'What-If Assignment'; 
      this.items.unshift({ 
        '$': {'$custom': true, 'GradebookID':'0000000','Measure':measure,'Type': this.addWhatIf.category,'Date':moment().format('MM/DD/YYYY'),'DueDate':moment().format('MM/DD/YYYY'),'Score':`${this.addWhatIf.pts} out of ${this.addWhatIf.total}`,'ScoreType':'Raw Score','Points':`${this.addWhatIf.pts} / ${this.addWhatIf.total}`,'Notes':'','TeacherID':'00000','StudentID':'00000','MeasureDescription':''},'Resources':[''],'Standards':['']}); 
      gradeEngine.markup(this.items, true); 
      gradeEngine.markChange(this.items, this.weights); 
      rlib.toast.success('Assignment Added!');
      M.Modal.getInstance($('#modal-addWhatIf')[0]).close(); 
    }
  }, 
  computed: {
    isModified: function(){
      return (this.items.filter(ele => ele.$.$originalScore).length > 0 || this.items.filter(ele => ele.$.$custom).length > 0)
    }, 
    modifiedDiff: function(){
      if(!this.isModified){return ['', '0']}
      let diff = gradeEngine.calcGrade(this.items, this.weights) - this.originalGrade; 
      if(diff >= 0){
        return ['light-blue-text bw', `+${diff.toFixed(2)}%`]}
      return ['orange-text bw', `${diff.toFixed(2)}%`]
    },
    modifiedScoreLg: function(){ // score shown on the top right corner of a course
      return gradeEngine.calcGrade(this.items, this.weights).toFixed(1) + '%'
    }, 
    filterCount: function(){
      let filterCount = 0; 
      if(this.filters.string.length > 0){filterCount ++}
      if(this.weighted){
        if(this.filters.categories.length !== this.weights.length - 1){filterCount ++}
      }
      else{
        if(typeof this.filters.points.min === 'string'){
          if(this.filters.points.min.length > 0) {filterCount ++}}
        if(typeof this.filters.points.max === 'string'){
          if(this.filters.points.max.length > 0) {filterCount ++}}
      }
      return filterCount
    }, 
    filteredItems: function(){
      let items = this.items; 
      let filtered = []; 
      for(let i = 0; i < items.length; i++){
        if(this.weighted){
          if(this.filters.categories.indexOf(items[i].$.Type) === -1){
            continue}
        }
        else{
          let pts = this.items[i].$.Points; 
          if(pts.indexOf('/')){pts = pts.slice(pts.indexOf('/')+1)}
          pts = parseFloat(pts); 
          let filters = this.filters.points; 
          if(typeof filters.min === 'string'){
            if(filters.min.length > 0){
              if(!isNaN(parseFloat(filters.min))){
                if(pts < parseFloat(filters.min)) {continue}}
            }
          }
          if(typeof filters.max === 'string'){
            if(filters.max.length > 0){
              if(!isNaN(parseFloat(filters.max))){
                if(pts > parseFloat(filters.max)) {continue}}
            }
          }
        }
        if(items[i].$.Measure.toLowerCase().indexOf(this.filters.string.toLowerCase()) === -1){continue}
        filtered.push(items[i]);
      }
      return filtered
    }, 
    filter_catSel: function(){ // Categories selected
      if(!this.weighted) {return 'N/A'}
      let cur = this.filters.categories.length, total = this.weights.length - 1; // (Hide TOTAL weight)
      if(cur === total) {return 'Showing All Categories'}
      else if(cur === 1){return this.filters.categories[0]}
      else if(cur === 0){return `Hiding All Categories`}
      else{return `Showing ${cur}/${total} Categories`}
    }, 
    filter_catSelColor: function(){
      if(this.filters.categories.length === 0){return 'orange-text bw'}
      else if(this.filters.categories.length < this.weights.length - 1){return 'light-blue-text bw'}
      else{return ''}
    },
    filter_ptsSel: function(){
      let min = this.filters.points.min; 
      let max = this.filters.points.max;
      if(!min && !max){return 'Any Assignment Value'}
      else if(min && !max){
        return `\u2265${min} Points`}
      else if(!min && max){
        return `\u2264${max} Points`}
      else{
        return `Between ${min} and ${max} points`}
    },
    filter_ptsSelColor: function(){
      let min = this.filters.points.min; 
      let max = this.filters.points.max;
      if(!min && !max){return ''}
      else if(min && max){
        if(min > max || max < 0){return 'orange-text bw'}
        return 'light-blue-text bw'
      }
      else if(!min && max){
        if(max < 0){return 'orange-text bw'}
        return 'light-blue-text bw'
      }
      else{
        return 'light-blue-text bw'
      }
    }, 
    points_raw: function(){ // points_raw is separated from points_formatted so that gradeEngine can access it 
      try {
        let pts = this.items.map(item => (item.$.$points?item.$.$points:0)); 
        let ptsTotal = this.items.map(item => (typeof item.$.$points !== 'undefined')?item.$.$totalPoints:0) // pending items aren't factored into total points by Synergy
        if(pts.length == 0 || ptsTotal.length == 0){return [0, 0, 1]}
        pts = pts.reduce((acc, cur) => acc + cur); 
        ptsTotal = ptsTotal.reduce((acc, cur) => acc + cur); 
        return [pts, ptsTotal]; 
      } catch (err) {
        rlib.toast.error('Unable to determine points: '+err.message); 
        return [0, 0]; 
      }
    }, 
    points_formatted: function(){
      let pts = this.points_raw; 
      if(pts[2]){return 'n/a (no items)'} // third element doesn't affect grade calculator
      return `${pts[0]}/${pts[1]} pts`;
    },
    weights_sorted: function(){
      let res = {
        i0: [], 
        i1: [], 
        i2: [], 
        i3: []
      }
      for(let i = 0; i < this.weights.length; i++){
        if(this.weights[i].$.Type === 'TOTAL'){continue}
        let arr = this.weights[i]; 
        arr.$index = i; 
        let imp = detImportance('', arr.$.Type); 
        if(imp > 0) {arr.$class = `hlt hl-i${imp}`}
        res['i' + detImportance('', this.weights[i].$.Type)].push(arr)}
      return [res.i0.concat(res.i1, res.i2, res.i3), res.i1.concat(res.i0), res.i3.concat(res.i2)]
    }
  }
})

let v_config = new Vue({
  el: '#v-settings', 
  data: {
    config: config, 
    init: false
  }, 
  methods: {
    $_removeImg: () => {
      localforage.removeItem('localImage').then(r => {
        rlib.toast.success('Image Removed!');
        config.imgSrc = (config.theme == 'dark' ? 'mountains-night' : 'mountains'); 
        updateSettings(); 
        setTimeout(() => {
          M.FormSelect.init($('#config-imgSrc')[0]); // Update select field
        }, 500); 
      }).catch((err) => {
        rlib.toast.error(err.stack);
      })
    }, 
    $_init: function(){
      if(!this.init){
        this.init = true; 
        M.Tabs.init($('#settings-tabs')[0]);
      }
    }
  }
})

function initChart(){
  Chart.defaults.global.defaultFontColor = (config.theme==='light'?'black':'white');
  let ctx = $('#canvas-chart')[0].getContext('2d'); 
  cbChart = new Chart(ctx, {
    type: 'line',
    data: {
    }, 
    options: {
      maintainAspectRatio: false, 
      scales: {
        xAxes: [{
          type: 'time', 
          distribution: 'linear', 
          time: {
            parser: 'MM/DD/YYYY', 
            tooltipFormat: 'll'
          }, 
          gridLines: {
            color: 'rgba(127, 127, 127, 0.12)'
          }
        }], 
        yAxes: [{
          scaleLabel: {
            display: true, 
            labelString: 'Grade (%)'
          }, 
          gridLines: {
            color: 'rgba(127, 127, 127, 0.12)'
          }
        }]
      }, 
      // tooltips: {
      //   mode: 'index', 
      //   intersect: false, 
      //   cornerRadius: 0, 
      //   borderColor: 'rgb(255, 255, 255)',
      //   callbacks: {
      //     label: function(tooltipItems, data){
      //       if(tooltipItems.datasetIndex === 0){
      //         return 'Grade: ' + tooltipItems.yLabel + '%';
      //       }
      //       let index = tooltipItems.index; 
      //       return `${rlib.trim(cbChartSup[index].measure)} | Score: ${cbChartSup[index].score} ${cbChartSup[index].ec?'':`(${tooltipItems.yLabel}%)`}`
      //     }
      //   }
      // }, 
      // hover: {
      //   mode: 'index', 
      //   intersect: false
      // }
      tooltips: {
        mode: 'index',
        intersect: !rlib.isMobile, 
        cornerRadius: 0, 
        position: 'nearest', 
        callbacks: {
          label: function(tooltipItems, data){
            if(tooltipItems.datasetIndex === 0){
              return 'Grade at Time: ' + tooltipItems.yLabel + '%';
            }
            let index = tooltipItems.index; 
            return `${rlib.trim(cbChartSup[index].measure)} | Score: ${cbChartSup[index].score} ${cbChartSup[index].ec?'':`(${tooltipItems.yLabel}%)`}`
          }
        }
      }, 
      hover: {
        mode: 'index', 
        intersect: !rlib.isMobile
      }
    }
  });
}

/**
 * Hides the "course details" page. 
 * @param {boolean} [mode=false] - a mode of "true" will set it so that gradebook won't come back (used for transitioning to other pages)
 * @param {object} [event] - the keyup event, if applicable; keys that aren't enter or space will discard the function call 
 */
function hideCourseDetails(mode, event){ 
  if (event) { // if key isn't enter or space, discard function call
    if (event.which && (event.which !== 32 && event.which !== 13) || event.key && (event.key !== 'Enter' && event.key !== ' ')) return; 
    event.preventDefault(); 
  }
  if(fb_shown){toggleBar('#div-fixedBar', 0)}
  pushPendingActions(); 
  cbList.cl.$forceUpdate();
  if(!mode) {
    currentPage = 'gradebook';
    setTimeout(function(){
      window.history.pushState({
        type: 'page', 
        'page': 'gradebook'
      }, '', `#gradebook`); 
    }, 200); 
  }
  if(config.noAnim){
    $('#div-course').hide();
    if(!mode) $('#v-gradeList').show(); 
    return; 
  }
  $('#v-gradeList').css({'opacity':0, 'transform': config.reduceMotion?'':'translateY(-80%)'});
  anime({
    targets: '#div-course', 
    duration: 270 * config.animSpeed, 
    opacity: 0, 
    translateY: config.reduceMotion?'':'-80%', 
    easing: 'easeInSine', 
    complete: (() => {
      $('.material-tooltip').css({top: false, left: false, transform: false}); // move tooltips that shouldn't be there out of the way
      $('#div-course').hide();
      if(!mode) { $('#v-gradeList').show(); 
      anime({
        targets: '#v-gradeList', 
        duration: 270 * config.animSpeed, 
        opacity: 1, 
        translateY: 0,
        easing: 'easeOutSine'
      })}
    })
  })
}

function renderList(item){ // Called whenever loading a coursebook (single class)
  $('html')[0].scrollTo(0, 0); // scroll to top
  cb.gc.result = ''; // Clear previous grade calculation entries
  cb.showGC = false; // Hide grade calculator
  cb.course = cbData[item].$;
  cb.course.$index = item; 
  cb.items = gradeEngine.markup(cbData[item].Marks[0].Mark[0].Assignments[0].Assignment);
  cb.grade = cbData[item].Marks[0].Mark[0].$; 
  cb.showWeights = false; 
  cb.showTrends = false; 
  cb.showChanges = config.alwaysShowGC; 
  cb.filters.string = ''; // Clear filter
  pending.course = cb.course.Title; 
  pending.items = cbDiff[cb.course.Title]['items'].slice(0); // .slice(0) to create a separate array, so changes done afterwards aren't immediately undone 
  pending.time = Date.now(); 
  if(typeof cbData[item].Marks[0].Mark[0].GradeCalculationSummary[0] !== 'string'){
    cb.weighted = true; 
    cb.weights = cbData[item].Marks[0].Mark[0].GradeCalculationSummary[0].AssignmentGradeCalc;
    cb.filters.categories = []; 
    for(let i = 0; i < cb.weights.length; i++){
      if(cb.weights[i].$.Type === 'TOTAL'){continue}
      cb.filters.categories.push(cb.weights[i].$.Type)}
    gradeEngine.markChange(cb.items, cb.weights); 
  }
  else {
    cb.weighted = false; 
    cb.weights = false; // for markChange function after edits
    cb.filters.points.min = null; 
    cb.filters.points.max = null; 
    gradeEngine.markChange(cb.items); 
  }
  cb.originalGrade = gradeEngine.calcGrade(cb.items, cb.weights); // before modifications
}

function showCourseDetails(item, noHist, force){
  if(!cbData[item].Marks[0]){ // Handle course w/o grade data
    rlib.toast.info(`This class doesn\'t have gradebook data.&nbsp;`); 
    return;
  }
  else if(cbData[item].Marks[0].Mark[0].Assignments[0] === ''){ // Handle empty classes
    if (!force) {
      rlib.toast.info(`This class doesn\'t have any assignments.&nbsp;<a href='#' class='light-blue-text text-lighten-3' onclick='showCourseDetails(${item}, 1, 1)'>Open Anyways</a>`); 
      return; 
    }
    cbData[item].Marks[0].Mark[0].Assignments[0] = {Assignment: []}; 
  }
  currentPage = 'gradebook-details';
  if(!noHist){
    setTimeout(function(){
      window.history.pushState({
        type: 'course', 
        index: item
      }, '', `#course/${item}/${v_shared.getID(cbData[item].$.Title)}`); 
    }, 200); 
  }
  if(config.noAnim){
    $('#v-gradeList').hide(); 
    $('#div-course').show();
    renderList(item);
    return; 
  }
  anime({
    targets: '#v-gradeList', 
    duration: 270 * config.animSpeed,
    easing: 'easeInSine', 
    translateY: config.reduceMotion?'':'-80%', 
    opacity: 0, 
    complete: (anim => {
      $('#v-gradeList').hide(); 
      anim.reset(); 
      renderList(item);
      $('#div-course').css({'transform': config.reduceMotion?'':'translateY(-80%)', 'opacity': '0', 'display': 'block'});
      anime({
        targets: '#div-course', 
        duration: 270 * config.animSpeed, 
        opacity: 1, 
        translateY: 0,
        easing: 'easeOutSine'
      })
    })
  })
}

let cl, rp; // course list (vue), reporting period (vue)

function toggleBar(ele, mode){ // Slide-down (for when course is scrolled down)
  if(!config.noAnim){
    if(mode) {$(ele).show(); $(ele).css({'top': '-20px'})}
    anime({
      targets: ele,
      easing: 'easeOutSine', 
      duration: 270 * config.animSpeed, 
      top: mode?'38px':'-20px', 
      complete: anim => {
         if(!mode){$(ele).hide()}
      }
    });
  }
  else{
    if(mode) {$(ele).show(); $(ele).css('top', '38px')}
    else{$(ele).hide(); $(ele).css('top', '-20px')}
  }
}

// Other helper functions

function scrollOnMobile(ele){ // Helper function for preventing dropdown boxes from being cut off on small displays
  if(window.innerWidth <= 600){
    let y = $(ele).offset().top - 48; // Subtract 48px for navbar
    window.scrollTo(0, y);
  }
}

/**
 * Updates some or all settings, based on the arguments provided. 
 * @param {boolean} m - true to reload theme/css-related settings (so that something like changing a nickname won't reload all CSS files)
 * @param {boolean} n - true to update all settings, used during initial load
 */
function updateSettings(m=false, n=false){
  if (n || m) {
    if(config.matchTheme){
      localStorage.cfg_theme = 'match';
      config.theme = systemScheme.matches?'light':'dark'}
    let themeTar = `css/materialize/${config.theme}.css`; 
    if($('#css-theme')[0].href !== themeTar) $('#css-theme')[0].href = themeTar; 
    if(cbChart){
      Chart.defaults.global.defaultFontColor = (config.theme==='light'?'black':'white'); 
      cbChart.update()}
  }
  localStorage.cfg_markPendingAsNew = config.markPendingAsNew?1:0;
  if(config.imgTheme && (n || m)){
    if(!config.imgSrc){ // Automatically pick a default background the first time background images are enabled
      config.imgSrc = (config.theme === 'dark' ? 'mountains-night':'mountains')
      $('#config-imgSrc').val(config.imgSrc)}
    $('#css-theme-secondary')[0].href = `css/bkimg-${config.theme}.css`
    if(config.imgSrc === 'local'){ // Featch and show saved image on first page load
      localforage.getItem('localImage').then(r => {
        if(!r) {rlib.toast.warn('No custom image was provided.')}
        let url = URL.createObjectURL(r); 
        $('#bkImg').css('background-image', `url("${url}")`); 
        $('#config-localImg')[0].dataset.icon = url; 
        $('#bkImg-export').prop('href', url); 
        if(config.imgBlur) {$('#bkImg').css('filter', 'blur(6px)')}
          else {$('#bkImg').css('filter', '')}
        if(config.imgSize) $('#bkImg').css('background-size', config.imgSize); 
        if(config.imgPos) $('#bkImg').css('background-position', config.imgPos); 
      })
    }
    else{
      $('#bkImg').css('background-image', `url(../images/${config.imgSrc}.jpg)`);
    }
  }
  else if (n || m){
    $('#css-theme-secondary')[0].href = ''}
  if(!config.sidenavHL){
    $('.sidenav-hl').removeClass('sidenav-hl')}
  else if($('.sidenav-hl').length == 0){
    $('#sidenav-opt-settings').addClass('sidenav-hl')}
  if(!config.newIndicator){
    v_shared.showNew = false }
  else if(!v_shared.forceHideNew){
    v_shared.showNew = true }
  if(config.nickname){
    if(typeof config.nickname !== 'number'){
      if(config.nickname.match(/[^A-z\u00C0-\u00ff0-9 ]+/g)){
        localStorage.cfg_nickname = config.nickname; 
        config.nickname = 1; }
      else if(localStorage.cfg_nickname){
        localStorage.removeItem('cfg_nickname')}
    }
    $('.sp-fullName').text(localStorage.cfg_nickname?localStorage.cfg_nickname:config.nickname)}
  if(!n) { // "n" is true during initial load, so that settings aren't immediately resaved after loading
    localStorage.cfg_main = btoa(JSON.stringify(config));
    localStorage.cfg_theme = config.theme}
  if(config.nickname === 1){
    config.nickname = localStorage.cfg_nickname}
  if(config.reduceMotion && $('.waves-effect').length > 0) {
    $('.waves-effect').addClass('we-disabled').removeClass('waves-effect'); 
    $(document.head).append(`<style id='css_rm'>.dropdown-content, .modal {transform: scaleX(1) scaleY(1) !important} .modal:not(.bottom-sheet) {top: 10% !important} .modal.bottom-sheet {bottom: 0 !important} .anim-div-enter-active,.anim-div-leave-active,.anim-div-sm-enter-active,.anim-div-sm-leave-active,.anim-msg-enter-active,.anim-msg-leave-active {animation: none !important}</style>`)
  }
  else if(!config.reduceMotion && $('.we-disabled').length > 0) {
    $('.we-disabled').addClass('waves-effect').removeClass('we-disabled'); 
    $('#css_rm').remove(); 
  }
}

// Initialization, triggered events 

$(document).on('scroll', (e) => {
  if(currentPage === 'gradebook-details'){
    if(window.scrollY > 90 && !fb_shown){
      toggleBar('#div-fixedBar', 1);
      fb_shown = 1;
    }
    else if(window.scrollY <= 90 && fb_shown){
      toggleBar('#div-fixedBar', 0);
      fb_shown = 0; 
    }
  }
})

$('.config-input').on('change', (e) => {
  if(e.srcElement.id === 'config-imgSrc'){
    if(config.imgSrc === 'local'){
      return; // Don't update settings until after an image is selected
    }
  }
  if(e.srcElement.id === 'config-useGeolocation' && config.useGeolocation === true) {
    navigator.geolocation.getCurrentPosition((res) => {
      let {latitude, longitude} = res.coords; 
      config.weatherLocation = `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`; 
      rlib.toast.success('Success!'); 
      updateSettings(); 
    }, (error) => {
      switch (error.code) {
        case error.PERMISSION_DENIED: 
          rlib.toast.error('Remchi was denied access to your location.');
          break; 
        case error.POSITION_UNAVAILABLE: 
          rlib.toast.error('Remchi was unable to retrieve your location.');
          break;
        default: 
          rlib.toast.error('An error occured while atteping to retrieve your location.'); 
      }
      config.useGeolocation = false; 
      updateSettings(); 
    })
  }
  if(e.srcElement.dataset.reltheme) {
    // reload the theme/css
    updateSettings(1); 
  } else {
    updateSettings(); 
  }
})

$('#config-imgSrc').on('change', (e) => {
  if(config.imgSrc === 'local'){
    localforage.getItem('localImage').then(r => {
      if(!r) {$('#fileSelect').click()}
      else{
        updateSettings(1); 
      }
    })
  }
}); 

$('#fileSelect').on('change', (e) => {
  let fs = $('#fileSelect')[0]; 
  if(fs.files.length > 0){
    let file = fs.files[0]; 
    localforage.setItem('localImage', file).then(s => {
      rlib.toast.success('Updated background image!'); 
      config.imgSrc = 'local'; 
      localStorage.cfg_main = btoa(JSON.stringify(config));
      updateSettings(1);
      // document.body.style.backgroundImage = `url("${URL.createObjectURL(file)}")`;
    }); 
  }  
  else{
    rlib.toast.warn('No image was selected.');
  }
})

/**
 * Initializes the course/grade list. Call only after @function initAppCore has been called. 
 * @param {object} userData {fullName: (string)} is all that's needed now
 */
function initApp(userData){ 
  if(navigator.onLine && userData){
    nt.update() }
  else if(!navigator.onLine){
    rlib.toast.warn(`You're using Remchi offline. Some modules will be unavailable.`) }
  cbList.cl.banner.loading = false; 

  if (svcore.getUUID()) {
    if (typeof ga !== 'undefined') {
      gtag('config', 'UA-96580670-3', {
        'user_id': svcore.getUUID()
      });
    }
  }
  
  let name = (userData&&userData.name)?userData.name:(svcore.getName()?svcore.getName():'Unknown'); 
  $('#config-nickname').prop('placeholder', name);
  if(config.nickname){
    $('#sp-fullNameActual').text(`${localStorage.cfg_nickname?localStorage.cfg_nickname:config.nickname} (${name})`)}
  else{
    $('#sp-fullNameActual').text(name); 
    $('.sp-fullName').text(name)}

  if(!userData){
    return; 
  }

  cbList.cl.course = cbData; 
  bellSchedule.init(userData.school); 
  if(sessionStorage.isNew){
    welcome.open(); 
  }

  if(location.hash && location.hash !== '#gradebook'){
    let hash = location.hash.slice(1); 
    if(hash.indexOf('/') !== -1){
      if(hash.slice(0, 6) === 'course'){
        let courseHash = hash.split('/'); 
        let index = parseInt(courseHash[1]); 
        if(cbData[index]){ // ensure it's actually a course 
          let cid = v_shared.getID(cbData[index].$.Title); // check course ID
          if(cid === courseHash[2]){
            showCourseDetails(index);
            if(config.sidenavHL){
              $('#sn-gradebook').addClass('sidenav-hl')}
          }
          else{
            rlib.toast.warn(`Invalid course (${index}/${courseHash[2]}). Are you signed in as the right user?`);
          }
          return; 
        }
      } 
      // otherwise, it's an invalid hash - go to "start off at gradebook"
    }
    else if(['schedule', 'attendance', 'messages', 'notifier', 'roadmap', 'settings', 'courseHistory'].indexOf(hash) !== -1){ // another page
      pageNav(hash, 0, 1); 
      if(config.sidenavHL) $('#sn-'+hash).addClass('sidenav-hl'); 
      return; 
    }
  }
  initAtGradebook(); 
}

function initAtGradebook(){
  window.history.pushState({
    type: 'page', 
    'page': 'gradebook'
  }, '', `#gradebook`); 
}

/**
 * Updates the weather. Will use config.weatherLocation if provided, otherwise will default to Fort Collins, CO (40.51, -105.02). 
 */
async function updateWeather() {
  let ok = false; 
  let metric = false; 
  let units = metric ? ['&deg;C', 'm/s'] : ['&deg;F', 'mph']; 
  let resp = await fetch(`/weather/current?loc=${config.weatherLocation?config.weatherLocation.replace(/\s/g,''):'40.51,-105.02'}`).then(r => {
    ok = r.ok; 
    status = r.status; 
    return r.json(); 
  }).catch(e => {
    return {
      _isError: true,
      msg: e.message
    }
  });
  if (ok) {
    intervalScript.lastWeatherUpdate = Date.now(); 
    $('#sp-weather-outer').show(); 
    $('#sp-weather').html(`<i class='${resp.weather.icon}'></i> ${Math.round(resp.main.temp)}&deg; (<span class='red-text bw'>${Math.round(resp.weather.high)}&deg;</span>/<span class='blue-text bw'>${Math.round(resp.weather.low)}&deg;</span>)`); 

    let t = resp.weather.tomorrow, forecast = (t > 3 ? ['red-text', 'warmer', 'than'] : (t < -3 ? ['blue-text', 'cooler', 'than'] : ['green-text', 'about the same', 'as'])); 
    if (Math.abs(t) > 7 ? 'much ':'') forecast[1] = 'much ' + forecast[1]; 

    $('#sp-weather-drop').html(`<h2><i class='${resp.weather.icon}'></i> ${resp.main.temp?resp.main.temp.toFixed(1):'??'}${units[0]}</span></h2><p>${resp.weather.description}</p><br/><p style='font-size:1.05rem'>Feels like ${resp.main.feels_like?resp.main.feels_like.toFixed(1):'??'}${units[0]}<br/><i class='fas fa-lightbulb'></i> UV: ${resp.weather.uvi?resp.weather.uvi.toFixed(0):'n/a'} • <i class='fas fa-wind'></i> ${resp.weather.wind_speed?resp.weather.wind_speed.toFixed(1):'n/a'} ${units[1]}<br/><br/>Tomorrow will be <b class='${forecast[0]} bw'>${forecast[1]}</b> ${forecast[2]} today.<br/><a target='_blank' href='https://openweathermap.org/city/${resp.id}' noreferrer='1'><i class='fas fa-link'></i> More Details</a></p>`)
  } else if (config.weatherLocation && status && parseInt(status) === 400) {
    cbList.pushMessage({bk: 'e', icon: 'e', text: `The zip code/coordinates you set for the weather module under settings are invalid.`}); 
  }
}

/**
 * Initializes Gradebook. Don't call more than once. 
 */
async function initAppCore() {
  cbList.cl = new Vue({ // course list
    el: '#v-gradeList',
    data: {
      shared: v_shared, 
      cbList, // make accessible to Vue
      course: [], 
      banner: {
        cache: false, 
        update: false, 
        refresh: false, 
        loading: true, 
        messages: []
      }
    }, 
    methods: {
      $_sc: (clk) => { // Show course
        showCourseDetails(clk.index); 
      }, 
      /**
       * Focuses either the next or previous course entry, triggered w/ up/down arrow keys
       * @param {number} index - "index" of current entry (note that headers also have indices, i.e., the next one is not necessarily index+1)
       * @param {boolean} dir - true for next, false for previous
       */
      $_focus: (index, dir) => {
        let list = $('.course-item.c-li'), pos = list.indexOf($('#ci-'+index)[0]); 
        pos += dir?1:-1; 
        if (pos < 0) pos = list.length-1; 
        else if (pos >= list.length) pos = 0; 
        list[pos].focus(); 
      }, 
      $_hasNew: (title) => {
        if(cbDiff[title] && v_shared.showNew){
          if(cbDiff[title]['items'].length > 0){
            return 'hl-new'
          }
        }
        return false
      },
      $_chkLength: (title) => {
        if(title.length > 20){
          return 'med-lg' }
        return 'lg'; 
      }, 
      $_detNew: (title, type, index) => { // For Gradebook page: "# New Assignment(s)"
        if(!cbData[index].Marks[0]){ // if an item has zero grade info
          return type?'teal-text bw':'No Grade Data'}
        else if(cbData[index].Marks[0].Mark[0].Assignments[0] === ''){ // if an item has no grade given (or is non-existent), then the "grade" is set to -1
          return type?'orange-text bw':'No Items'}
        else if(!v_shared.showNew){
          let count = cbData[index].Marks[0].Mark[0].Assignments[0].Assignment.length; 
          let str = (count==1?'1 Item':`${count} Items`); 
          if(cbDiff[title]){
            if(cbDiff[title]['pending']){
              if(cbDiff[title]['pending'].length > 0){
                str += ` (${cbDiff[title]['pending'].length} Pending)`;
              }
            }
          }
          return type?'light-blue-text bw':str
        }
        else if(cbDiff[title]){
          if(cbDiff[title]['items'].length > 0){
            let l = cbDiff[title]['items'].length; 
            if(cbDiff[title]['pending']){ // New items and pending items
              let p = cbDiff[title]['pending'].length; // (pending) length
              if(type === 1){return ['light-blue-text bw']}
              return `${l} New + ${p} Pending`
            }
            if(type === 1){return ['green-text bw']}
            return `${l} New Item${l==1?'':'s'}`
          }
          else if(cbDiff[title]['pending']){ // pending will only exist if there is something pending
            let l = cbDiff[title]['pending'].length; 
            if(type === 1){return ['light-blue-text bw']}
            return `${l} Pending Item${l==1?'':'s'}`
          }
          return type?'gray':'No New Items'
        }
        return type?'gray':'(error: non-existent course)'
      },
      $_showGrade: (course) => {
        if(course.Marks[0]){
          let raw = course.Marks[0].Mark[0].$.CalculatedScoreRaw; 
          let str = course.Marks[0].Mark[0].$.CalculatedScoreString; 
          if(str === 'U' || str === 'S'){
            if(str === 'S') {
              return `<i class='fas fa-check fa-xs'></i> (S)` }
            return `<i class='fas fa-exclamation-triangle fa-xs'></i> (U)`
          }
          else if(str === 'N/A'){
            return 'N/A' }
          return `${raw}% (${str})`
        }
        else{ // No grade data
          return 'N/A'
        }
      }, 
      $_trim: v_shared.trimTitle
    }, 
    computed: {
      refreshStatus: function () {
        if (typeof this.banner.refresh !== 'string') return ''; 
        else return this.banner.refresh.slice(0, 1); 
      }
    }
  });

  initMaterialize();

  let h = new Date().getHours(); 
  $('#sp-greeting').text(`Good ${h < 12 ? 'Morning': (h < 18 ? 'Afternoon' : 'Evening')},`); 
  $('#sp-date').text(moment().format('dddd, MMMM D'))

  await svcore.init(); // load user metadata
  if (config.nickname) {
    $('.sp-fullName').text(localStorage.cfg_nickname?localStorage.cfg_nickname:config.nickname); 
  } else if (svcore.getName()) {
    $('.sp-fullName').text(svcore.getName()); 
  } else if (sessionStorage.fullName) { // variable set upon signing in
    $('.sp-fullName').text(sessionStorage.fullName); 
  }

  if(!localStorage.lastChangelog || localStorage.lastChangelog !== $('#modal-whatsnew')[0].dataset.build) {
    cbList.cl.banner.update = true;
  }
  
  let gb = await svcore.fetchCurrentGB(sessionStorage.app_forceCached?2:0);
  if (sessionStorage.app_forceCached) sessionStorage.removeItem('app_forceCached');  
  let hist = await svcore.getItemHist();

  let rpList = svcore.getRPList(); 
  if (rpList.length > 0) {
    $('#v-rp-placeholder').remove(); 
    $('#v-rp').show(); 
    cbList.rp = new Vue({
      el: '#v-rp', 
      data: {
        all: rpList
      }, 
      methods: {
        toggleRP: function (index) {
          this.all[index].selected = !this.all[index].selected; 
        }
      }
    })
  } else {
    $('#v-rp-placeholder').html(`<tr><td><i class='fas fa-info-circle'></i></td><td colspan='3'>You either have no reporting periods, or we were unable to load them.</td></tr>`); 
  }

  if (gb.ok) {
    cbData = gb.data;
    cbDiff = svueLib.diffAssignments(svueLib.parseAssignments(cbData), hist);

    $('.sp-lastUpdated').html(gb.fromCache?`<i class='fas fa-info-circle fa-fw'></i> Last updated ${moment().to(gb.ts*1000)}`:`<i class='fas fa-check fa-fw'></i> Just Updated`)
    cbList.ts = gb.fromCache?gb.ts*1000:Date.now(); 
    
    initApp({
      fullName: svcore._metadata.user.fullName, 
      school: svcore._metadata.user.school
    }); 
  } else {
    cbList.pushMessage({bk: 'e', icon: 'e', text: gb.error?gb.error:'An unknown error occurred.'});
    $('.sp-lastUpdated').html(`<i class='fas fa-exclamation-triangle fa-fw'></i> Failed to Load`); 
    initApp(); 
    let cache = await svcore.fetchCurrentGB(2); 
    if (cache && cache.ok) {
      cbList.cl.banner.cache = moment().to(cache.ts*1000); 
    }
  }
}

async function updateCL(input) {
  let gb = await svcore.fetchCurrentGB(); 
}

function returnToLaunch(){
  sessionStorage.app_persistLaunchPage = '1'; 
  window.open('app/start', '_self');
}

window.onpopstate = function(event){
  let state = event.state; 
  if(!state){ // no data associated w/ state (from clicking a link)
    return}
  if(state.type === 'page'){
    pageNav(state.page, 0, 1); 
  }
  else if(state.type === 'course'){
    if(currentPage !== 'gradebook'){
      pageNav(currentPage, 1, 1); // Hide other page
      currentPage = 'gradebook'}
    showCourseDetails(state.index, 1);
  }
}

window.addEventListener('DOMContentLoaded', function(){
  $('#loadingDiv-p2').hide(); 
  $('#loadingDiv-p3').show(); 
  $('#ld-innerPB').css({'animation': 'none', 'width': $('#ld-innerPB').width()+'px'});
  setTimeout(() => {
    $('#ld-innerPB').css('width', '150px')
  }, 100)

  $('a').on('click', (e) => {
    if(e.srcElement.href){
      if(e.srcElement.href.slice(-1) === '#') {
        e.preventDefault(); 
      } // # is only used as a placeholder for JS functions
    }
  });

  if(window.navigator.standalone){ // iOS version of being in standalone 
    $('.show-in-web').hide()}
  $('#ver-build').text('Build '+window.svueVer.build); 
  $('#ver-str').text(`${window.svueVer.stage} ${window.svueVer.str} (${window.svueVer.date})`); 
  if(window.svueVer.app){
    $('#ver-app').html(`PWA (App): ${window.svueVer.appOS}`)}
  else{$('#ver-web').html('Web Version (no PWA detected)')}
  
  initAppCore(); 
  
  window.addEventListener('online',  () => {
    rlib.toast.success(`You're back online.`); 
  });

  window.addEventListener('offline',  () => {
    rlib.toast.warn(`You're no longer connected to the internet. Some features will be unavailable.`); 
  }); 
}); 

/**
 * Dynamically loads an external (as in, same domain but not part of the main HTML file) into a target so that we don't have to make /dashboard unnecessarily bloated
 * @param {string} id - id of the element 
 * @param {string} src - path to obtain the html from
 */
async function loadExternal(id, src) {
  // these static HTML packages only have to be loaded once
  if($('#'+id).html() === '') {
    let ele = $('#'+id); 
    ele.html(`<i class='fas fa-circle-notch'></i> Loading...`); 
    let status, res = await fetch(src).then(r => {
      status = r.status;
      return r.text()
    }).catch(e => {
      return {_err: true}
    })
    ele.html(res); 
    if (status !== 200) {
      
    }
  }
}

/**
 * Small script to update text that needs constant updates (set to an interval of every 30 seconds) - time, last updated indicator, bell schedule, etc. 
 * Designed so that on mobile, the clock will pause on blur (leaving the tab) and start again on refocus
 */
const intervalScript = {
  lastWeatherUpdate: 0, 
  runFunc: function () {
    if (bellSchedule.vue) bellSchedule.update(); 
    if (!rlib.isMobile) $('#sp-time').text(moment().format('h:mm a')); 
    if (cbList.ts !== 0 && cbList.ts < Date.now() - 60000) {
      $('.sp-lastUpdated').html(`<i class='fas fa-info-circle fa-fw'></i> Last updated ${moment().to(cbList.ts)}`)
    }
    if (!this.isBlur && this.lastWeatherUpdate < Date.now() - 1800000) {
      // max auto update once every 30 min, and if window is focused
      updateWeather(); 
    }
  }, 
  isBlur: false, 
  interval: false, 
  timeout: false, 
  start: function () {
    this.isBlur = false; 
    intervalScript.runFunc(); 
    clearInterval(this.interval); 
    clearTimeout(this.timeout); 
    this.timeout = setTimeout(() => { // Schedule automatic updates to the schedule
      this.interval = setInterval(intervalScript.runFunc, 30000); 
    }, 30000 - Date.now() % 30000); 
  }, 
  pause: function () {
    clearInterval(this.interval); 
    clearTimeout(this.timeout); 
  }, 
  init: function () {
    this.start(); 
    // hook event listeners
    window.addEventListener('blur', () => {
      this.isBlur = true; 
      if (rlib.isMobile) this.pause(); // pause timers on mobile
    }); 
    window.addEventListener('focus', this.start); 
  }
}

const survey = {
  opt: (r) => {
    if (r === 0) {
      delete cbList.cl.banner.survey;  
      cbList.pushMessage({icon: 'c', bk: 'c', text: 'Thank you!'}); 
      localStorage.setItem('svp-surveyComp', '1'); 
      window.open('https://itsryan.page.link/svue-survey-f21', '_blank'); 
      gtag('event', 'survey_open', {
        'event_category': 'engagement', 
        'event_label': 'F21 Survey'
      }); 
    } else if (r === 1) {
      delete cbList.cl.banner.survey; 
      cbList.cl.$forceUpdate(); 
      gtag('event', 'survey_dismiss', {
        'event_category': 'engagement', 
        'event_label': 'F21 Survey'
      }); 
    } else if (r === 2) {
      delete cbList.cl.banner.survey; 
      cbList.cl.$forceUpdate(); 
      localStorage.setItem('svp-surveyComp', '1'); 
      gtag('event', 'survey_decline', {
        'event_category': 'engagement', 
        'event_label': 'F21 Survey'
      }); 
    }
  }, 
  init: () => {
    if (localStorage.getItem('svp-surveyComp') !== '1' && Date.now() < 1640217540000) {
      cbList.cl.banner.survey = true; 
      gtag('event', 'survey_view', {
        'event_category': 'engagement', 
        'event_label': 'F21 Survey'
      }); 
    }
  }
}

window.addEventListener('load', function(){
  intervalScript.init(); // call scheduled intervals

  survey.init(); 

  if(config.reduceMotion) $('#loadingDiv').remove(); 
  else {
    $('#ld-innerPB').css({'transition': 'background 0.2s, width 0.2s', 'background': '#8f8', 'width': '200px'});
    // setTimeout(() => {
      $('#loadingDiv').css('opacity', 0); 
      setTimeout(() => {$('#loadingDiv').remove()}, 400); 
    // }, 160);
  }
})

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function(event) {
    if(event.data.code === 200){ // successful update
      rlib.toast.success('Remchi was updated in the background. ', 10000); 
      rlib.toast.info('<a href="#" class="light-blue-text text-lighten-4" onclick="location.reload()">Reload the page</a>&nbsp;to see changes.', 10000)
    }
    else{ // other message
      rlib.toast.success(event.data.msg, 10000) }
  });
}