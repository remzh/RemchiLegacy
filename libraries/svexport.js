// svexport.js
// (C) 2021 Ryan Zhang. Some Rights Reserved. 
// 
// Converts gradebook data to JSON and excel spreadsheets

const VERSION = '1.0 (b85)'; 

const ExcelJS = require('exceljs');
const moment = require('moment'); 
const path = require('path'); 

let styles = { // heading 1, heading 2, subheading 1, subheading 2, dark 1
  h1: {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFD9E1F2'}}, 
  h2: {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFE6EBF6'}}, 
  s1: {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFDBDBDB'}}, 
  s2: {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FFEDEDED'}}, 
  d1: {type: 'pattern', pattern: 'solid', fgColor: {argb: 'FF368ED6'}},
  headerBreaks: true
}, fonts = {
  bold: {bold: true},
  gray: {color: {argb: 'FF808080'}}, 
  white: {color: {argb: 'FFFFFFFF'}}, 
  link: {color: {argb: 'FF0563C1'}, underline: 'single'}, 
  grade: {color: {argb: 'FF0563C1'}}, 
  note: {color: {argb: 'FFD97701'}}, 
}

function validate(obj, properties) { // ensure specified properties are not undefined
  for(let i = 0; i < properties.length; i++){
    if(!obj[properties[i]] || obj[properties[i]] === '') {
      obj[properties[i]] = '(n/a)'
    }
  }
  return obj; 
}

function trimTitle(str) { // modified version of vShared.trimTitle that forces titles to a) not exceed 31 chars and b) not contain special characters (excel limitation)
  str = str.replace(/\/|\\|\*|\?|\:|\[|\]/g, ''); // remove special characters
  if(str.indexOf('(') !== -1){
    str = str.slice(0, str.lastIndexOf('('))}
  let sem = str.match(/S\d/)
  if(sem){str = str.slice(0, sem.index)}
  if(str.slice(-1) === ' '){str = str.slice(0, -1)}
  if(str.indexOf('ExtendedLearningOpportunity') !== -1){str = str.replace('ExtendedLearningOpportunity', 'ELO')}
  if(str.length > 31) str = str.slice(0, 28) + '...'; 
  str = str.trim();
  return str
}

function prepData(raw) {
  let out = []; 
  for(let i = 0; i < raw.length; i++){ // convert [{"Course": [{Course}, {Course}, {etc.}]}] format to [{Course}, {Course}, {etc.}]
    if(raw[i].Course){
      let c = raw[i].Course; 
      for(let j = 0; j < c.length; j++){
        out.push(c[j]); 
      }
    }
  }
  
  for (let i = 0; i < out.length; i++){ // ensure each out[i].$ contains a Period, Title, Room, and Staff field
    if(!out[i].$) out[i].$ = {}; 
    out[i].$ = validate(out[i].$, ['Period', 'Title', 'Room', 'Staff', 'StaffEMail'])
  }

  return out; 
}

function buildLandingPage(wb, sheet, userInfo, courses) {
  sheet.pageSetup.orientation = 'landscape'; 
  sheet.pageSetup.fitToPage = 1; 
  sheet.pageSetup.fitToWidth = 1; 

  // predefined widths based on a reference spreadsheet made by hand
  sheet.getColumn(1).width = 5.9;
  sheet.getColumn(2).width = 11.4;
  sheet.getColumn(3).width = 23.3;
  sheet.getColumn(4).width = 4.6;
  sheet.getColumn(5).width = 4.6;
  sheet.getColumn(6).width = 36;
  sheet.getColumn(7).width = 10.5;
  sheet.getRow(13).height = 30; 

  let image = wb.addImage({
    filename: path.join(__dirname, 'svexport-logo.png'), 
    extension: 'png'
  }); 
  sheet.addImage(image, {
    tl: {col: 1, row: 1}, 
    ext: {width: 360, height: 77}
  }); 

  sheet.getCell('B7').value = `Hello ${userInfo.firstName},`

  sheet.getCell('E7').value = {
    text: 'Open StudentVUE+', 
    hyperlink: `https://svue.itsryan.org`, 
    tooltip: `Link: svue.itsryan.org (Click or tap to open)`
  };
  sheet.getCell('E7').font = fonts.link; 
  sheet.getCell('E7').protection = {
    locked: false, 
    hidden: true
  }; 
  sheet.mergeCells('E7:F7'); 

  sheet.getCell('B9').value = {
    richText: [
      {text: 'Welcome to your exported gradebook! ', font: fonts.bold}, 
      {text: 'You can see an overview of your data here.'}
    ]
  }; 
  sheet.getCell('B10').value = 'Each course has its own worksheet. For your convenience, a list of courses exported has been provided below.'
  sheet.getCell('B12').value = '💡 Tip: Colored entries have additioinal notes/info associated with them. Select one to see it!'; 
  sheet.getCell('B12').font = {
    color: {argb: 'FFC65911'}
  }; 
  sheet.getCell('B13').value = {
    richText: [
      {text: '⚠', size: 10}, 
      {text: 'Warning: Sorting tools are provided for your convenience. However, data validation rules (the messages that show when you select colored cells) will '},
      {text: 'not', font: {bold: true, color: {argb: 'FFC00000'}}}, 
      {text: ' move with the sort due to Excel design. Use with caution. ', font: {color: {argb: 'FFC00000'}}}
    ]
  }; 
  sheet.getCell('B13').font = {
    color: {argb: 'FFC00000'}
  }; 
  sheet.getCell('B13').alignment = {wrapText: true}
  // sheet.getCell('B12').dataValidation = {
  //   showInputMessage: true, 
  //   promptTitle: 'Hello!', 
  //   prompt: 'This is an example of said note.'
  // }
  sheet.getCell('B12').note = {
    texts: [{'font': {'bold': true}, 'text': 'Hello!'}, {'text': '_x000a_This is an example of said note.'}]
  }
  sheet.mergeCells('B9:G9'); 
  sheet.mergeCells('B10:G10'); 
  sheet.mergeCells('B12:G12'); 
  sheet.mergeCells('B13:G13'); 

  let rp = courses.map(r => r.rp).filter((e, i, a) => a.indexOf(e) === i); // create an array of unique reporting periods 

  let params = [['Name', userInfo.name], ['Export Time', moment().format('M/DD/YYYY h:mm a')], ['', ''], ['Server', userInfo.server], ['Account', userInfo.user], ['', ''], ['Reporting Period'+(rp.length === 1 ? '':'s'), rp[0]+(rp.length === 1 ? '':` (+${rp.length-1})`)]]; 
  for (let i = 0; i < params.length; i++) {
    sheet.getCell(`B${i+15}`).value = params[i][0]; 
    sheet.getCell(`B${i+15}`).alignment = {horizontal: 'right'}
    sheet.getCell(`C${i+15}`).value = params[i][1]; 
    sheet.getCell(`B${i+15}`).border = {right: {style: 'thin'}}; 
    sheet.getCell(`C${i+15}`).font = fonts.bold; 
  }
  sheet.getCell('B23').value = `svexport:`; 
  sheet.getCell('B23').alignment = {horizontal: 'right'}; 
  sheet.getCell('C23').value = 'v'+VERSION; 
  sheet.getCell('B23').font = {color: {argb: 'FFBFBFBF'}}; 
  sheet.getCell('C23').font = {color: {argb: 'FFBFBFBF'}};

  courses.unshift({p: 'P', n: 'Course', g: 'Grade'}); 
  let row = 14; 
  for (let i of courses) {
    row++; 
    sheet.getCell(`E${row}`).value = i.p; 
    sheet.getCell(`E${row}`).alignment = {horizontal: 'center'}; 
    sheet.getCell(`G${row}`).value = i.g; 
    sheet.getCell(`G${row}`).alignment = {horizontal: 'center'}; 
    if(i.l) {
      sheet.getCell(`F${row}`).value = {
        text: i.n, 
        hyperlink: `#'${i.l}'!A1`
      }
      sheet.getCell(`F${row}`).protection = {
        locked: false, 
        hidden: true
      }
      sheet.getCell(`F${row}`).font = fonts.link; 
    } else {
      sheet.getCell(`F${row}`).value = i.n; 
    }
    for (let i of ['E', 'F', 'G']) {
      if(row === 15) {
        sheet.getCell(`${i}${row}`).fill = styles.d1; 
        sheet.getCell(`${i}${row}`).font = fonts.white; 
      } else{
        sheet.getCell(`${i}${row}`).border = {bottom: {style: 'thin'}}
      }
    }
  }
  sheet.protect(false, {
    selectLockedCells: false
  }); 
}

function createWorkbook(data, userInfo) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'StudentVUE+';
  workbook.lastModifiedBy = 'StudentVUE+';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  const name = userInfo.name?userInfo.name:'(not provided)'
  let firstSheet = workbook.addWorksheet('Overview', {
    headerFooter: {oddHeader: "Overview", oddFooter: "&12&K4472C4StudentVUE+\n&10&KC1C1C1svue.itsryan.org"}, 
    views: [{showGridLines: false, showRowColHeaders: false}]
  });
  let firstSheetCourses = []; 

  for(let i = 0; i < data.length; i++){
    let c = data[i]; // course info
    let m = {MarkName: 'n/a', CalculatedScoreString: 'n/a', CalculatedScoreRaw: '0.0'}; // mark info
    let assignments = []; // assignments
    let gcs = [""]; // grade calculation summary 
    let cr = 0; // current row (starting after first three rows of headers)

    try {
      m = c.Marks[0].Mark[0].$; 
      gcs = c.Marks[0].Mark[0].GradeCalculationSummary; 
      if(c.Marks[0].Mark[0].Assignments && c.Marks[0].Mark[0].Assignments[0] !== '' && c.Marks[0].Mark[0].Assignments[0].Assignment && c.Marks[0].Mark[0].Assignments[0].Assignment[0] !== '') { // check to ensure there are actually assignments
        assignments = c.Marks[0].Mark[0].Assignments[0].Assignment
      }
    } catch (e) {
      console.warn(`Missing: grade mark (user: ${name}) `, e)}
    let sheet = workbook.addWorksheet(trimTitle(`${c.$.Period}-${c.$.Title}`), {
      pageSetup:{fitToPage: true, fitToWidth: 1, fitToHeight:6, printTitlesRow: '1:3'},
      headerFooter: {oddHeader: "Grade Report", oddFooter: "&12&K4472C4StudentVUE+\n&10&KC1C1C1svue.itsryan.org"}
    });
    sheet.cAddRow = function() { // custom implementation w/ identical functionality, while also tracking row number
      // yes, ExcelJS has a getter for this. no, I don't want to call it an excessive number of times. 
      cr ++; 
      return sheet.addRow.apply(this, arguments); 
    }

    sheet.getColumn(1).width = 10; // fits MM/DD/YYYY, equiv. to 9.22 in Excel
    sheet.getColumn(2).width = 40; // for assignment name

    sheet.getColumn(3).hidden = true; // unhidden to add additional assignment data (if selected), hidden by default 
    sheet.getColumn(4).hidden = true; 
    sheet.getColumn(5).hidden = true; 
    
    sheet.getColumn(10).width = 10.56; // fits ### (###%), equiv. to 9.78 in Excel

    // Header
    let firstRow = ['Class', c.$.Title]; 
    firstRow[6] = 'Student'; 
    firstRow[7] = name; 
    sheet.cAddRow(firstRow); 
    let secondRow = ['Teacher']; 
    secondRow[6] = 'Period'; 
    secondRow[7] = c.$.Period; 
    secondRow[8] = 'Room'; 
    secondRow[9] = c.$.Room;
    sheet.cAddRow(secondRow);
    sheet.getCell('B2').value = {
      text: c.$.Staff, 
      hyperlink: `mailto:${c.$.StaffEMail}`, 
      tooltip: `Email: ${c.$.StaffEMail} (Click or tap to follow)`
    }
    // Merge cells
    sheet.mergeCells('B1:F1'); 
    sheet.mergeCells('H1:J1'); 
    sheet.mergeCells('B2:F2'); 
    
    // Header Styles
    sheet.getRow(1).eachCell((cell, col) =>{
      if(col === 1 || col === 7){
        cell.font = fonts.gray
      } else {
        cell.font = fonts.bold
        if(col === 8){
          cell.alignment = {horizontal: 'center'} 
        }
      }
      cell.border = {bottom: {style: 'thin'}}
      cell.fill = styles.h1; 
    })
    sheet.getRow(2).eachCell((cell, col) =>{
      if(col === 1 || col === 7 || col === 9){
        cell.font = fonts.gray
      } else if (col === 2){
        cell.font = fonts.link
      } else if (col >= 8) {
        cell.font = fonts.bold
        cell.alignment = {horizontal: 'center'}
      }
      cell.border = {bottom: {style: 'medium'}}
      cell.fill = styles.h2; 
    })

    if(styles.headerBreaks) sheet.cAddRow(['']);
    // Header rows - Overview (3), Grade Distribution (6), Assignments (9)
    // Overview (r3-5)
    sheet.cAddRow(['Overview',,,,,,,'As Of', moment().format('MM/DD/YYYY'), '']).eachCell({includeEmpty: true}, (cell, col) => {
      if(col === 1 || col === 9){
        cell.font = fonts.bold
        if(col === 9){
          cell.alignment = {horizontal: 'center'}}
      } else if (col === 8) {
        cell.alignment = {horizontal: 'center'}
        cell.font = fonts.gray
      }
      cell.fill = styles.s1; 
      cell.border = {bottom: {style: 'thin'}}
    }); 
    sheet.mergeCells(`I${cr}:J${cr}`); 
    sheet.cAddRow(['Grading Period',,,,,,,,m.MarkName,'']); 
    sheet.getCell(`I${cr}`).alignment = {horizontal: 'center'}; 
    sheet.mergeCells(`I${cr}:J${cr}`);

    let csr = m.CalculatedScoreRaw; 
    if(!isNaN(parseFloat(csr)) && parseFloat(csr) > 5) { // add % sign to percentages
      csr = csr + '%' }
    sheet.cAddRow(['Current Grade',,,,,,,,csr,m.CalculatedScoreString]); 
    sheet.getCell(`I${cr}`).alignment = {horizontal: 'center'}; 
    sheet.getCell(`J${cr}`).alignment = {horizontal: 'center'}; 

    if(styles.headerBreaks) sheet.cAddRow(['']);

    // Grade Distribution (r8-10)
    sheet.cAddRow(['Grade Distribution',,,,,,,,,'']).eachCell({includeEmpty: true}, (cell, col) => {
      if(col === 1){
        cell.font = fonts.bold
      } 
      cell.fill = styles.s1; 
      cell.border = {bottom: {style: 'thin'}}
    });
    sheet.getCell(`H${cr}`).value = 'Type' 
    sheet.getCell(`H${cr}`).font = fonts.gray; 
    sheet.getCell(`H${cr}`).alignment = {horizontal: 'center'}; 
    if(!gcs || gcs[0] === '') {
      sheet.getCell(`I${cr}`).value = 'Unweighted'
      sheet.getCell(`I${cr}`).alignment = {horizontal: 'center'}
      sheet.mergeCells(`I${cr}:J${cr}`)

      sheet.cAddRow(['Points',,,,,,,,,'']); 
      let ucr = (styles.headerBreaks?13:10); // 
      sheet.getCell(`I${cr}`).alignment = {horizontal: 'center'}
      sheet.getCell(`I${cr}`).value = {
        formula: `_xlfn.CONCAT(TEXT(SUM(H${ucr}:H${ucr+assignments.length}), "#,0.0#"), " / ", TEXT(SUM(I${ucr}:I${ucr+assignments.length}), "#,0.0#"), " pts")`}
      sheet.mergeCells(`I${cr}:J${cr}`)
        // formula: `_xlfn.CONCAT(SUM(H${ucr}:H${ucr+assignments.length}), " / ", SUM(I${ucr}:I${ucr+assignments.length}))`}
      // sheet.getCell(`J${cr}`).alignment = {horizontal: 'center'}
      // sheet.getCell(`J${cr}`).value = {formula: `IF(SUM(I${ucr}:I${ucr+assignments.length})=0, "(n/a)", SUM(H${ucr}:H${ucr+assignments.length})/SUM(I${ucr}:I${ucr+assignments.length}))`};
      // sheet.getCell(`J${cr}`).numFmt = '0.000%'; 
    } else{
      sheet.getCell(`I${cr}`).value = 'Weighted'
      sheet.getCell(`I${cr}`).alignment = {horizontal: 'center'}
      sheet.mergeCells(`I${cr}:J${cr}`)

      sheet.cAddRow(['Category',,,,,'Weight','Points','Total','Perc','Mark']).eachCell({includeEmpty: true}, (cell, col) => {
        if (col >= 5) cell.alignment = {'horizontal': 'center'}; 
        cell.fill = styles.s2; 
        cell.border = {bottom: {style: 'thin'}}
      }); 
      if(gcs[0].AssignmentGradeCalc) {
        let agc = gcs[0].AssignmentGradeCalc; 
        let totalRow; 
        for(let i = 0; i < agc.length; i++){
          let cat = agc[i].$; // category
          if(cat.Type === 'TOTAL') {
            totalRow = cat; // special row used by svue
            continue; 
          }
          sheet.cAddRow([cat.Type,,,,,cat.Weight,cat.Points,cat.PointsPossible,cat.WeightedPct,(cat.CalculatedMark==='0'?'(n/a)':cat.CalculatedMark)]).eachCell((cell, col) =>{
            if(col > 5){
              cell.alignment = {'horizontal': 'center'}; 
            }
          }); 
        }
        if(totalRow){
          sheet.cAddRow(['Total',,,,,totalRow.Weight,totalRow.Points,totalRow.PointsPossible,totalRow.WeightedPct,(totalRow.CalculatedMark==='0'?'(n/a)':totalRow.CalculatedMark)]).eachCell({includeEmpty: true}, (cell, col) => {
            if(col >= 5) cell.alignment = {'horizontal': 'center'}; 
            cell.border = {top: {style: 'thin'}}
          }); 
        }
      } else{
        sheet.cAddRow(['[Error] Missing categories.'])
      }
    }
    
    if(styles.headerBreaks) sheet.cAddRow(['']);
    
    // Assignments (r11-12)
    sheet.cAddRow(['Assignments',,,,,,,,, '']).eachCell({includeEmpty: true}, (cell, col) => {
      if(col === 1){
        cell.font = fonts.bold
      } 
      cell.fill = styles.s1; 
      cell.border = {bottom: {style: 'thin'}}
    }); 
    sheet.getCell(`H${cr}`).value = 'Total' 
    sheet.getCell(`H${cr}`).font = fonts.gray; 
    sheet.getCell(`H${cr}`).alignment = {horizontal: 'center'}; sheet.getCell(`I${cr}`).value = assignments.length; 
    sheet.getCell(`I${cr}`).numFmt = `0" Item${assignments.length!==1?'s':''}"`
    sheet.getCell(`I${cr}`).alignment = {horizontal: 'center'}
    sheet.mergeCells(`I${cr}:J${cr}`)

    sheet.cAddRow(['Date','Assignment',,,,'Type',,'Points','Total','Mark']).eachCell({includeEmpty: true}, (cell) => {
      cell.fill = styles.s2; 
      cell.border = {bottom: {style: 'thin'}}
    }); 
    sheet.autoFilter = {
      from: `A${cr}`, 
      to: `J${cr}`, 
      exclude: [1, 2, 3, 5]
    }; 
    sheet.mergeCells(`B${cr}:E${cr}`); 
    sheet.mergeCells(`F${cr}:G${cr}`); 

    for (let i = 0; i < assignments.length; i++) {
      let a = assignments[i].$; 
      let pts = ['0', '0']; 
      if(a.Points.indexOf('/') !== -1) pts = a.Points.split('/'); 
      pts[0] = parseFloat(pts[0]); 
      pts[1] = parseFloat(pts[1]); 
      let scr = '(n/a)'; 
      if (a.Score.indexOf('out of') !== -1) {
        if (pts[1] > 0) scr = `${parseFloat(a.Score)} (${(100*pts[0]/pts[1]) >= 100 ? Math.round(100*pts[0]/pts[1]) : (100*pts[0]/pts[1]).toFixed(1)}%)`
        else scr = `${parseFloat(a.Score)} (N)`
      } else if (a.Score.slice(0, 3) === 'Not ') {
        scr = 'N'; 
      }
      sheet.cAddRow([a.Date, a.Measure,,,, a.Type,, pts[0], pts[1], scr]); 
      // sheet.mergeCells(`B${cr}:E${cr}`);
      // sheet.mergeCells(`F${cr}:G${cr}`);

      if (a.Notes && a.Notes !== '') {
        sheet.getCell(`B${cr}`).font = fonts.note; 
        sheet.getCell(`B${cr}`).dataValidation = {
          showInputMessage: true, 
          promptTitle: 'Note', 
          prompt: a.Notes
        }
      }
      if (a.Measure.length > 42){
        if(sheet.getCell(`B${cr}`).font) {
          sheet.getCell(`B${cr}`).font.size = 9; 
        } else{
          sheet.getCell(`B${cr}`).font = {size: 9}
        }
      }
      if (a.Type.length > 16){
        sheet.getCell(`F${cr}`).font = {size: 9}
      }
      sheet.getCell(`J${cr}`).font = fonts.grade; 
      sheet.getCell(`J${cr}`).dataValidation = {
        showInputMessage: true, 
        promptTitle: 'Details', 
        prompt: `Score: ${a.Score}_x000a_Points: ${a.Points}`
      }
    }

    firstSheetCourses.push({
      rp: m.MarkName,
      p: c.$.Period, 
      n: c.$.Title, 
      l: trimTitle(`${c.$.Period}-${c.$.Title}`), 
      g: `${csr} (${m.CalculatedScoreString})`
    }); // add course data for first sheet table
  }

  buildLandingPage(workbook, firstSheet, userInfo, firstSheetCourses); 
  return workbook; 
}

module.exports = {
  createXLSX: async (rawData, user) => {
    // input: data from fetchSVUE
    // --> [{"Course": [{Courses}]}]
    // output: buffer
    let data = prepData(rawData); 
    let wb = createWorkbook(data, user); 
    let buffer = await wb.xlsx.writeBuffer(); 
    return buffer; 
  }, 
  rawJSON: (rawData) => {
    // input: data from fetchSVUE
    // --> [{"Course": [{Courses}]}]
    // output: JSON
    return prepData(rawData); 
  }
}