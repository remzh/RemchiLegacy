// StudentVUE Function Library
// (C) 2020 Ryan Zhang

const moment = require('moment');
const logger = {
  error: (m) => {
    console.log(`${moment(new Date()).format('M/DD HH:mm:ss')}: error: [svuelib] ${m}`)
    console.log(m); 
  }
}

module.exports = { 
  parseAssignments: (data, rev) => { // Input: Raw SVUE input (from fetchSVUE), output: arrays of item IDs
    // @param rev: reverses the order of assignments
    // Format: {[title]: {grade: (number), items: (array)}}
    try {
      let res = {}; 
      let courses = data.Gradebook.Courses[0].Course
      if (!courses) { // No courses 
        return {}; 
      }
      for(let i = 0; i < courses.length; i++){
        let id = courses[i]; 
        let itemList = []; 
        let items = courses[i].Marks[0].Mark[0].Assignments[0].Assignment; 
        if(!items){ // No assignments in the selected class
          res[id.$.Title] = {
            timestamp: new Date(), 
            items: [] };
          continue; 
        }
        for(let j = 0; j < items.length; j++){
          itemList.push(items[j].$.GradebookID); 
        }
        res[id.$.Title] = {
          // grade: parseFloat(id.Marks[0].Mark[0].$.CalculatedScoreRaw), 
          timestamp: new Date(), 
          items: (rev ? itemList : itemList.reverse())
        };
      }
      return res;
    }
    catch(err){
      logger.error('Unhandled exception at svueLib.parseAssignments', err);
      return {}; 
    }
  }, 
  parseAssignmentDetails: (data) => { // Input: Raw SVUE input (from fetchSVUE), output: detailed assignments as objects instead of item arrays, flattened (everything is put into one object using GradebookID as keys)
    // Format: {[id]: {course: (string), measure: (string), points: (number), score: (number), total: (number), type: (string)}}
    try {
      let res = {}; 
      let courses = data.Gradebook.Courses[0].Course
      for(let i = 0; i < courses.length; i++){
        let id = courses[i];
        let items = courses[i].Marks[0].Mark[0].Assignments[0].Assignment; 
        if(!items){ // No assignments in the selected class
          continue}
        for(let j = 0; j < items.length; j++){
          let score = items[j].$.Score; 
          let points = items[j].$.Points;
          let totalPoints = items[j].$.Points; 
          if(totalPoints.indexOf('/') !== -1){
            points = parseFloat(totalPoints.split('/')[0]);
            totalPoints = parseFloat(totalPoints.split('/')[1])}
          else{
            points = -1
            totalPoints = parseFloat(totalPoints)}
          if(score.toLowerCase().indexOf('not') !== -1){score = -1}
          else{
            let raw = score.split(' out of ')
            score = parseFloat(raw[0]) / parseFloat(raw[1]); 
            score = Math.round(score * 10000) / 100; 
          }
          res[items[j].$.GradebookID] = {
            measure: items[j].$.Measure, 
            course: id.$.Title, 
            score: score, 
            points: points, 
            total: totalPoints,
            type: items[j].$.Type
          }; 
        }
      }
      return res;
    }
    catch(err){
      logger.error('Unhandled exception at svueLib.parseAssignmentDetails', err);
      return []; 
    }
  }, 
  diffAssignments: (current, stored) => {
    // Format: same as parseAssignments
    let diff = {}; 
    for(let i in current){
      if(!stored[i]){diff[i] = current[i]; continue}
      diff[i] = {grade: Math.round((current[i]['grade'] - stored[i]['grade'])*1000)/1000}
      diff[i]['items'] = current[i]['items'].filter(item => stored[i]['items'].indexOf(item) === -1); 
    }
    return diff;
  }
}