/* patchxlsx.js 
(C) 2020 Ryan Zhang. See LICENSE.md for license info. 

svexport.js relies on a custom implementation of ExcelJS (due to their lack of some features needed). Running patchxlsx.js will "patch" the ExcelJS library to support it. 

*/

// dependencies 
const crypto = require('crypto');
const colors = require('colors'); 
const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '..');

let counter = 0; 
function patch(patched, filepath, expectedHash) {
  counter ++; 
  const hash = crypto.createHash('sha256');
  const filename = path.basename(filepath); 
  fs.access(filepath, fs.R_OK | fs.W_OK, (err) => {
    if (err) {
      console.error('Could not find and/or access ExcelJS library - is it installed?'); 
      process.exit(1); 
    }
    console.log(`${colors.green(`[${counter}]`)} File: ${colors.cyan(filename)}`)
    const input = fs.readFileSync(filepath); 
    hash.update(input); 
    const digest = hash.digest('hex'); 
    console.log(' ├─ File hash:', digest)
    if (digest === expectedHash) {
      console.log(` └─ File is already patched.`);
    } else {
      console.log(` ├─ Patching file...`);
      fs.writeFile(filepath, fs.readFileSync(patched), (err) => {
        if (err) {
          throw err; 
        }
        console.log(' └─ Done!');
      })
    }
  })
}

patch(path.join(__dirname, 'resources', 'auto-filter-xform.js'), path.join(base, 'node_modules', 'exceljs', 'lib', 'xlsx', 'xform', 'sheet', 'auto-filter-xform.js'), '07a2e15dc19241d4fd480eb35db15a39485931e8361c6a4ee069a5ebc9691bc2'); 

patch(path.join(__dirname, 'resources', 'validator.js'), path.join(base, 'node_modules', 'fido2-library', 'lib', 'validator.js'), 'd8882b15f308e75b80bcde69f1143005e1fd95285b7f7211602313656ddafa1a'); 