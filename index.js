// Global directories and settings
const port = process.env.PORT || 8098;
const path = require('path');
const dir_libraries = path.join(__dirname, 'libraries'); // notifier.js, svcore.js, svuelib.js *REQUIRED to run*
const dir_svp = path.join(__dirname, 'secure'); // non open-sourced libraries (analytics, /admin, mobile StudentVUE server emulator, local SVUE server) *NOT REQUIRED; server will run fine without these*
const credentials = require(path.join(__dirname, 'secure', 'credentials.json')); // see credentials.info.md for more information
const cryptoHelper = require(path.join(dir_libraries, 'cryptoHelper'));
cryptoHelper.init(credentials.AESKey); 

// Init variables and server

const fs = require('fs');
const colors = require('colors');
const schedule = require('node-schedule');
const moment = require('moment');
const request = require('request');
const cheerio = require('cheerio'); 
const minify = require('html-minifier').minify;
const app = require('express')();
const bcrypt = require('bcrypt'); 

// Used only for /export 
const JSZip = require('jszip'); 
const tmp = require('tmp'); 

const svcore = require(path.join(dir_libraries, 'svcore.js')); 
const fetchSVUE = svcore.fetchSVUE; 

const svexport = require(path.join(dir_libraries, 'svexport.js')); 

const session = require('express-session'); 
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

const http = require('http').Server(app);
const winston = require('winston');
const winston_estf = winston.format(info => { // Error stack tracer format
    if (info.meta && info.meta instanceof Error) {
        info.message = `${info.message} ${info.meta.stack}`;
    }
    return info;
});
const logger_color = function(s) {
  switch (s) {
    case 'info': 
      return 'info'.cyan; 
    case 'warn': 
      return 'warn'.yellow; 
    case 'error': 
      return 'error'.magenta
    case 'debug': 
      return 'debug'.green
    default: 
      return s
  }
}
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.printf(info => `${moment(new Date()).format('M/DD HH:mm:ss')}: ${logger_color(info.level)}: ${info.message}`)
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, 'logs', 'error.log'), 
      level: 'error',
      format: winston.format.combine(winston.format.timestamp(), winston.format.splat(), winston_estf(), winston.format.simple())
    }),
    new winston.transports.File({ 
      filename: path.join(__dirname, 'logs', 'combined.log'),
      format: winston.format.printf(info => `${moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}: ${info.level}: ${info.message}`)
    })
  ]
});

// Admin backend (not fully open source)

let localAdminCreds = false; 
if (fs.existsSync(path.join(dir_svp, 'svue.admin.json'))) {
  localAdminCreds = require(path.join(dir_svp, 'svue.admin.json'));
} else {
  logger.info('svue.admin.json could not be found, disabling the /admin/signin endpoint')
}

// Database and session initialization

const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;
const MongoURL = credentials.database;
const dbName = 'svueplus';
const dbClient = new MongoClient(MongoURL, {useNewUrlParser: true}); 
let mdb, userdb, logindb; 

dbClient.connect((e) => {
  if(e){logger.error('Failed to connect to local MongoDB server (localhost:27017)', e); require('process').exit()}
  logger.info('Connected to local MongoDB server (localhost:27017).')
  mdb = dbClient.db(dbName);
  userdb = mdb.collection('users'); 
  logindb = mdb.collection('loginHistory'); 
  setupDB();
})

function setupDB(){
  mdb.collection('pendingVerifications')
  .createIndex({
      'createdAt': 1
  }, {
      expireAfterSeconds: 7200 // 2 hours
  }, function(indexErr) {
      if (indexErr) {
        logger.error('init: failed to create index', indexErr);
      }
  });
  if(analytics){
    analytics.init(mdb, logger); 
    analytics.appHook(app); // /admin/* routing for analytics
  } 
  if (credentials.mailemail && credentials.mailpass) {
    notifierCore.init({
      user: credentials.mailemail, 
      pass: credentials.mailpass 
    }, userdb, logger); 
  } else {
    logger.warn('Notifier: Email credentials not set up, notifier will not be active.')
  }

  webauthn.mongoHook(mdb);
}

let sess_MongoStore = require('connect-mongo')(session); 
let sess = {
  secret: credentials.sessionkey,
  store: new sess_MongoStore({
    url: credentials.database, 
    stringify: false
  }),
  saveUninitialized: false, 
  resave: false,
  cookie: {}
}
 
if (app.get('env') === 'production' || fs.existsSync(path.join(__dirname, 'production.cfg'))) {
  logger.info('Production environment detected.')
  app.set('trust proxy', 1) // trust first proxy
  // sess.cookie.secure = true // serve secure cookies (currently not working)
}
 
app.use(session(sess));

const rateLimit = require('express-rate-limit'); 
const rl_MongoStore = require('rate-limit-mongo'); 
let limiter = new rateLimit({
  store: new rl_MongoStore({
    uri: 'mongodb://localhost:27017/svueplus', 
    expireTimeMs: 36 * 1000
  }), 
  max: 8, // 8 requests per 16 seconds max
  windowMs: 16 * 1000,
  statusCode: 200, // Prevent Zepto from freaking out
  message: {type: 'error', error: 39, msg: 'Too many login attempts. Try again in a minute.'}
}); 

let gbLimiter = new rateLimit({
  store: new rl_MongoStore({
    uri: 'mongodb://localhost:27017/svueplus', 
    expireTimeMs: 36 * 1000
  }), 
  max: 12, 
  windowMs: 12 * 1000,
  statusCode: 429, 
  message: {type: 'error', error: 39, msg: 'Too many requests. Try again in a minute.'}
}); 

// Notification system setup
const rlib = require(path.join(dir_libraries, 'rlib.js')); 

// End of init
// Begin: Statistics / Analytics module

let analytics = false; 
fs.access(path.join(dir_svp, 'analytics.js'), fs.F_OK, (e) => {
  if(!e){
    analytics = require(path.join(dir_svp, 'analytics.js')); 
    logger.info('Loaded secure/analytics.js'); 
  } else{
    logger.warn('Module secure/analytics.js not found. No reports will be created.')
  }
})

// Weather Module
require(path.join(dir_libraries, 'weather.js')).appHook(app, credentials.weather); 
const webauthn = require(path.join(dir_libraries, 'webauthn.js')); 
webauthn.appHook(app); 

// End: Statistics / Analytics module
// Begin: Helper functions (svue libraries, etc.)

const svueLib = require(path.join(dir_libraries, 'svuelib.js')); 

const dbf = { // Database Functions
  createUser: (sessionAuth) => {
    let usrn = sessionAuth.creds[0]; 
    let pswd = cryptoHelper.decrypt(sessionAuth.creds[1]); 
    return new Promise((resolve, reject) => {
      fetchSVUE('Gradebook', sessionAuth.domain, usrn, pswd, '&lt;Parms&gt;&lt;ChildIntID&gt;0&lt;/ChildIntID&gt;&lt;/Parms&gt;').catch(err => {
        logger.error('dbf.createUser: failed to create user (requestSVUE failed)', err)
        resolve({type: 'error', error: 'Internal server error'})
      }).then(r => {
        if(typeof r.Gradebook !== 'undefined'){ // All good
          let assignments = svueLib.parseAssignments(r, true); 
          userdb.insertOne({
            user: usrn, 
            domain: sessionAuth.domain, 
            created: new Date(), 
            profile: {
              name: sessionAuth.name, 
              fullName: sessionAuth.fullName,
              grade: sessionAuth.grade, 
              school: sessionAuth.school
            },
            notifier: {
              enabled: false, 
              whitelisted: sessionAuth.whitelisted
            },
            version: 1,
            items: assignments
          }, (err, res) => {
            if(err){
              logger.error('dbf.createUser: failed to create user', err)
              resolve({type: 'error', error: 'Internal server error'})}
            else{
              resolve({type: 'success', id: res.insertedId})}
          });
        }
        else if(typeof r.RT_ERROR !== 'undefined'){
          resolve({type: 'error', error: 42, msg: r.RT_ERROR.$.ERROR_MESSAGE})
        }
        else{
          console.warn(`Gradebook data is missing for user ${req.session.auth.fullName} (${req.session.auth.user}).`)
          resolve({type: 'error', error: 43, msg: 'Unable to fetch Gradebook. Did you change your password?'})
        }
      });
    })
  }, 
  update: async (input, sessionAuth) => {
    userdb.findOne(input).then(r => {
      if (!r) {
        logger.warn('Bad dbf.update request: ' + JSON.stringify(input)); 
      }
      else if(!r.version){
        logger.info('db: updated user '+input.user+' to v1');
        userdb.updateOne(input, {
          '$set': {
            profile: {
              name: sessionAuth.name, 
              fullName: sessionAuth.fullName,
              grade: sessionAuth.grade, 
              school: sessionAuth.school
            }, 
            'notifier.enabled': (r.notifier?(r.notifier.enabled):false),
            version: 1
          }
        })
      }
    });
  }, 
  query: async (input) => {
    let res = await userdb.findOne(input); 
    if(!res){return false}
      return res
  }, 
  addItems: async (session, course, items, isNew) => {
    let res = await userdb.updateOne({
      domain: session.domain, 
      user: session.user
    }, {
      $addToSet: {
        ['items.' + course + '.items']: {
          $each: items
        }
      }, 
      $pull: {
        ['notifier.sent']: {
          $in: items
        }
      }
    });
    if(isNew){
      userdb.updateOne({
        domain: session.domain, 
        user: session.user
      }, {
        $set: {
          ['items.'+course+'.timestamp']: new Date()
        }
      });
    }
    return res;
  }, 
  remItems: async (session, course, items) => {
    let res = await userdb.updateOne({
      domain: session.domain, 
      user: session.user
    }, {
      $pull: {
        ['items.' + course + '.items']: {
          $in: items
        }
      }, 
      $addToSet: { // Prevent notifier from sending out a notification for an item manually marked as "unseen"
        ['notifier.sent']: {
          $each: items
        }
      }
    });
    return res;
  }, 
  logLogin: (user, domain, req) => {
    return new Promise((res) => {
      let ip = req.ip; 
      let ua = req.header('User-Agent');
      userdb.updateOne({
        domain: domain, 
        user: user
      }, {
        '$set': {
          lastLogin: new Date()
        }
      }).then(r => {
        logindb.insertOne({
          time: new Date(), 
          user: user, 
          domain: domain, 
          ip: ip, 
          ua: ua
        }).then(r => {
          res(r); 
        })
      })
    }); 
  }
}

// End of db functions

if(credentials.zipLookup) {
  svcore.init(logger, credentials.zipLookup)
  logger.info('Set zip code lookup key to *-'+credentials.zipLookup.slice(-4))
} else{
  svcore.init(logger)
  logger.warn('Missing zip code lookup key. Users will not be able to find districts by zip code.')
}

function auditRequest(auth, req, method, success, data){
  if(analytics) {
    analytics.audit(auth, req, method, success, data)}
}

// End of other template / helper functions
// Begin: Scheduled functions

const notifierCore = require(path.join(dir_libraries, 'notifier.js')); 

let ntScheduling = {
  // 24 checks on weekdays, 18 on weekends, total of 156 checks/week
  weekdaySide: schedule.scheduleJob('15,45 12,15-17 * * 1-5', notifierCore.runNotifierCheck), // 2x/hr, 8 times total per day (weekdays)
  weekdayMain: schedule.scheduleJob('30 6,7-11,13-14,18-23,0,2 * * 1-5', notifierCore.runNotifierCheck), // 1x/hr, 16 times total (weekdays)
  weekend: schedule.scheduleJob('20 7-14,16-23,0,1 * * 0,6', notifierCore.runNotifierCheck), // 18 times / day total on weekends 
}

function computePercentiles() {
  let raw = {}; 
  let out = [];
  mdb.collection('accessHistory').find({
    ts: {
      $gte: moment().subtract('7', 'days').toDate()
    }, 
    method: 'gradebook'
  }).toArray((e, r) => {
    for(let i of r){
      if(!raw[i.domain+'\\'+i.user]){raw[i.domain+'\\'+i.user] = 0}
      raw[i.domain+'\\'+i.user] ++; 
    }
    for(let i in raw){
      out.push(raw[i]); 
    }
    out = out.sort((a, b) => {return a-b}); 
    landingStats.percentiles = out; 
  });
}

// End of scheduled functions
// Rest: Web server component

// Authentication middleware
app.use('/data/*', function (req, res, next) {
  if (!req.session.auth) {
    res.status(403).json({type: 'error', msg: 'Not authenticated'}); 
  }
  else {
    next(); 
  }
})

app.use('/data/secure/*', function (req, res, next) {
  if (!req.session.sudo) {
    res.status(200).json({type: 'auth', msg: 'Elevation Required'}); 
  }
  else if(req.session.sudo < Date.now()){
    res.status(200).json({type: 'auth', msg: 'Elevation Required'}); 
  }
  else {
    next(); 
  }
})

// Rate limiting middleware

app.get('/', function(req, res){
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/stats', function(req, res){
  if(!req.header('Referer')){
    res.status(403).json({error: 'Forbidden'}); 
    return;
  }
  res.status(200).json({
    ok: true
  }); 
}); 

app.get('/dashboard', function(req, res){
  if(req.session.auth || req.query.app === '1'){
    res.sendFile(path.join(__dirname, 'protected', 'dashboard.html'));
  }
  else{
    let reqPath = req.path.slice(1).split('/');
    if(reqPath.slice(-1)[0] === '/'){
      res.status(302).redirect(req.path.slice(0, -1))}
    res.status(302).redirect('../signin?from=dashboard')
  }
}); 

app.get('/signout', function(req, res){
  delete req.session.auth; 
  res.sendFile(path.join(__dirname, 'public', 'signout.html'));
}); 

app.get('/signout/admin', function(req, res){
  delete req.session.admAuth; 
  res.status(302).redirect('/?signout=true'); 
}); 

app.get('/signout/status', function(req, res){
  req.session.destroy((err) => {
    if(err){
      logger.error('Failed to destroy session (/signout/status)!', err);
      res.json({status: 'error', error: err.message})}
    else{
      setTimeout(() => {res.json({status: 'success'})}, 600);
    }
  })
})

app.post('/auth/setConsent', function(req, res){
  if(!req.session.auth){
    res.status(403).json({type: 'error', error: 'Not authorized'})
  }
  else{
    if(!req.session.auth.pending){
      res.status(403).json({type: 'error', error: 'No pending consent'})
    }
    else{
      req.session.auth.pending = false; // prevent duplicate requests, disable pending flag
      dbf.createUser(req.session.auth).then((r) => {
        if(r.type === 'success'){
          req.session.auth.id = r.id; 
          res.json({type: 'success'})}
        else{
          req.session.auth.pending = true; // allow user to retry
          res.json({type: 'error', error: r.error})}
      })
    }
  }
})

app.post('/signin', limiter, async function(req, res){ 
  // Signin module for SVUE
  let user, pass, domain, waOutput, type=0; // type 0 = standard (user/pass/domain), 1 = webauth (wa) 
  if (req.body.wa) {
    // Signin w/ WA
    // Return in format {type: (string)("success"|"error"), [error]: (number), [msg]: (string)}
    type = 1; 
    waOutput = await webauthn.validateWASignin(req); 
    if (waOutput.ok) {
      let account = await userdb.findOne({_id: new ObjectId(waOutput.uuid)}); 
      if (!account) {
        res.status(400).json({
          code: 30, 
          error: 'The account tied to this credential no longer exists.'
        })
        return false; 
      } 
      if (typeof waOutput.encPass === 'string') {
        user = account.user; 
        pass = cryptoHelper.decrypt(waOutput.encPass);
        domain = account.domain; 
      } 
      else {
        req.session.cookie.maxAge = 300000; 
        req.session.waTempAuth = {
          uuid: waOutput.uuid, 
          keyId: waOutput.keyId
        }
        res.status(400).json({code: 33, error: 'Password missing; please re-enter your password.'}); 
        return; 
      }
    } else {
      res.status(400).json(waOutput); 
      return false; 
    }
  }
  else {
    // Standard signin (username, password, and domain)
    if(typeof req.body.user !== 'string' || typeof req.body.pass !== 'string' || typeof req.body.domain !== 'string'){
      // Signin with username, password, and domain
      res.json({type: 'error', error: 30, msg: 'Malformed request / invalid data, try again.'}); 
      return; 
    }
    else if(!svcore.checkURL(req.body.domain)){
      res.json({type: 'error', error: 31, msg: 'The domain provided is invalid.'}); 
      return; 
    }
    // Set credentials
    user = req.body.user; 
    pass = req.body.pass;  
    domain = svcore.checkURL(req.body.domain); 
  }
  let svResponse = await fetchSVUE('ChildList', domain, user, pass).catch((err) => {
    if(err.code === 'ECONNRESET'){
      res.json({type: 'error', error: 48, msg:'Synergy Server Down', msgExt: 'Your school\'s Synergy (Gradebook) server is down.'}); 
    }
    else{
      logger.error('fetchSVUE request failed: ', err); 
      res.json({type: 'error', error: 49, msg: 'Req. Failed ('+err.code+')', msgExt: 'Your school\'s Synergy (Gradebook) server could not be reached ('+err.code+').'}); 
    }
    return false; 
  });
  if (!svResponse) {
    return; // request already failed, and a response has already been sent in the catch loop
  }
  else if(svResponse.RT_ERROR){
    // request succeeded, but the Synergy server gave a bad response
    if(svResponse.RT_ERROR.$.ERROR_MESSAGE === 'Invalid user id or password'){
      res.json({type: 'error', error: 32, msg: 'The user name provided is invalid.'})
    }
    else if(svResponse.RT_ERROR.$.ERROR_MESSAGE === 'The user name or password is incorrect.\r\n'){
      if (type === 1) {
        req.session.cookie.maxAge = 300000; 
        req.session.waTempAuth = {
          uuid: waOutput.uuid, 
          keyId: waOutput.keyId, 
          expectedUser: user
        }
        res.json({type: 'error', error: 'Please re-enter your password to continue.'})
      } else {
        res.json({type: 'error', error: 33, msg: 'The password provided is incorrect.'})
      }
    }
    else{
      logger.error('Unable to parse district StudentVUE login message.', svResponse.RT_ERROR);
      console.log(svResponse.RT_ERROR);
      res.json({type: 'error', error: 40, msg: 'An unknown error has occured on the district endpoint.'})
    }
    return;
  }
  
  // credentials are good
  try {
    let child = svResponse.ChildList.Child[0]; 
    let firstName = child.$.ChildFirstName; 
    let fullName = child.ChildName[0];
    let school = child.OrganizationName[0]; 
    let grade = child.Grade[0];
    // let photo = child.photo[0];
    if (req.session.waTempAuth && req.session.waTempAuth.expectedUser === user) {
      // update the password tied to this public key credential
      webauthn.updateWACreds(req.session.waTempAuth.keyId, pass); 
    }
    req.session.regenerate((err) => {
      if(err){
        logger.error('Unable to regenerate session (/signin)', err)
        res.json({type: 'error', error: 'Unable to create session due to an internal server error.'})}
      else{
        dbf.query({user, domain}).then((r) => {
          if(req.body.rem && req.body.rem !== 'false'){
            if (type === 0) {
              req.session.cookie.maxAge = 604800000; // 7 days
              req.session.preserve = true;
            } 
            else if (type === 1) {
              req.session.wa = Math.floor(Date.now()/1000); 
              req.session.waKey = waOutput.keyId; 
              req.session.cookie.maxAge = 1209600000; // 14 days, but require PK authentication after 15 minutes
              req.session.preserve = true;
            }
          } 
          else{
            req.session.cookie.maxAge = 3600000
          } // 1 hour
          req.session.loginIP = req.ip; 
          req.session.lastAccessed = new Date(); 
          req.session.ua = req.header('User-Agent');
          req.session.ip = req.ip; 
          req.session.auth = {
            id: r._id, 
            user: user, 
            domain: domain,
            creds: [user, cryptoHelper.encrypt(pass)],
            name: firstName, 
            fullName: fullName, 
            grade: grade,
            school: school
          }; 
          if (child.ConcurrentSchools) {
            // user is part of one or more concurrent schools
            req.session.auth.concurrent = svcore.formatConcurrent(child.ConcurrentSchools); 
          }
          if(!!r){
            res.json({type: 'success', data: {
              firstName: firstName, 
              fullName: fullName, 
              school: school, 
              expires: Date.now() + req.session.cookie.maxAge
            }}); 

            dbf.update({user, domain}, req.session.auth);
            dbf.logLogin(user, domain, req);
          }
          else{
            req.session.auth.pending = true; 
            res.json({type: 'success', data: {
              firstName: firstName, 
              fullName: fullName, 
              school: school, 
              expires: Date.now() + req.session.cookie.maxAge, 
              new: true
            }})
          }
        });
      }
    })
  }
  catch (err) {
    logger.error('Unable to parse ChildList results -- the API may have changed.', err)
    res.json({type: 'error', error: 41, msg: 'An internal server error occured.'})
  }
})



app.post('/admin/signin', limiter, function(req, res){ // Admin signin
  if (!localAdminCreds) {
    res.json({type: 'error', error: 'This endpoint is currently disabled.'})
  }
  else if(typeof req.body.user !== 'string' || typeof req.body.pass !== 'string'){
    res.json({type: 'error', error: 30, msg: 'Malformed request / invalid data, try again.'}); 
    return; 
  }
  else if(!localAdminCreds[req.body.user]){
    setTimeout(() => {
      res.json({type: 'error', error: 'Invalid credentials.'}); 
    }, Math.round(Math.random() * 500 + 500)); 
    return; 
  }
  bcrypt.compare(req.body.pass, localAdminCreds[req.body.user]).then(valid => {
    if(!valid){
      res.json({type: 'error', error: 'Invalid credentials.'}); 
      return; 
    }
    req.session.regenerate((err) => {
      if(err){
        logger.error('Unable to regenerate session (/signin)', err)
        res.json({type: 'error', error: 'Unable to create session due to an internal server error.'})}
      else{
        req.session.cookie.maxAge = 7200000; 
        req.session.admAuth = true; 
        res.json({type: 'success', data: {
          expires: Date.now() + req.session.cookie.maxAge
        }}); 
      }
    })
  }); 
})

app.post('/signin/sudo', gbLimiter, function(req, res){
  if(!req.session.auth){
    res.status(403).json({type: 'error', error: 39, msg: 'Not Authenticated'})
  }
  else{
    setTimeout(() => {
      if(req.body.pass === cryptoHelper.decrypt(req.session.auth.creds[1])){
        req.session.sudo = moment().add(30, 'minutes').toDate(); 
        res.json({type: 'success'}); 
      }
      else{
        res.json({type: 'error', error: 33, msg: 'The password provided is incorrect.'})
      }
    }, 500 + Math.round(Math.random() * 750)); 
  }
})

app.post('/signin/lookup', limiter, function(req, res){
  let inp = req.body.input; 
  if(typeof inp !== 'string'){
    res.json({type: 'error', error: 30, msg: 'Malformed Request'});
    return; 
  } else if (inp.length > 64 || inp.length < 3) {
    res.json({type: 'error', error: 37, msg: 'Invalid URL / Zip Code'});
    return; 
  }

  if(inp.length <= 5){
    svcore.getMatchingDistrictList(inp).then(r=>{
      if(r.type === 'error'){
        res.json({type: 'error', error: 37, msg: r.error});
      } else{
        res.json({type: 'success', list: r.list})
      }
    })
  } else{
    let url = svcore.checkURL(inp); 
    if(!url){
      res.json({type: 'error', error: 37, msg: 'Invalid District URL'});
      return; 
    }
    svcore.validateDistrictURL(url).then(r => {
      if(r){
        res.json({type: 'success', url: url, name: r});
      } else{
        res.json({type: 'error', error: 37, msg: 'Invalid District URL'});
      }
    })
  }
})

app.post('/signin/demo/auth', limiter, function(req, res){ // Signin module for SVUE
  if (!credentials.demouser) {
    res.json({type: 'error', code: 50, error: 'The demo account is not set up.'}); 
    return; 
  }
  let firstName = 'Student'; 
  let fullName = 'Demo Student';
  let school = 'Fossil Ridge HS'; 
  req.session.regenerate((err) => {
    if(err){
      logger.error('Unable to regenerate session (/signin)', err)
      res.json({type: 'error', error: 'Unable to create session due to an internal server error.'})}
    else{
      req.session.cookie.maxAge = 3600000; // demo account is signed out after an hour
      req.session.auth = {
        demo: true, 
        user: 'demo', 
        domain: 'svue.itsryan.org',
        creds: ['demo', cryptoHelper.encrypt(credentials.demouser)],
        name: 'Student', 
        fullName: 'Demo Student', 
        grade: '10',
        school: 'Fossil Ridge HS'
      }; 
      res.json({type: 'success', data: {
        firstName: firstName, 
        fullName: fullName, 
        school: school, 
        expires: Date.now() + req.session.cookie.maxAge
      }}); 
    }
  })
})

app.get('/admin/notifier', function(req, res){
  if(!req.session.admAuth){
    res.status(403).json({type: 'error', error: 39, msg: 'Forbidden'}); 
    return; 
  }
  res.json({
    type: 'success', 
    notifier: notifierCore.getStatus()
  })
}); 

app.post('/admin/notifier', function(req, res){
  if(!req.session.admAuth){
    res.status(403).json({type: 'error', error: 39, msg: 'Forbidden'}); 
    return; 
  }
  let mode = req.body.enabled; // 0 = pull, 1 = push
  mode = parseInt(mode); 
  if(mode !== 0 && mode !== 1){ // Missing component
    res.status(400).json({type: 'error', error: 30, msg: 'Bad Request (0)'}); return}
  else if(mode){
    notifierCore.setStatus(true); 
    res.status(200).json({type: 'success'}); 
  }
  else{
    notifierCore.setStatus(false); 
    res.status(200).json({type: 'success'}); 
  }
})

app.post('/data/updateHistory', function(req, res){
  if(req.session.auth.demo){ // don't modify demo account
    res.json({type: 'success'});
  }
  else{
    let course = req.body.course; // Course name
    let data = req.body.data; // Array of item IDs
    let mode = req.body.mode; // 0 = pull, 1 = push
    mode = parseInt(mode); 
    if(typeof data !== 'string' || typeof course !== 'string' || (mode !== 0 && mode !== 1)){ // Missing component
      res.status(400).json({type: 'error', error: 30, msg: 'Bad Request (0)'}); return}
    if(data.indexOf(',') !== -1) {data = data.split(',')}
    else{data = [data]}
    if(data.length > 72 || JSON.stringify(data).length > 512){ // Data too big / long
      res.status(400).json({type: 'error', error: 30, msg: 'Bad Request (1)'})
      return}
    dbf.query({user: req.session.auth.user, domain: req.session.auth.domain}).then((r) => {
      if(!r){
        res.status(500).json({type: 'error', error: 19, msg: 'Your OVUE account is missing. Contact us for assistance.'}); return}
      if(r.items[course]){
        dbf[mode?'addItems':'remItems'](req.session.auth, course, data).then((r, e) => {
          res.json({type: 'success', response: r, error: e});
        });
      }
      else if(req.session.courseList && req.session.courseList.indexOf(course) !== -1){ // course currently exists in the user's gradebook
        if(mode){
          dbf['addItems'](req.session.auth, course, data, true).then((r, e) => {
            res.json({type: 'success', response: r, error: e});
          });
        }
        else{
          res.status(400).json({type: 'error', error: 30, msg: 'Bad Request - Empty Course', desc: 'Contact devs for assistance.'})
        }
      }
      else{
        res.status(400).json({type: 'error', error: 30, msg: 'Bad Request - Course Not Available', desc: 'Signing out and back in usually resolves this.'})
      }
    });
  }
})

app.get('/data/gradebook', gbLimiter, function(req, res){
  req.session.ip = req.ip;  
  req.session.lastAccessed = new Date(); 
  if (req.query.reportingPeriod && req.query.reportingPeriod.match(/[^A-Za-z0-9\-]/) || req.query.school && req.query.school.match(/[^A-Za-z0-9\-]/)) {
    // exclude bad characters
    res.status(400).json({type: 'error', error: 28, msg: 'Bad Request'})
    return; 
  }
  fetchSVUE('Gradebook', req.session.auth.domain, req.session.auth.creds[0], cryptoHelper.decrypt(req.session.auth.creds[1]), `&lt;Parms&gt;&lt;ChildIntID&gt;0&lt;/ChildIntID&gt;${req.query.reportingPeriod?`&lt;ReportPeriod&gt;${req.query.reportingPeriod}&lt;/ReportPeriod&gt;`:''}${req.query.school?`&lt;ConcurrentSchOrgYearGU&gt;${req.query.school}&lt;/ConcurrentSchOrgYearGU&gt;`:''}&lt;/Parms&gt;`).then(r => {
    if(typeof r.Gradebook !== 'undefined'){ // All good
      auditRequest(req.session.auth, req, 'gradebook', true, req.query.reportingPeriod?{reportingPeriod: req.query.reportingPeriod}:!1);
      dbf.query({user: req.session.auth.user, domain: req.session.auth.domain}).then((acc) => {
        if(!acc){res.status(500).json({type: 'error', error: 50, msg: 'Your OVUE account is missing (19).', desc: 'Signing out and signing back in may fix this problem. If that doesn\'t fix the problem, contact us for assistance.'}); return}
        userdb.findOneAndUpdate({
          domain: req.session.auth.domain, 
          user: req.session.auth.user
        }, {
          '$set': {
            lastAccessed: new Date()
          }
        }).then (r2 => {
          if (!req.session.courseList || !Array.isArray(req.session.courseList)) {
            req.session.courseList = [];
          } 
          let courseNames = Object.keys(svueLib.parseAssignments(r, true));
          for (let i of courseNames) {
            if (req.session.courseList.indexOf(i) === -1) {
              req.session.courseList.push(i); 
            }
          } 
          if(req.session.preserve) req.session.cookie.maxAge = 604800000; 
          res.json({
            type: 'success',
            sessionExpire: new Date(req.session.cookie.expires).getTime(), 
            user: {name: req.session.auth.name, fullName: req.session.auth.fullName, school: req.session.auth.school, concurrent: req.session.auth.concurrent}, 
            courses: r.Gradebook.Courses[0].Course,
            rp: (r.Gradebook.ReportingPeriod&&r.Gradebook.ReportingPeriods)?svcore.formatRP(r.Gradebook.ReportingPeriod,r.Gradebook.ReportingPeriods):null, 
            itemHist: acc.items, 
            svUUID: acc._id // unique user identifier for ga's user-id
            // lastAccessed: r2.lastAccessed // Doesn't appear to currently work, not implemented
          });
        })
      })
    }
    else if(typeof r.RT_ERROR !== 'undefined'){
      auditRequest(req.session.auth, req, 'gradebook', false, r.RT_ERROR.$.ERROR_MESSAGE);
      res.status(502).json({type: 'error', error: 42, msg: r.RT_ERROR.$.ERROR_MESSAGE})
    }
    else{
      console.warn(`Gradebook data is missing for user ${req.session.auth.fullName} (${req.session.auth.user}).`)
      auditRequest(req.session.auth, req, 'gradebook', false); 
      res.status(502).json({type: 'error', error: 43, msg: 'Unable to fetch Gradebook. Did you change your password?'})
    }
  }, err => {
    if(err.code === 'ECONNRESET'){
      auditRequest(req.session.auth, req, 'gradebook', false, 'ECONNRESET'); 
      res.json({type: 'error', error: 48, msg: 'Your school\'s Synergy (Gradebook) server is down.'}); 
    }
    else{
      auditRequest(req.session.auth, req, 'gradebook', false, err.code); 
      res.json({type: 'error', error: 49, msg: 'Your school\'s Synergy (Gradebook) server could not be reached ('+err.code+').'}); 
    }
  });
})

app.get('/data/secure/export/info', function(req, res) {
  if(req.session.auth.user && req.session.auth.concurrent) {
    res.json({
      type: 'success', 
      user: req.session.auth.user,
      domain: req.session.auth.domain,  
      school: req.session.auth.school, 
      name: req.session.auth.fullName, 
      concurrent: req.session.auth.concurrent
    })
  } else if(req.session.auth.user) {
    res.json({
      type: 'success', 
      user: req.session.auth.user, 
      domain: req.session.auth.domain, 
      school: req.session.auth.school, 
      name: req.session.auth.fullName
    })
  } else {
    res.json({
      type: 'error', 
      error: 'Missing user data - try signing in again'
    })
  }
})

app.post('/data/secure/export/createSession', async (req, res) => {
  if(['xlsx', 'xml', 'json'].indexOf(req.body.format) === -1) {
    res.status(400).json({
      type: 'error', 
      msg: 'Bad request - invalid format'
    }); 
    return; 
  }

  let gb = await fetchSVUE('Gradebook', req.session.auth.domain, req.session.auth.creds[0], cryptoHelper.decrypt(req.session.auth.creds[1]), `&lt;Parms&gt;&lt;ChildIntID&gt;0&lt;/ChildIntID&gt;${req.body.school=='h'?'':`&lt;ConcurrentSchOrgYearGU&gt;${req.body.school}&lt;/ConcurrentSchOrgYearGU&gt;`}&lt;/Parms&gt;`).catch(err => {
    auditRequest(req.session.auth, req, 'export', false, err.code); 
    res.status(502).json({type: 'error', error: 49, msg: 'Your school\'s Synergy (Gradebook) server could not be reached ('+err.code+').'}); 
    return; 
  }); 
  if (gb.RT_ERROR) {
    auditRequest(req.session.auth, req, 'export', false, gb.RT_ERROR.$.ERROR_MESSAGE);
    res.status(502).json({type: 'error', error: 42, msg: gb.RT_ERROR.$.ERROR_MESSAGE}); 
    return; 
  }
  auditRequest(req.session.auth, req, 'export', true);
  req.session.exportSession = {
    exp: req.session.sudo, 
    school: req.body.school, 
    format: req.body.format, 
    rp: gb.Gradebook.ReportingPeriods?svcore.formatRP_partial(gb.Gradebook.ReportingPeriods):null
  }
  res.json({
    type: 'success', 
    rp: req.session.exportSession.rp
  })
  return; 
})

app.post('/data/secure/export/complete', async (req, res) => {
  if (!req.session.exportSession || req.session.exportSession.exp < Date.now()) {
    res.status(403).json({
      type: 'error', 
      msg: 'Export session expired - create a new one by reloading the page'
    }); 
    return; 
  } else if (!req.body.rp) {
    res.status(400).json({
      type: 'error', 
      msg: 'Bad request'
    }); 
    return; 
  } else if (req.session.exportSession.complete) {
    res.status(403).json({
      type: 'error', 
      msg: 'User\'s export request has already been fulfilled - create a new one by reloading the page'
    }); 
    return; 
  }
  let rp = req.body.rp.split('/'); 
  let rpout = []; 
  for (let i of rp) {
    let selRP = req.session.exportSession.rp.filter(r => r.index === i); 
    if (selRP.length === 0) {
      // one or more report periods specified don't exist
      res.status(400).json({
        type: 'error', 
        msg: 'Bad request - invalid reporting period'
      }); 
      return; 
    } else {
      rpout.push(selRP[0]); 
    }
  }
  // validated contents, create export and/or archive of exports
  let cfg = req.session.exportSession; 
  let zip = new JSZip();
  for (let i of rpout) {
    let gb = await fetchSVUE('Gradebook', req.session.auth.domain, req.session.auth.creds[0], cryptoHelper.decrypt(req.session.auth.creds[1]), `&lt;Parms&gt;&lt;ChildIntID&gt;0&lt;/ChildIntID&gt;&lt;ReportPeriod&gt;${i.index}&lt;/ReportPeriod&gt;${cfg.school=='h'?'':`&lt;ConcurrentSchOrgYearGU&gt;${cfg.school}&lt;/ConcurrentSchOrgYearGU&gt;`}&lt;/Parms&gt;`, (cfg.format === 'xml')).catch(err => {
      res.status(502).json({type: 'error', error: 49, msg: 'Your school\'s Synergy (Gradebook) server could not be reached ('+err.code+').'}); 
      return; 
    }); 
    if (cfg.format !=='xml' && gb.RT_ERROR) {
      res.status(502).json({type: 'error', error: 42, msg: gb.RT_ERROR.$.ERROR_MESSAGE}); 
      return; 
    }

    switch (cfg.format) {
      case 'xml': 
        zip.file(`Gradebook-${i.index} (${i.name}).xml`, gb); 
        continue; 
      case 'json': 
        gb.metadata = {
          exportedBy: 'svue.itsryan.org', 
          timestamp: Date.now(), 
          user: req.session.auth.creds[0], 
          domain: req.session.auth.domain
        }
        zip.file(`Gradebook-${i.index} (${i.name}).json`, JSON.stringify(svexport.rawJSON(gb.Gradebook.Courses))); 
        continue; 
      case 'xlsx':
        zip.file(`Gradebook-${i.index} (${i.name}).xlsx`, svexport.createXLSX(gb.Gradebook.Courses, {
          firstName: req.session.auth.name,
          name: req.session.auth.fullName, 
          server: req.session.auth.domain,
          user: req.session.auth.user
        })); 
        continue; 
    }
  }
  tmp.file((e, path, fd, cleanup) => {
    if (e) {
      logger.error('/export - unable to create temporary file:', e); 
      res.status(500).json({type: 'error', msg: 'Internal server error'}); 
    }
    zip.generateAsync({type: 'nodebuffer'}).then(content => {
      fs.write(fd, content, (e) => {
        if (e) {
          logger.error('/export - unable to write to temporary file:', e); 
          res.status(500).json({type: 'error', msg: 'Internal server error'}); 
        }
        cfg.file = path; 
        cfg.fd = fd; 
        if (cfg.exp < Date.now() + 900000) { // guarantee user has at least 15m to download
          cfg.exp = Date.now() + 900000; 
          req.session.sudo = cfg.exp; 
        }
        setTimeout(cleanup, (cfg.exp - Date.now())); 
        req.session.exportSession.complete = true; 
        res.status(200).json({type: 'success', expires: moment(cfg.exp).format('MM/DD h:mm:ss a')}); 
      })
    })
  }); 
})

app.get('/data/secure/export/download', gbLimiter, (req, res) => {
  if (req.session.exportSession && req.session.exportSession.file && req.session.exportSession.exp > Date.now()) {
    res.setHeader( 'Content-Disposition', 'attachment; filename=Gradebook.zip');
    res.setHeader( 'Content-Type', 'application/zip');
    fs.readFile(req.session.exportSession.file, (e, content) => {
      if (e) {
        res.status(500).json({type: 'error', msg: 'Internal server error'}); 
        return; 
      }
      res.end(content); 
    })
  } else {
    res.status(403).json({type: 'error', msg: 'No download available - file may have expired'})
  }
})

app.get('/data/secure/courseHistory', gbLimiter, function(req, res){
  if(!req.session.auth){
    res.status(403).json({type: 'error', error: 39, msg: 'Not Authenticated'})
  }
  else{
    if(!req.session.sudo){ 
      res.status(200).json({type: 'auth', msg: 'Elevation Required'}); 
    }
    else if(req.session.sudo < Date.now()){
      res.status(200).json({type: 'auth', msg: 'Elevation Required'}); 
    }
    else{
      let jar = request.jar(), domain = req.session.auth.domain; 
      let loginURL = 'https://%d/PXP2_Login_Student.aspx?regenerateSessionId=True'.replace('%d', domain); 
      let chURL = 'https://%d/PXP_CourseHistory.aspx?AGU=0'.replace('%d', domain); 
      request.get({
        url: loginURL, 
        jar: jar
      }, (err, resp) => {
        if(err) {
          res.status(400).json({type: 'error', error: 48, msg: 'Unable to connect to Synergy (ch:1/3): '+err}); 
          return; 
        }
        let raw = cheerio.load(resp.body); 
        request.post({url: loginURL, jar: jar, form: {
          '__VIEWSTATE': raw('form input#__VIEWSTATE').val(), 
          '__VIEWSTATEGENERATOR': raw('form input#__VIEWSTATEGENERATOR').val(), 
          '__EVENTVALIDATION': raw('form input#__EVENTVALIDATION').val(), 
          'ctl00$MainContent$username': req.session.auth.creds[0], 
          'ctl00$MainContent$password': cryptoHelper.decrypt(req.session.auth.creds[1])
        }}, (err, resp) => {
          if(err) {
            auditRequest(req.session.auth, req, 'courseHistory', false, err); 
            res.status(400).json({type: 'error', error: 48, msg: 'Unable to connect to Synergy (ch:2/3): '+err}); 
            return; 
          }
          if(resp.statusCode === 302){
            request.get({url: chURL, jar: jar}, (err, resp) => {
              if(err) {
                auditRequest(req.session.auth, req, 'courseHistory', false, err); 
                res.status(400).json({type: 'error', error: 48, msg: 'Unable to connect to Synergy (ch:3/3): '+err}); 
                return; 
              }
              let $ = cheerio.load(resp.body); // initial, raw HTML
              $('#maincontent table tbody tr td.whiteBGMain table').first().remove(); // remove headers
              $('*').removeAttr('valign').removeAttr('width'); 
              $('th').removeAttr('scope').removeAttr('align');
              $('th').find('strong').each((i, item) => {
                item.children[0].data = ' ' + item.children[0].data; 
              });
              $('th[colspan="4"]').each((i, ele) => {
                $(ele).html($(ele).text().slice(1).replace('   ', ' - ').replace('Year ', 'Year:')); 
              });
              $('table').removeAttr('cellspacing').removeAttr('cellpadding').removeAttr('border').removeAttr('class').addClass('striped');
              $('.panel').removeAttr('style').removeAttr('class');
              $('.panel-heading').removeAttr('class');
              $('.panel-body').removeAttr('style').removeAttr('class');
              $('.row_subhdr').removeClass('row_subhdr').addClass('tr-hdr');
              $('h2').each((i, item) => {item.tagName = 'h3'});
              let ch = $('#maincontent table tbody tr td.whiteBGMain').html(); 
              auditRequest(req.session.auth, req, 'courseHistory', true); 
              try {
                let dataOut = minify(ch, {collapseWhitespace: true, quoteCharacter: `'`}); 
                res.status(200).json({type: 'success', data: dataOut}); 
              } catch (e) {
                logger.error('/data/secure/courseHistory - ' + e); 
                res.status(500).json({type: 'error', msg: 'Internal server error'})
              }
            })
          } else {
            auditRequest(req.session.auth, req, 'courseHistory', false, 'InvalidCredentials');
            res.status(400).json({type: 'error', error: 30, msg: 'Invalid credentials provided (ch:2/3)'}); 
            return; 
          }
        })
      })
    }
  }
}); 

app.get('/data/:type', gbLimiter, function(req, res){
  let keys = { // 0 is the request parameter, 1 is the response tag used by Synergy
    'attendance': ['Attendance', 'Attendance'], 
    'messages': ['GetPXPMessages', 'PXPMessagesData']
  }; 
  let reqCode = keys[req.params.type]; 
  if(!reqCode){
    res.status(404).json({type: 'error', error: 404, msg: 'Invalid Parameter // Not Found'})
    return; 
  }

  fetchSVUE(reqCode[0], req.session.auth.domain, req.session.auth.creds[0], cryptoHelper.decrypt(req.session.auth.creds[1]), '&lt;Parms&gt;&lt;ChildIntID&gt;0&lt;/ChildIntID&gt;&lt;/Parms&gt;').then(r => {
    if(typeof r[reqCode[1]] !== 'undefined'){ // All good
      auditRequest(req.session.auth, req, req.params.type, true); 
      dbf.query({user: req.session.auth.user, domain: req.session.auth.domain}).then((acc) => {
        if(!acc){res.status(500).json({type: 'error', error: 50, msg: 'Your OVUE account is missing (19).', desc: 'Signing out and signing back in may fix this problem. If that doesn\'t fix the problem, contact us for assistance.'}); return}
        res.json({
          type: 'success', 
          user: {name: req.session.auth.name, fullName: req.session.auth.fullName, school: req.session.auth.school}, 
          data: r
        });
      })
    }
    else if(typeof r.RT_ERROR !== 'undefined'){
      auditRequest(req.session.auth, req, req.params.type, false, r.RT_ERROR.$.ERROR_MESSAGE); 
      res.status(502).json({type: 'error', error: 42, msg: r.RT_ERROR.$.ERROR_MESSAGE})
    }
    else{
      auditRequest(req.session.auth, req, req.params.type, false); 
      console.warn(`Gradebook data is missing for user ${req.session.auth.fullName} (${req.session.auth.user}).`)
      res.status(502).json({type: 'error', error: 43, msg: 'Unable to fetch Gradebook. Did you change your password?'})
    }
  }, r => {
    res.json({type: 'error', error: 50, msg: 'Internal Server Error (50)'})
  });
})

async function genAccountData(req){
  let user = await userdb.findOne({user: req.session.auth.user, domain: req.session.auth.domain}); 
  let isDemo = req.session.auth.demo; 
  if(!user){return {type: 'error', error: 19, msg: 'Account Not Found'}}
  let accessCount = await mdb.collection('accessHistory').countDocuments({
    'user': req.session.auth.user, 
    'domain': req.session.auth.domain, 
    'method': 'gradebook',
    'ts': {
      $gte: moment().subtract(1, 'week').toDate()
    }
  }); 
  let totalAccessCount = await mdb.collection('accessHistory').countDocuments({
    'user': req.session.auth.user, 
    'domain': req.session.auth.domain
  }); 
  let accessHistory = await mdb.collection('accessHistory').find({
    'user': req.session.auth.user, 
    'domain': req.session.auth.domain, 
    'ts': {
      $gte: moment().subtract(2, 'weeks').toDate()
    }
  }).project({
    'user': 0, 
    'domain': 0, 
    '_id': 0, 
    ...(isDemo && {ip: 0})
  }).toArray(); 
  let loginHistory = await mdb.collection('loginHistory').find({
    'user': req.session.auth.user, 
    'domain': req.session.auth.domain, 
    'time': {
      $gte: moment().subtract(1, 'months').toDate()
    }
  }).project({
    'user': 0, 
    'domain': 0, 
    '_id': 0, 
    ...(isDemo && {ip: 0})
  }).toArray(); 
  let activeSessions = await mdb.collection('sessions').find({
    'session.auth.user': req.session.auth.user, 
    'session.auth.domain': req.session.auth.domain
  }).project({
    'expires': 1, 
    'session.lastAccessed': 1, 
    'session.preserve': 1, 
    'session.loginIP': 1, 
    'session.ua': 1, 
    ...(!isDemo && {'session.ip': 1})
  }).toArray();
  let age = (Date.now() - user.created) / 86400000; // age, in days
  if(age < 1) {age = 1}
  else if(age > 7) {age = 7} // "age" used to calculate average gradebook checks per day
  let checksPerDay = (accessCount / age).toFixed(1);
  if(accessHistory.length > 40){accessHistory = accessHistory.slice(-50)}
  if(loginHistory.length > 20){loginHistory = loginHistory.slice(-20)}

  let waKeys = await mdb.collection('publicKeyTokens').find({
    'uuid': ObjectId(req.session.auth.id)
  }).project({
    _id: 0, 
    keyId: 1, 
    name: 1, 
    lastUsed: 1
  }).toArray(); 

  return {
    type: 'success', 
    userID: user.domain + '\\' + user.user,
    ...(isDemo && {demoUser: true}), 
    profile: user.profile, 
    created: user.created, 
    activeSessions, 
    accessHistory: accessHistory.reverse(), 
    loginHistory: loginHistory.reverse(), 
    waKeys, 
    stats: {
      checksPerDay, 
      // checksPerDayAvg: (landingStats.requestsWk_raw / landingStats.usersWk_raw / 7).toFixed(1), 
      totalRequests: totalAccessCount
    }
  }; 
}

app.get('/account/data', gbLimiter, function(req, res){
  if(!req.session.auth){
    res.status(403).json({type: 'error', error: 39, msg: 'Not Authenticated'})
  } 
  else{
    genAccountData(req).then(r => {
      if(r.type === 'success'){
        res.status(200).json(r); 
      } else{
        res.status(403).json(r); 
      }
    })
  }
}); 

app.get('/account/sessionState', function(req, res){
  if(req.session.auth){
    res.status(200).json({signedIn: true}); 
  } else{
    res.status(200).json({signedIn: false}); 
  }
})

app.post('/account/secure/signoutAll', limiter, function(req, res){
  if(!req.session.auth){
    res.status(403).json({type: 'error', error: 39, msg: 'Not Authenticated'})
  }
  else{
    if(!req.session.sudo){ 
      res.status(200).json({type: 'auth', msg: 'Elevation Required'}); 
    }
    else if(req.session.sudo < Date.now()){
      res.status(200).json({type: 'auth', msg: 'Elevation Required'}); 
    }
    else{
      mdb.collection('sessions').deleteMany({
        'session.auth.user': req.session.auth.user, 
        'session.auth.domain': req.session.auth.domain
      }).then(r => {
        res.status(200).json({type: 'success'}); 
      })
    }
  }
})

app.get('/notifier/status', function(req, res){
  if(!req.session.auth){
    res.status(403).json({type: 'error', error: 39, msg: 'Not Authenticated'})
  }
  else{
    dbf.query({user: req.session.auth.user, domain: req.session.auth.domain}).then(r => {
      if(!r){
        res.status(500).json({type: 'error', error: 19, msg: 'Your OVUE account is missing. Contact us for assistance.'}); return}
      if(!r.notifier.config){
        if(!r.notifier.whitelisted){
          res.json({type: 'success', whitelisted: false})
          return; 
        }
        let ntTemplate = {
          minImportance: 1, 
          showScore: 1,
          blunt: false
        }; 
        userdb.updateOne({user: req.session.auth.user, domain: req.session.auth.domain}, {
          $set: {
            'notifier.config': ntTemplate
          }
        }); 
        r.notifier.config = ntTemplate;
      }
      else if (!r.notifier.whitelisted){
        res.json({type: 'success', whitelisted: false}); 
        return; 
      }
      req.session.ntWhitelist = true; 
      res.json({type: 'success', whitelisted: true, status: r.notifier})
    })
  }
})

app.post('/notifier/updateCreds', function(req, res){
  if(!req.session.auth){
    res.status(403).json({type: 'error', error: 39, msg: 'Not Authenticated'})
  }
  else if(!req.session.ntWhitelist){
    res.status(403).json({type: 'error', error: 38, msg: '403/38 Notifier Access Denied'})
  }
  else {
    userdb.findOne({
      user: req.session.auth.user, 
      domain: req.session.auth.domain
    }).then(r => {
      if(r) {
        if(r.notifier) {
          if(r.notifier.mustUpdateCreds) {
            logger.info('[NtUpdate] Updated notifier credentials for a user ('+req.session.auth.name+' ['+req.session.auth.user+'])');
            userdb.updateOne({
              user: req.session.auth.user, 
              domain: req.session.auth.domain
            }, {
              $set: {
                'notifier.enabled': true,
                'notifier.account': {
                  domain: req.session.auth.domain, 
                  creds: req.session.auth.creds
                }
              }, 
              $unset: {
                'notifier.mustUpdateCreds': true
              }
            }); 
            res.status(200).json({type: 'success'}); 
            return; 
          }
        }
      }
      res.status(200).json({type: 'error', error: 37, msg: 'Credentials do not appear to need updating.'});
    });
  }
}); 

app.post('/notifier/config', function(req, res){
  if(!req.session.auth){
    res.status(403).json({type: 'error', error: 39, msg: 'Not Authenticated'})
  }
  else if(!req.session.ntWhitelist){
    res.status(403).json({type: 'error', error: 38, msg: '403/38 Notifier Access Denied'})
  }
  else{
    dbf.query({user: req.session.auth.user, domain: req.session.auth.domain}).then(r => {
      if(!r){
        res.status(500).json({type: 'error', error: 19, msg: 'Your OVUE account is missing. Contact us for assistance.'}); return}
      else if(!r.notifier){
        res.status(400).json({type: 'error', error: 19, msg: 'Notifier is not set up.'}); return
      }
      if(req.body.setting === 'minImportance' && !isNaN(req.body.value)){
        let val = parseInt(req.body.value); 
        if(val >= 0 && val <= 3) {
          userdb.updateOne({user: req.session.auth.user, domain: req.session.auth.domain}, {
            $set: {
              'notifier.config.minImportance': val
            }
          }).then(r => {
            res.status(200).json({type: 'success'})
          })
        }
      }
      else{
        res.status(400).json({type: 'error', error: 19, msg: 'Invalid Option.'})
      }
    })
  }
});

app.post('/notifier/new', function(req, res){
  if(!req.session.auth){
    res.status(403).json({type: 'error', error: 39, msg: 'Not Authenticated'})
  }
  else if(!req.session.ntWhitelist){
    res.status(403).json({type: 'error', error: 38, msg: '403/38 Notifier Access Denied'})
  }
  else{
    if(req.body.type === 'text' && req.body.number && req.body.carrier){ // Make sure required fields are present
      let number = rlib.cleanPhoneNumber(req.body.number); // Remove non-digit characters
      if(number.length === 10 && parseInt(number).toString() === number && notifierCore.carriers[req.body.carrier]){ // Make sure carrier and phone # are actually valid
        userdb.updateOne({
          domain: req.session.auth.domain, 
          user: req.session.auth.user
        }, { $set: {
            'notifier.text': {
              active: false, 
              verified: false, 
              number: number, 
              carrier: req.body.carrier
            }
          }
        }).then((r) => {
          let pvdb = mdb.collection('pendingVerifications'); 
          let verCode = rlib.randCode(0).toString(); 
          pvdb.deleteMany({
            user: req.session.auth.user, 
            domain: req.session.auth.domain, 
            type: 'text'
          }).then(r2 => {
            // deletedCount = r2.deletedCount
            pvdb.insertOne({
              createdAt: new Date(), 
              user: req.session.auth.user, 
              domain: req.session.auth.domain, 
              type: 'text', 
              code: verCode
            }); 
          }); // Remove all previously pending text notifications
          notifier.sendText(number, req.body.carrier, `Your OpenVUE verification code is ${verCode}.`).then((resp) => {
            console.log(resp); 
            if(!res.err){
              res.json({type: 'success', number: rlib.formatPhoneNumber(number)});
            }
            else{
              logger.error('Unable to send verification text', res.err)
              res.json({type: 'error', code: 30, error: res.err});
            }
          });
        });
      }
      else{
        res.status(400).json({type: 'error', code: 30, error: 'Bad Request (30/1)'})
      }
    }
    else{
      res.status(400).json({type: 'error', code: 30, error: 'Bad Request (30/0)'})
    }
  }
})

app.post('/notifier/verify', function(req, res){
  if(!req.session.ntWhitelist){
    res.status(403).json({type: 'error', error: 38, msg: '403/38 Notifier Access Denied'})
  }
  else if(req.session.auth && req.body.code){
    let pvdb = mdb.collection('pendingVerifications'); 
    pvdb.findOne({
      user: req.session.auth.user, 
      domain: req.session.auth.domain, 
      code: req.body.code
    }).then(r => {
      if(!r){
        res.status(400).json({type: 'error', code: 34, error: 'Invalid Code'})
      }
      else{
        userdb.updateOne({
          user: req.session.auth.user, 
          domain: req.session.auth.domain
        }, {
          $set: {
            ['notifier.'+r.type+'.verified']: true, 
            ['notifier.'+r.type+'.active']: true,
            'notifier.account': {
              domain: req.session.auth.domain, 
              creds: req.session.auth.creds
            },
            'notifier.enabled': true
          }
        }).then(r2 => {
          pvdb.deleteOne({
            user: req.session.auth.user, 
            domain: req.session.auth.domain, 
            code: req.body.code
          }).then(r3 => {
            auditRequest(req.session.auth, req, 'notifierSetup', true); 
            res.json({type: 'success', verificationType: r.type, data: r2, r3: r3});
          });
        })
      }
    })
  }
  else{
    res.status(400).json({type: 'error', code: 30, error: 'Bad Request'})
  }
}); 

app.post('/notifier/enable', function(req, res){
  if(!req.session.ntWhitelist){
    res.status(403).json({type: 'error', error: 38, msg: '403/38 Notifier Access Denied'})
  }
  else if(req.session.auth && req.body.type === 'text'){
    userdb.findOne({
      user: req.session.auth.user, 
      domain: req.session.auth.domain
    }).then(r => {
      if(!r){
        res.status(500).json({type: 'error', code: 30, error: 'Internal Server Error: Missing User'})}
      else{
        if(r.notifier){
          let type = req.body.type; 
          if(r.notifier[type]){
            if(r.notifier[type]['verified']){
              if(r.notifier[type]['active']){
                res.status(400).json({type: 'error', code: 30, error: 'Bad Request (Selected type is already enabled)'}); 
                return;
              }
              else{
                userdb.updateOne({
                  user: req.session.auth.user, 
                  domain: req.session.auth.domain
                }, {
                  $set: {
                    [`notifier.${type}.active`]: true
                  }
                }).then(r => {
                  res.status(200).json({type: 'success'}); 
                });
                return;
              }
            }
          }
        }
        res.status(400).json({type: 'error', code: 30, error: 'Bad Request (Selected type not set up)'}); 
      }
    })
  }
  else{
    res.status(400).json({type: 'error', code: 30, error: 'Bad Request'})
  }
});

app.post('/notifier/disable', function(req, res){
  if(req.session.auth && req.body.type === 'text'){
    userdb.findOne({
      user: req.session.auth.user, 
      domain: req.session.auth.domain
    }).then(r => {
      if(!r){
        res.status(500).json({type: 'error', code: 30, error: 'Internal Server Error: Missing User'})}
      else{
        if(r.notifier){
          let type = req.body.type; 
          if(r.notifier[type]){
            if(!r.notifier[type]['active']){
              res.status(400).json({type: 'error', code: 30, error: 'Bad Request (Selected type is already disabled)'}); 
              return;
            }
            else{
              userdb.updateOne({
                user: req.session.auth.user, 
                domain: req.session.auth.domain
              }, {
                $set: {
                  [`notifier.${type}.active`]: false
                }
              }).then(r => {
                res.status(200).json({type: 'success'}); 
              }); 
              return;
            }
          }
        }
        res.status(400).json({type: 'error', code: 30, error: 'Bad Request (Selected type not set up)'}); 
      }
    })
  }
  else{
    res.status(400).json({type: 'error', code: 30, error: 'Bad Request'})
  }
});

app.get('/admin', function(req, res) {
  if(!req.session.admAuth){
    res.status(302).redirect('../signin/admin'); 
  }
  else{
    res.status(302).redirect('../admin/dashboard'); 
  }
})
  
app.get('/*', function(req, res){
  let reqPath = req.path.slice(1).split('/');
  if(reqPath[reqPath.length-1].indexOf('.') === -1){reqPath[reqPath.length-1] += '.html'}
  if(reqPath.slice(-1)[0] === '/'){
    res.status(302).redirect(req.path.slice(0, -1))}
  if(reqPath[0] === 'admin'){
    if(!req.session.admAuth){
      res.status(302).redirect('../../signin/admin'); 
      return }
    if(fs.existsSync(path.join(dir_svp, ...reqPath))){
      res.sendFile(path.join(dir_svp, ...reqPath))}
    else{
      res.status(404).sendFile(path.join(__dirname, 'protected', '404.html'))}
    return; 
  }
  if(fs.existsSync(path.join(__dirname, 'public', ...reqPath))){
    res.sendFile(path.join(__dirname, 'public', ...reqPath));
  }
  else{
    res.status(404).sendFile(path.join(__dirname, 'protected', '404.html'));
  }
});

fs.readFile(path.join('public', 'js', 'ver.js'), 'utf8', (e, r) => {
  r = r.slice(r.indexOf('=')+1, r.indexOf('}')+1); // parse out version string
  r = r.replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ').replace(/\'/g,'"'); // turn version into proper JSON
  r = JSON.parse(r); // parse JSON
  logger.info('----------------------------------------'); 
  logger.info('OpenVUE'); 
  logger.info('(C) 2021 Ryan Zhang. All Rights Reserved.')
  logger.info(`Version ${r.str} [${r.stage}]`);
  logger.info(`⮡ Build ${r.build} (${r.date})`);
  logger.info('----------------------------------------')
});

logger.info('Initializing and starting server...');
http.listen(port, function(){
  logger.info(`Done! Now listening (Port ${port})`);
});