/**
 * weather.js
 * routing paths for /weather/* 
 */
const request = require('request'); 
const NodeCache = require( "node-cache" );
const cache = new NodeCache({
  checkperiod: 300
}); // cache used to store /onecall for up to 15 minutes

let API_KEY = false; 

/**
 * Takes an OpenWeather icon code, and returns a corresponding Font Awesome icon
 * @param {string} icon - provided by OpenWeather API
 * @returns {string} icon - to be used in the format "fas fa-(icon)"
 */
function iconToFA(icon) {
  let d = icon.slice(-1) === 'd' ? 'sun' : 'moon'; // day/night, sun/moon 
  switch (icon.slice(0, 2)) {
    case '01': 
      return d; 
    case '02': 
      return `cloud-${d}`; 
    case '03': 
    case '04': 
      return 'cloud'; 
    case '09':
      return 'cloud-rain'; 
    case '10': 
    case '11': 
      return `cloud-${d}-rain`; 
    case '13': 
      return 'snowflake'; 
    case '50': 
      return 'smog'; 
    default: 
      return 'question-circle'
  }
}

/**
 * Uses Open Weather's one call API to fetch full details of current condition, hourly, and daily forecasts. Minutely forcasts are excluded due to the cache (see below). 
 * Because getDetailedForecast has a significantly lower API quota (by several orders of magnitude - 86.4K/day -> 1K/day), getDetailedForecast will cache results for up to 15 minutes. 
 * @param {object} coords - coordinates in the format of {lat: (number), long: (number)}
 * @param {boolean} units - true for metric, false for imperial 
 */
function getDetailedWeather(coords, units) {
  return new Promise ((resolve, reject) => {
    if (!coords || !coords.lat || !coords.lon) {
      resolve({ok: false, error: 'Bad coordinates'}); 
      return; 
    }

    let cachedResp = cache.get(`${coords.lat.toFixed(1)},${coords.lon.toFixed(1)}`); 
    if (cachedResp) {
      resolve({
        ok: true, 
        resp: cachedResp
      })
    }

    request.get({
      url: `https://api.openweathermap.org/data/2.5/onecall?lat=${coords.lat}&lon=${coords.lon}&units=${units?'metric':'imperial'}&exclude=minutely&appid=${API_KEY}`
    }, (err, resp) => {
      if (err) {
        resolve ({ok: false, error: err}); 
      } else {
        let data = JSON.parse(resp.body); 
        cache.set(`${coords.lat.toFixed(1)},${coords.lon.toFixed(1)}`, data, 600)
        resolve ({ok: true, resp: data}); 
      }
    });
  })
}

/**
 * Given a zip code or coordinates, looks up the current weather. 
 * Will also make a call to getDetailedWeather in order to give next-day forecast as well as high/low of each day. 
 * @param {string} coords - zip code (US only, five digits) or lat/long coords in (number),(number) format
 */
function getCurrentWeather(coords, units) {
  return new Promise ((resolve) => {
    let inp = ''; 
    if (typeof coords !== 'string') {
      resolve({ok: false, error: 'Bad coordinates'}); 
      return; 
    } else if (coords.match(/^(-?([0-9]{1,2}(\.[0-9]{1,3})?),-?1?[0-9]{1,2}(\.[0-9]{1,3})?)$/)) {
      inp = `lat=${coords.split(',')[0]}&lon=${coords.split(',')[1]}`; 
    } else if (coords.match(/^[0-9]{5}$/)) {
      inp = `zip=${coords},us`
    } else {
      resolve({ok: false, error: 'Bad coordinates'}); 
      return; 
    }
    request.get({
      url: `https://api.openweathermap.org/data/2.5/weather?${inp}&units=${units?'metric':'imperial'}&appid=${API_KEY}`
    }, (err, resp) => {
      if (err) {
        resolve ({ok: false, error: err}); 
      } else {
        let data = JSON.parse(resp.body); 
        getDetailedWeather(data.coord).then(detailed => {
          if(!detailed.ok) {
            resolve ({ok: false, error: detailed.error}); 
            return; 
          }
          full = detailed.resp; 

          let diff = full.daily[1].temp.eve - full.daily[0].temp.eve; 
  
          resolve ({ok: true, resp: {
            coord: data.coord, 
            weather: {
              description: data.weather[0].description.slice(0, 1).toUpperCase() + data.weather[0].description.slice(1), 
              icon: 'fas fa-' + iconToFA(data.weather[0].icon), 
              wind_speed: full.current.wind_speed, 
              wind_deg: full.current.wind_deg, 
              high: full.daily[0].temp.max, 
              low: full.daily[0].temp.min, 
              uvi: full.daily[0].uvi,
              tomorrow: Math.round(diff*100)/100 // address floating point errors
            }, 
            main: data.main, 
            name: data.name, 
            id: data.id
          }}); 
        }) 
      }
    });
  })
}

module.exports = {
  appHook: (app, key) => {
    API_KEY = key; 
    app.get('/weather/current', async (req, res) => {
      // 
      let data = await getCurrentWeather(req.query.loc); 
      if (data.ok) {
        res.status(200).json(data.resp); 
      } else {
        res.status(400).json(data.error); 
      }
    }); 

    /* // Disabled until we have a use case for it - this endpoint could be very easily abused as it is currently
    app.get('/weather/full', async (req, res) => {
      let data = await getDetailedWeather({
        lat: parseFloat(req.query.lat), 
        lon: parseFloat(req.query.lon)
      }); 
      if (data.ok) {
        res.status(200).json(data.resp); 
      } else {
        res.status(400).json(data.error); 
      }
    }); */
  }
}