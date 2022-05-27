/** core.js
 * (C) 2021 Ryan Zhang. See license.md for licensing. 
 * A replacement "core" (built in late 2020) for the ever worsening spaghetti code from 2018 to handle loading courses, caching courses, and handling concurrent schools + multiple reporting periods simultaneously (which under the previous setup was not possible)
 * Additionally, unlike the previous implementation, this one uses JavaScript's native Fetch API, removing the need for jQuery or Zepto.js + AJAX - and for a lot of other questionable hacks taken to make things work (i.e., errors being sent a status code of 200 because Zepto's $.get w/o ajax didn't support error handling). 
 * @requires localforage (localForage ~1.7.3) 
 * @requires moment (moment.js ~2.24)
 */

// Single object rather than modules as Remchi wasn't build around modules, so this is easier for maintainability while keeping global namespace pollution down
// Yes, this design makes _(varname) variables not actually private, but redesigning the entire code to be fully up-to-standard and modular is a task that requires far too much time for little to no benefit. 
const svcore = {
  /** @private Metadata, formatted as {user: (string), domain: (string), school: (string), name: (string), schools: (array)} */
  _metadata: false, 
  /** @private Item history used in cbDiff */
  _itemHist: false,
  /** @protected Currently/most recently loaded reporting periods */ 
  _rpSel: [], 
  /** @private Specifies how to fetch grades. 0 (default) = cache first, update from network if cache is older than 15 minutes, 1 = update from network, 2 = cache only */
  _fetchMode: 0, 
  /**
   * Throws a warning out to whichever channels are setup. In Remchi, this function is configured to a) throw a warning out to the browser console, and b) throw a warning out to a user-accessible location (on the right side of the courseList header)
   * @param {*} msg - Message to throw out
   */
  warn: function (msg) {
    console.warn(msg); 
  }, 
  /**
   * Makes a request to the /data/gradebook endpoint, and returns the response. Will also write the response to gbd-cache, updating any metadata necessary along the way. 
   * @private - Internal function. Use @function fetchCurrentGB or @function fetchGradebook instead.
   * @param {string} [school="h"] - GUID of school, blank/"h" for home school
   * @param {number} [rp] - Reporting period to lookup, blank for current
   * @returns {object} Object in the format {ok: false, error: (string)}|{ok: true, data: (array), rp: (number), school: (string)}. Data key contains an array of courses.
   */
  _gbf_networkFirst: async function (school='h', rp) {
    let params = [], status = 0, ok = false; 
    // prepare request
    if (school !== 'h') {
      params.push(`school=${school}`); 
    }
    if (rp || rp === 0) {
      params.push(`reportingPeriod=${rp}`);
    }
    let res = await fetch('/data/gradebook' + (params.length > 0 ? `?${params.join('&')}` : '')).then(r => {
      ok = r.ok; 
      status = r.status; 
      return r.json(); 
    }).catch(e => {
      return {
        _isError: true,
        msg: e.message
      }
    }); 
    if (res._isError || (res && res.error)) { // network error occurred somewhere 
      return {  
        ok: false, 
        error: res.msg
      }
    } else if (ok) { // all good
      // update cache as necessary 
      if (!this._metadata) {
        // no metadata currently available, initialize metadata if necessary
        let md = await localforage.getItem('gbd-metadata'); 
        if (md) {
          this._metadata = md; 
        } else {
          this._metadata = {
            user: res.user, 
            rp: {}, 
            rpDef: {}
          }; 
        }
      }

      // set default reporting period if applicable
      if (res.rp && res.rp.all && res.rp.cur) {
        this._metadata.rp[school] = res.rp.all;
        if (!rp && this._metadata.rpDef && !this._metadata.rpDef[school]) {
          this._metadata.rpDef[school] = res.rp.cur.index; 
        }
      }

      // open cache to write to it
      let cache = await localforage.getItem('gbd-cache'); 
      if (!cache) cache = {};
      let updateObj = this._formatForCache(res, school); 
      cache[updateObj.key] = updateObj.value; 

      // async is okay, no need to make it blocking
      localforage.setItem('gbd-cache', cache); 
      localforage.setItem('gbd-metadata', this._metadata);

      // update our item history cache as well as svUUID if needed
      this.updateItemHist(res.itemHist); 
      if (res.svUUID) {
        if (!this._metadata.svUUID || this._metadata.svUUID !== res.svUUID) {
          this._metadata.svUUID = res.svUUID; // unique user id associated with each Remchi account
        }
      }

      // return the course array
      return {
        ok: true, 
        data: res.courses, 
        rp: (res.rp && res.rp.cur) ? res.rp.cur.index : false, 
        school: school
      };
    } else { // non-2xx status code
      return {
        ok: false, 
        error: res.msg ? res.msg:`A server error occurred. (${status})`
      }
    }
  },
  /**
   * Takes raw data from Remchi server and formats it into a cache-ready object, removing unnecessary properties and reformating non-uniform properties
   * @private - Internal function used only by @function _fetchCacheFirst
   * @param {object} data - raw data returned from the /data/gradebook endpoint
   * @param {string} [school="h"] - GUID of school, blank/"h" for home school
   * @returns {object} Object in the format {key: (string), value: {ts: (number), data: (object)}}. Note that none of these timestamps contain the millisecond component. 
   */
  _formatForCache: function (data, school='h') {
    let out = {ts: Math.floor(Date.now()/1000)}; 
    out.data = data.courses;
    let index = -1;  
    if (data.rp && data.rp.cur && typeof data.rp.cur.index !== 'undefined') {
      index = data.rp.cur.index; // used for the object key
    } 
    return {
      key: `${school}/${index}`, 
      value: out
    }; 
  }, 
  /**
   * Same as @function _gbf_networkFirst, except it'll check the cache first. By default, it'll only respond cached results from the last fifteen minutes. 
   * @private - Internal function. Use @function fetchCurrentGB or @function fetchGradebook instead.
   * @param {string} [school="h"] - GUID of school, blank/"h" for home school
   * @param {number} [rp] - Reporting period to lookup, blank for current
   * @param {boolean} [fromCacheOnly] - Whether to only fetch from cache. If true, and no cache is available, an object will be returned with "ok" as false. 
   * @returns {object} Object in the format {ok: false, error: (string)}|{ok: true, data: (array), rp: (number), school: (string), [fromCache]: (boolean)}
   */
  _gbf_cacheFirst: async function (school='h', rp, fromCacheOnly) {
    let cache = await localforage.getItem('gbd-cache'); 
    if (!cache) cache = {}; // no cache exists
    if (!this._metadata) {
      // attempt to load user metadata
      let md = await localforage.getItem('gbd-metadata'); 
      if (md) {
        this._metadata = md; 
      } 
    }
    // attempt to open cache
    if (this._metadata) { // no metadata would suggest not currently having a cache
      let cachedCourse = cache[`${school}/${(rp || rp === 0)?rp:this._metadata.rpDef[school]}`]; 
      if (cachedCourse) {
        let ts = cachedCourse.ts; 
        if (Date.now()/1000 < ts + 900 || fromCacheOnly) {
          // data older than 15 min is refreshed, unless otherwise specified 
          return {
            ok: true, 
            fromCache: true, 
            ts: ts, 
            data: cachedCourse.data,
            rp: (rp || rp === 0)?rp:this._metadata.rpDef[school], 
            school: school
          }
        }
      }
    }
    // return error if fromCacheOnly is true and cache is not available
    if (fromCacheOnly) {
      return {
        ok: false, 
        error: 'No cached data available for the specified reporting period.'
      }
    }
    // fetch from server
    return await this._gbf_networkFirst(school, rp);  
  }, 
  /**
   * @private - Internal function shared by @function fetchCurrentGB and @function fetchGradebook to spread out an array of one or more nested course objects, while also adding corresponding metadata. 
   * @param {array} data - Array of objects in the format of {data: (data object from @function _gbf_networkFirst or @function _gbf_cacheFirst), md: (object)}
   * @returns {object} - {ok: true, fromCache: (boolean), [ts]: (number), data: (array)}, with array ready for use in cbData and cbDiff
   */
  _spreadData: function (data) {
    let dataOut = []; 
    let ts = 0; 
    for (let i of data) {
      if (i.fromCache && (ts === 0 || i.ts < ts)) ts = i.ts; 
      dataOut.push({
        _m: true, // signifies metadata object (not a course object)
        school: i.md.school, 
        rp: i.md.rp, 
        rpDate: i.md.rpDate
      }); 
      if (i.data) {
        dataOut.push(...i.data);
      } else {
        dataOut.push({
          _m: true, 
          _nd: true // no data (occurs when a reporting period is listed but doesn't have any courses in it)
        });
      }
    }
    this._rpSel = data.map(r => r.md._key); 
    let out = {
      ok: true, 
      fromCache: !(ts===0), 
      data: dataOut
    }; 
    if (ts !== 0) out.ts = ts;  
    return out; 
  }, 
  /**
   * Uses @var _fetchMode to fetch the gradebook based on the policy specified, using @function _gbf_cacheFirst or @function _gbf_networkFirst as needed. 
   * @private - Internal function. Use @function fetchCurrentGB or @function fetchGradebook instead.
   * @param {string} [school="h"] - GUID of school, blank/"h" for home school
   * @param {number} [rp] - Reporting period to lookup, blank for current
   * @returns {object} - {ok: true, [fromCache]: (boolean), [ts]: (number), data: (array)}, with array ready for use in cbData and cbDiff
   */
  _gbFetch: async function (school='h', rp) {
    switch (this._fetchMode) {
      case 0: 
      default: 
        return await Promise.race([this._gbf_cacheFirst(school, rp), new Promise((res) => setTimeout(() => res({ok: false, error: 'The request timed out.'}), 12000))]); 
      case 1: 
        return await Promise.race([this._gbf_networkFirst(school, rp), new Promise((res) => setTimeout(() => res({ok: false, error: 'The request timed out.'}), 12000))]); 
      case 2: 
        return await this._gbf_cacheFirst(school, rp, true); 
    }
  }, 
  /**
   * Async function to load the metadata into svcore (if needed). 
   * @returns {boolean} true - when metadata is loaded
   */
  init: async function() {
    if (this._metadata) return true; 
    let md = await localforage.getItem('gbd-metadata'); 
    this._metadata = md; 
    return true; 
  }, 
  /**
   * Given a school GUID and reporting period index, returns all reporting period metadata for said school. Returns false if not found in metadata. 
   * @param {string} [school="h"] - GUID of school, blank/"h" for home school
   * @param {number} [rp] - Reporting period to lookup, blank for current
   * @returns {boolean|object} False if failed, or Object in the format {cur: (number), all: (array), school: (string)} where (array)[cur] is the current reporting period
   */
  getRPName: function (school="h", rp) {    
    if (this._metadata && this._metadata.rp) {
      if ((!rp && rp !== 0) && this._metadata.rpDef) {
        if (typeof this._metadata.rpDef[school] !== 'undefined') rp = this._metadata.rpDef[school];
      }
      if (this._metadata.rp[school]) {
        let schoolRP = this._metadata.rp[school]; 
        return {
          all: schoolRP, 
          cur: schoolRP.findIndex(r => r.index === rp), 
          school: (school === 'h' ? this._metadata.user.school:this._metadata.user.concurrent.find(r => r.guid === school).name)
        }
      }
    }
    return false; 
  }, 
  /**
   * Returns an array with all reporting periods for all schools. Used in the reporting period selection modal. 
   * @returns {array} - [{_guid: (string), name: (string), selected: (boolean), default: (boolean), start: (string), end: (string)}, ...] where _guid is a string that can be used in @function fetchGradebook
   */
  getRPList: function () {
    let out = []; 
    if (!this._metadata) return []; 
    let rpCur = this._metadata.rpCur ? this._metadata.rpCur : []; // default / "current" reporting periods, based on fetchCurrentGB()
    let rpSel = this._rpSel ? this._rpSel : []; // reporting periods that are currently shown / "selected"
    if (!this._metadata.rp) return out; 
    Object.entries(this._metadata.rp).forEach(school => {
      school[1].forEach(rp => {
        let name = `${(school[0] === 'h' ? this._metadata.user.school : this._metadata.user.concurrent.find(r => r.guid === school[0])['name'])} / ${rp.name}`;
        out.push({
          _guid: `${school[0]}/${rp.index}`, 
          name: name, 
          selected: rpSel.indexOf(`${school[0]}/${rp.index}`)!=-1, 
          default: rpCur.indexOf(`${school[0]}/${rp.index}`)!=-1, 
          start: moment.unix(rp.start).format('ll'), 
          end: moment.unix(rp.end).format('ll')
        }) 
      })
    })
    return out; 
  },
  /**
   * Returns all courses from "active" reporting periods (as in, the student currently has classes in, determined by the start/end dates associated with each reporting period). Cache-first policy is followed by default, with server updates done only if one or more reporting periods have passed. 
   * @returns {array} Course array, with metadata items. 
   */
  fetchCurrentGB: async function (fetchMode) {
    // load default reporting periods for each school 
    let data = []; 
    this._fetchMode = fetchMode; 
    let dt = await this._gbFetch(); 
    if (!dt.ok) {
      return {
        ok: false, 
        error: dt.error
      }
    }
    data.push(dt); // default period, will also load metadata if not already loaded

    if (this._metadata.user.concurrent) {
      for (i of this._metadata.user.concurrent) {
        let dtc = await this._gbFetch(i.guid); 
        if (!dtc.ok) {
          return {
            ok: false, 
            error: dtc.error
          }
        }
        data.push(dtc);
      }
    }

    // add metadata to each school 
    let pos = 0; 
    let otherRPsLoaded = {}; // formatted as (school GUID)/(reporting period name), i.e. "h/Semester" - once a reporting period from a school is loaded, it's written here so that it doesn't get loaded a second time (see comment below)
    while (pos < data.length && pos < 32) {
      if (pos === 31) this.warn('Potential error with loading alternate reporting periods for a school (hit limit of n=32)'); 

      let rp = this.getRPName(data[pos].school, data[pos].rp); 
      if (rp) {
        let curRP = rp.all[rp.cur]; 
        data[pos].md = {
          _key: `${data[pos].school}/${data[pos].rp}`,
          school: rp.school, 
          rp: curRP.name, 
          rpDate: `${moment.unix(curRP.start).format('MMM D')} - ${moment.unix(curRP.end).format('MMM D')}`
        }

        // some schools use different reporting period lenghts for different classes (i.e., classes A and B are under a quarter system, while class C is under a semester system) - because the mobile API gives zero indication of that, we'll attempt to do it by ourselves here.  
        // while probably not necessary, this implementation is designed to be recursive so that you could potentially throw as many different reporting periods at it as you want, and it'll simply go through them one at a time.

        let otherRPs = rp.all.filter(r => (r.name.split(' ')[0] !== curRP.name.split(' ')[0] && !otherRPsLoaded[`${data[pos].school}/${r.name.split(' ')[0]}`])); // filter out current reporting period name, as well as any others used
        if (otherRPs.length > 0) {
          otherRPsLoaded[`${data[pos].school}/${curRP.name.split(' ')[0]}`] = 1; // mark the current reporting period type as used
          otherRPs = otherRPs.sort((a, b) => a.start - b.start); // should already be sorted chronologically, but just in case
          let altIndex = 0; 
          for (let i = 0; i < otherRPs.length; i++) {
            if (otherRPs[i].start < (Date.now()/1000 - 86400)) altIndex = i; // use the latest reporting period possible such that its start date is no more than one day in the future
          }
          let newRP = await this._gbFetch(data[pos].school, otherRPs[altIndex].index);
          otherRPsLoaded[`${data[pos].school}/${otherRPs[altIndex].name.split(' ')[0]}`] = 1; // mark the new reporting period type as used, so that it doesn't recursively get used again
          data.splice(pos+1, 0, newRP); // add new reporting period to array
        }
      } else {
        data[pos].md = {
          _key: `${data[pos].school}/${data[pos].rp}`,
          school: 'Unknown School', 
          rp: 'Unknown Reporting Period', 
          rpDate: 'n/a'
        }
      }
      pos ++; 
    }

    this._metadata.rpCur = data.map(r => r.md._key); 
    localforage.setItem('gbd-metadata', this._metadata);
    // spread out the courses from each school/reporting period into a 1d array
    return this._spreadData(data); 
  }, 
  /**
   * Fetches one or more gradebooks. Cache-first policy is followed if the data is less than ten minutes old, otherwise will fetch and cache from network. 
   * @param {(string|array|null)} [target] - The GUID of the school to lookup / Reporting Period, in the format "(GUID)/(RP)". Use "h" to specify the home school, or an array in the format of [(string), (string), etc.] for multiple reporting periods, or null/blank (default) to look up all reporting periods currently active. 
   * @param {number} [fetchMode=0] - Which mode to use (default, network only, cache only)
   * @returns {array} Array of courses, to be used in cbData and courseList. If multiple schools and/or reporting periods are returned, metadata items are automatically inserted into the array. 
   */
  fetchGradebook: async function (target, fetchMode=0) {
    // format report periods to look up as [(guid)/(rp), etc.]
    let inp = []; 
    this._fetchMode = fetchMode; 
    if (Array.isArray(target)) inp = target; 
    else {
      if (typeof target === 'string') {
        // fetch one 
        inp = [target]; 
      } else {
        // fetch current reporting periods
        return await this._gbFetch(); 
      }
    }
    // fetch specified inputs
    // load default reporting periods for each school 
    let data = []; 
    for (i of inp) {
      let str = i.split('/'); 
      let guid = str[0], rp = (str.length > 1 && !isNaN(parseInt(str[1])) ? parseInt(str[1]):null); 
      let res = await this._gbFetch(guid, rp); 
      if (!res.ok) {
        return {
          ok: false, 
          error: res.error
        }
      }
      data.push(res);
    }
    
    for (let pos = 0; pos < data.length; pos ++) {
      let rp = this.getRPName(data[pos].school, data[pos].rp); 
      if (rp) {
        let curRP = rp.all[rp.cur]; 
        data[pos].md = {
          _key: `${data[pos].school}/${data[pos].rp}`,
          school: rp.school, 
          rp: curRP.name, 
          rpDate: `${moment.unix(curRP.start).format('MMM D')} - ${moment.unix(curRP.end).format('MMM D')}`
        }
      } else {
        data[pos].md = {
          _key: `${data[pos].school}/${data[pos].rp}`,
          school: 'Unknown School', 
          rp: 'Unknown Reporting Period', 
          rpDate: 'n/a'
        }
      }
    }

    return this._spreadData(data); 
  }, 
  /**
   * Returns the user's full name, or false if unavailable. 
   * @returns {String|Boolean} (String) Name|(Boolean) False
   */
  getName: function() {
    if (this._metadata && this._metadata.user && this._metadata.user.fullName) {
      return this._metadata.user.fullName; 
    }
    return false; 
  }, 
  /**
   * Returns the user's school, or false if unavailable. 
   * @returns {String|Boolean} (String) School|(Boolean) False
   */
  getSchool: function() {
    if (this._metadata && this._metadata.user && this._metadata.user.school) {
      return this._metadata.user.school; 
    }
    return false; 
  }, 
  /**
   * Returns the user's item history.
   * @returns {Object} 
   */
  getItemHist: async function () {
    if (!this._itemHist) {
      let h = await localforage.getItem('gbd-hist'); 
      if (h) {
        this._itemHist = h; 
        return h; 
      }
      return {}; 
    }
    return this._itemHist; 
  }, 
  /**
   * Returns the UUID of the account (for Remchi, NOT for Synergy/StudentVUE), or false if the user does not have one (i.e., not logged in, using a demo account, etc.)
   * @returns {String|Boolean} - UUID String, or false. 
   */
  getUUID: function () {
    if (this._metadata && this._metadata.svUUID) {
      return this._metadata.svUUID; 
    }
    return false; 
  }, 
  /**
   * Updates the local item history cache. 
   * @param {Object} hist - Item history object, from /data/gradebook 
   */
  updateItemHist: async function (hist) {
    this._itemHist = hist; 
    localforage.setItem('gbd-hist', this._itemHist); 
  }
}