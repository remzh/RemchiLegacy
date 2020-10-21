const parseString = require('xml2js').parseString;
const request = require('request');
const path = require('path'); 
const bcrypt = require('bcrypt'); 
const fs = require('fs'); 
const moment = require('moment'); 
let logger; 

const localSVUECreds = fs.existsSync(path.join(__dirname, 'svue.itsryan.accounts', 'svue.accounts.json')) ? require(path.join(__dirname, 'svue.itsryan.accounts', 'svue.accounts.json')):{}; 

let template_options = { method: 'POST',
  url: 'https://%d/Service/PXPCommunication.asmx',
  headers:
   { soapaction: 'http://edupoint.com/webservices/ProcessWebServiceRequest',
     'content-type': 'text/xml; charset=utf-8' },
  body:
   '<?xml version="1.0" encoding="utf-8"?>\n<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ProcessWebServiceRequest xmlns="http://edupoint.com/webservices/"><userID>%u</userID><password>%p</password><skipLoginLog>1</skipLoginLog><parent>0</parent><webServiceHandleName>PXPWebServices</webServiceHandleName><methodName>%m</methodName><paramStr>%r</paramStr></ProcessWebServiceRequest></soap:Body></soap:Envelope>'};

let zipLookupKey = false; 

function handleSVUEData(raw){
  return new Promise ((resolve, reject) => {
    parseString(raw, function (err, result) {
      let rawJSON = result; 
      if (err) {
        if (logger) logger.error(`handleSVUEData call (raw=${raw})`, err);
        reject({err});
        return } 
      parseString(rawJSON['soap:Envelope']['soap:Body'][0]['ProcessWebServiceRequestResponse'][0]['ProcessWebServiceRequestResult'][0], function(error, result) {
        if (error) {
          if (logger) logger.error(`handleSVUEData call (raw=${raw})`, error);
          reject({error});
          return }
        resolve(result); 
      }); 
    });
  }); 
}

/**
 * Emulates a SOAP 1.1 request to the provided (presumably Synergy server) domain, and returns the response. 
 * @param {string} method - which method 
 * @param {string} domain - domain of Synergy server, do NOT include "https://"
 * @param {string} user - account username
 * @param {string} pswd - account password
 * @param {string} [params] - addiitonal parameters to pass on (XML) 
 * @param {boolean} [raw=false] - true to respond with raw XML, false (default) to respond with JSON
 * @returns {(object|string)} JSON object by default, XML string if @param raw is set to true
 */
function fetchSVUE(method, domain, user, pswd, params, raw){
  return new Promise ((resolve, reject) => {
    // reject({code: 'ECONNRESET'}); return; // enable for simulating server being down
    let options = {...template_options}; 
    options.body = options.body.replace('%m', method).replace('%u', user).replace('%p', pswd).replace('%r', params?params:'');
    options.url = options.url.replace('%d', domain);
    if(domain === 'svue.itsryan.org') {
      if(method === 'TestWebServiceURL'){
        resolve({TestWebServiceURL: {
          OrganizationName: ['Internal Server']
        }})
      }
      else if(raw){
        resolve({RT_ERROR: {
          $: {'ERROR_MESSAGE': 'RAW request cannot be performed on a local account.\r\n' }}, error: 'Invalid method '})
      }
      let base = path.join(__dirname, 'svue.itsryan.accounts', user); 
      if(fs.existsSync(base) && localSVUECreds[user]){
        bcrypt.compare(pswd, localSVUECreds[user]).then(valid => {
          if(!valid){
            resolve({RT_ERROR: {
              $: {'ERROR_MESSAGE': 'The user name or password is incorrect.\r\n' }}, error: 'Incorrect password '}); 
          }
          else if(method === 'Gradebook' && fs.existsSync(path.join(base, 'Gradebook.json'))){
            fs.readFile(path.join(base, 'Gradebook.json'), 'utf8', (err, res) => {
              if(err){reject(err)}
              else{ // r.Gradebook.Courses[0].Course
                let data = JSON.parse(res).data; 
                resolve({
                  'Gradebook': {
                    'Courses': [{
                      'Course': data
                    }]
                  }
                }); 
              }
            }); 
          }
          else if(fs.existsSync(path.join(base, method+'.xml'))) {
            fs.readFile(path.join(base, method+'.xml'), 'utf8', (err, res) => {
              if(err){reject(err)}
              else{
                handleSVUEData(res).then(r => {
                  resolve(r); 
                })
              }
            }); 
          }
          else{
            reject({error: 'Method does not exist. '}); 
          }
        })
      }
      else{
        resolve({RT_ERROR: {
          $: {'ERROR_MESSAGE': 'Invalid user id or password' }}, error: 'User does not exist. '})}
    }
    else{
      request(options, function (error, response, body) {
        if (error) {
          if (logger) logger.error(`fetchSVUE call (method=${method}, user=${user}): `, error);
          reject(error);
          return;
        }
        else if (response.statusCode !== 200) {
          if (logger) logger.error(`fetchSVUE call (domain=${domain}) (statusCode=${response.statusCode})`);
          reject(error);
          return; 
        }
        if (raw) {
          resolve(body); 
        } 
        else{
          handleSVUEData(body).then(r => {
            resolve(r); 
          }).catch(e => {
            reject(e); 
          });
        }
      })
    }
  }); 
}

/**
 * Formats a user's concurrent schools into a nicer array (MongoDB doesn't support "$" objects)
 * @param {object} obj r.Concurrent as returned from @method fetchSVUE
 * @returns {array} [{name, guid}, ...]
 */
function formatConcurrent(obj) {
  try {
    let conc = obj[0].ConcurrentSchool; 
    let out = []; 
    for (let i of conc) {
      out.push({
        name: i.$.ConSchoolName, 
        guid: i.$.ConOrgYearGU
      })
    }
    return out; 
  } catch (err) {
    return false; 
  }
}

/**
 * Formats a user's reporting periods into a nicer array (MongoDB doesn't support "$" objects). Used specifically under /export, as /export doesn't need the current reporting period. 
 * @param {object} obj r.Gradebook.ReportingPeriods as returned from @method fetchSVUE
 * @returns {array} [{index: (string), name: (string)}, ...]
 */
function formatRP_partial(obj) {
  try {
    let rp = obj[0].ReportPeriod; 
    let out = []; 
    for (let i of rp) {
      out.push({
        name: i.$.GradePeriod, 
        index: i.$.Index
      })
    }
    return out; 
  } catch (err) {
    return false; 
  }
}

/**
 * Formats a user's reporting periods into a nicer format, for general purpose use. Requires both current RP and the RP list, and returns more information than formatRP does. 
 * @param {object} cur r.Gradebook.ReportingPeriod as returned from @method fetchSVUE
 * @param {object} obj r.Gradebook.ReportingPeriods as returned from @method fetchSVUE
 * @returns {array} [{index: (number), name: (string)}, ...]
 */
function formatRP(cur, obj) {
  try {
    let rp = obj[0].ReportPeriod, rpCurRaw = cur[0].$; 
    let rpCur = {
      name: rpCurRaw.GradePeriod, 
      index: -1, // -1 is for unknown by default
      start: moment(rpCurRaw.StartDate, 'M/D/YYYY').unix(), 
      end: moment(rpCurRaw.EndDate, 'M/D/YYYY').unix()
    }
    let rpAll = []; 
    for (let i of rp) {
      rpAll.push({
        name: i.$.GradePeriod, 
        index: parseInt(i.$.Index), 
        start: moment(i.$.StartDate, 'M/D/YYYY').unix(), 
        end: moment(i.$.EndDate, 'M/D/YYYY').unix()
      })
    }
    // attempt to find index of current reporting period
    let curMatch = rpAll.find(rp => rp.name === rpCur.name); 
    if (curMatch) rpCur.index = curMatch.index; 
    return {
      cur: rpCur, 
      all: rpAll
    }; 
  } catch (err) {
    return false; 
  }
}

/**
 * Validates and cleans a user-supplied Synergy domain
 * @param {string} url 
 * @returns {string} domain - fetchSVUE friendly 
 */
function checkURL(url){
  // returns false if URL is invalid, otherwise returns domain
  if(!url.match(/^(https\:\/\/)?[a-z0-9-]+\.[a-z0-9-.]+(\/[a-z0-9-]+)?/)){
    return false
  } 
  let out = url.match(/^(https\:\/\/)?[a-z0-9-]+\.[a-z0-9-.]+(\/[a-z0-9-]+)?/)[0]; 
  if(out.slice(0, 8) === 'https://'){
    out = out.slice(8)
  }
  return out; 
}

/**
 * Tests a domain to see if it's a valid Synergy server or not. Edupoint API key NOT required. 
 * @param {string} domain - server to test
 * @returns {string} name of Synergy server
 */
async function validateDistrictURL(domain){
  let resp = await fetchSVUE('TestWebServiceURL', domain, 'string', 'string', '').catch(err => {
    return false; 
  });
  if(resp){
    return resp.TestWebServiceURL.OrganizationName[0]; 
  } else{
    return false
  }
}

function parseDistrictURL(url){
  if(url.slice(0, 8) === 'https://') {
    url = url.slice(8); 
  } else{
    return '(Not supported. Contact devs for more info.)'
  }
  if(url.slice(-1) === '/'){
    url = url.slice(0, -1); 
  }
  url = url.toLowerCase()
  return url.toLowerCase()
}

function parseDistrictList(inp){
  try {
    let out = inp.map(ele => {
      return {name: ele.$.Name, url: parseDistrictURL(ele.$.PvueURL)}
    }); 
    return out; 
  } catch(e) {
    return false
  }
}

/**
 * Makes a request to Edupoint servers to find a list of schools using Synergy within a specified zip code. Edupoint API key required.  
 * @param {string} zip - zip code to lookup
 */
function getMatchingDistrictList(zip){
  return new Promise ((res) => {
    if(!zip.match(/^[0-9]{3,5}/)){
      res({type: 'error', error: 'Zip code is invalid.'}); 
      return; 
    } else if(!zipLookupKey){
      res({type: 'error', error: 'Missing API key, use district URL instead.'}); 
      return; 
    }
    zip = zip.match(/^[0-9]{3,5}/)[0]; 
    request({
      method: 'POST', 
      url: 'https://support.edupoint.com/Service/HDInfoCommunication.asmx',
      headers: {'content-type': 'text/xml'},
      timeout: 5000,
      body: `<?xml version="1.0" encoding="utf-8"?>\n<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ProcessWebServiceRequest xmlns="http://edupoint.com/webservices/"><webServiceHandleName>HDInfoServices</webServiceHandleName><methodName>GetMatchingDistrictList</methodName><paramStr>&lt;Parms&gt;&lt;Key&gt;${zipLookupKey}&lt;/Key&gt;&lt;MatchToDistrictZipCode&gt;${zip}&lt;/MatchToDistrictZipCode&gt;&lt;/Parms&gt;</paramStr></ProcessWebServiceRequest></soap:Body></soap:Envelope>`
    }, (err, resp, body) => {
      if(err) {
        res({type: 'error', error: err}); 
        return; 
      } 
      handleSVUEData(body).then(r => {
        try{
          if(r.DistrictLists.DistrictInfos[0] === ''){
            res({type: 'error', error: 'No districts found in the provided zip code.'});
            return; 
          }
          let listOut = parseDistrictList(r.DistrictLists.DistrictInfos[0].DistrictInfo);
          if(listOut){
            res({type: 'success', list: listOut}); 
          } else{
            res({type: 'error', error: 'Unable to parse list (40.2)'});
          }
        } catch(e){
          res({type: 'error', error: 'Unable to parse list (40.1)'})
        }
      });
    }); 
  }); 
}

module.exports = {
  fetchSVUE: fetchSVUE, 
  formatConcurrent: formatConcurrent, 
  formatRP: formatRP, 
  formatRP_partial: formatRP_partial, 
  checkURL: checkURL, 
  validateDistrictURL: validateDistrictURL, 
  getMatchingDistrictList: getMatchingDistrictList, 
  init: (lg, key) => {
    logger = lg; 
    zipLookupKey = key; 
    logger.info('svcore.js: Enabled logging functionality.')
  }
}