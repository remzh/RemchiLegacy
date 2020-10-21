//ryan's library - modular functions without dependencies

module.exports = { 
  randCode: (mode) => {
    if(mode === 0){
      return Math.round(Math.random() * 899999 + 100000)
    }
    else{
      let res = ''
      let possible = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; 
      for (let i = 0; i < 16; i++){res += possible.charAt(Math.floor(Math.random() * possible.length))}
      return res;
    }
  },
  trimTitle: (str) => {
    if(str.indexOf('(') !== -1){
      str = str.slice(0, str.lastIndexOf('('))}
    let sem = str.match(/S\d/)
    if(sem){str = str.slice(0, sem.index)}
    if(str.slice(-1) === ' '){str = str.slice(0, -1)}
    return str
  }, 
  detImportance: function(name, cat){ // Figure out how "important" an assignment is
    /* Scale: 
    0 - Not Important (homework, classwork, etc.)
    1 - Important (quizzes, essays, labs, timed writes, etc.)
    2 - Very Important (tests / exams, projects, summatives)
    3 - Extremely Important (finals, and only finals)
    */
    let imp = 0; 
    let n = name.toLowerCase();  
    let c = cat.toLowerCase(); 
    if(n.match(/pre.?test/) || n.match(/sign.?up/) || n.indexOf('practice') !== -1 || n.indexOf('correction') !== -1){
      return 0}
    if(n.indexOf('final') !== -1 || c.indexOf('final') !== -1){
      return 3} 
    let imp2 = ['test', 'exam', 'assessment', 'free response', 'project', 'summative']; 
    for(let i = 0; i < imp2.length; i++){
      if(n.indexOf(imp2[i]) !== -1 || c.indexOf(imp2[i]) !== -1){
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
  }, 
  cleanPhoneNumber: function(num) {
    return ('' + num).replace(/\D/g, '')
  },
  formatPhoneNumber: function(phoneNumberString) {
    let cleaned = ('' + phoneNumberString).replace(/\D/g, '')
    let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/)
    if (match) {
      let intlCode = (match[1] ? '+1 ' : '')
      return [intlCode, '(', match[2], ') ', match[3], '-', match[4]].join('')
    }
    return null
  }
}