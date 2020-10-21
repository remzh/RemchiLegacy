// notifier.js
// (C) 2020 Ryan Zhang. Some Rights Reserved. 
// 
// Handles sending text notifications to users who opt-in. 
// Requires: svuelib.js, svcore.js

const path = require('path');
const nodemailer = require('nodemailer'); 
const moment = require('moment'); 

const rlib = require(path.join(__dirname, 'rlib.js')); 
const svueLib = require(path.join(__dirname, 'svuelib.js')); 
const svcore = require(path.join(__dirname, 'svcore.js')); 
const fetchSVUE = svcore.fetchSVUE; 

let userdb = false; 
let nt_transporter, logger;
const notifier = {
  active: false, 
  carriers: {
      att: '%s@txt.att.net',
      tmobile: '%s@tmomail.net', 
      verizon: '%s@vzwpix.com', 
      sprint: '%s@pm.sprint.com', 
      lyca: '+1%s@mms.us.lycamobile.com'
  },
  sendText: async function(number, carrier, message){
    let carriers = notifier.carriers; 
    let textOptions = {
      from: 'StudentVUE+ <svue@itsryan.org>', 
      to: carriers[carrier].replace('%s', number), 
      text: message, /*the one that sends*/
      html: message
    }
    let info = await nt_transporter.sendMail(textOptions);
    console.log('Message sent: %s', info.messageId);
    return info; 
  }
}

let lastRun = 0; 
let ntCheck_stats = [0, 0] // Checked, sent
function runNotifierCheck(){
  if (!logger) {
    return} // not enabled/set up
  if(!notifier.active){
    logger.info('Skipping notifier check (disabled under notifier.active)'); 
    return} 
  if(lastRun > Date.now() - 120000){
    logger.info('Cancelled subsequent notifierCheck.');
    return} // In the event the server's temporarily suspended, prevent the server from running the check more than once in a short period of time to "catch up"
  lastRun = Date.now();
  logger.info('Running Notifier Check. Current Timestamp: '+moment().format('MMMM Do, h:mm a'));
  if(!userdb){
    logger.info('notifier: userdb doesn\'t exist, checking again in 3 seconds'); 
    lastRun = 0;
    setTimeout(runNotifierCheck, 3000);
    return;
  }
  ntCheck_stats = [0, 0];
  userdb.find({
    'notifier.enabled': true,
    '$or': [{ // rate limit sending notifications to one per four hours
      'notifier.lastNotified': {
        '$lte': moment().subtract(4, 'hours').toDate()
      }}, 
      {
      'notifier.lastNotified': {
        '$exists': false
      }}]
  }).forEach((item, err) => {
    if(err){
      logger.error('notifer: runNotifierCheck - userdb.find msg:', err)}
      try{ // Everything's enclosed in a try / catch loop so the server doesn't go down on an error
        fetchSVUE('Gradebook', item.notifier.account.domain, item.notifier.account.creds[0], item.notifier.account.creds[1], '&lt;Parms&gt;&lt;ChildIntID&gt;0&lt;/ChildIntID&gt;&lt;/Parms&gt;').then(r => {
          if(typeof r.Gradebook !== 'undefined'){ // All good
            ntCheck_stats[0] ++; 

            // Determine what assignments are "new" and need a notification sent
            let cur = svueLib.parseAssignments(r); // Current grades
            let cur_details = svueLib.parseAssignmentDetails(r); 
            if(!item.notifier.config){
              logger.warn('User '+item.user+' has notifier set up but is missing required configuration files. Skipping.')
              return; 
            }
            let minImportanace = item.notifier.config.minImportance?item.notifier.config.minImportance:1; 
            let showScore = item.notifier.config.showScore?item.notifier.config.showScore:1
            let notifyUnscored = item.notifier.config.notifyUnscored; 
            let blunt = item.notifier.config.blunt; 
            let msg = ''; 
            let type = ['items', 'important items', 'tests/projects', 'finals'][minImportanace]; // Used when there are >2 items (otherwise, they're listed individually by name) 
            let stored = item.items; 
            let diff = svueLib.diffAssignments(cur, stored);
            let toNotify = {}; // List of objects that need a notification sent
            for(let i in diff){
              if(diff[i]['items'].length > 0){
                for(let j = 0; j < diff[i]['items'].length; j++){
                  let itemID = diff[i]['items'][j];
                  if(cur_details[itemID]){
                    let importance = rlib.detImportance(cur_details[itemID].measure, cur_details[itemID].type)
                    if(!notifyUnscored && cur_details[itemID].points === -1){
                      continue; // Unless notify unscored is on, unscored items will be skipped
                    }
                    if(importance >= minImportanace){
                      toNotify[itemID] = cur_details[itemID]; 
                    }
                  }
                }
              }
            }

            // Remove any items that have already had a notification sent
            let ntHist = item.notifier.sent; 
            if(ntHist){
              for(let i = 0; i < ntHist.length; i++){
                if(toNotify[ntHist[i]]){
                  delete toNotify[ntHist[i]]
                }
              }
            }

            // Check if a notification needs to be sent (If not, finish)
            let ntLength = Object.keys(toNotify).length;
            if(ntLength === 0){
              logger.info('notifier: gradebook for user '+item.user+' complete. no new '+type+' found');
              return; 
            }

            // Form a message based on how many items need to be mentioned.
            ntCheck_stats[1] ++;
            let lowestScore = 0; 
            if(ntLength > 2){
              msg = `${ntLength} new ${type} have been put in. Open StudentVUE+ to see them.`}
            else if(ntLength === 2){
              // Two new items
              // Your (item 1) and (item 2) were put in. You got a(n) (score 1) and a(n) (score 2) respectively. 
              let items = [toNotify[Object.keys(toNotify)[0]], toNotify[Object.keys(toNotify)[1]]];
              if(items[0]['measure'].length > 45){items[0]['measure'] = items[0]['measure'].slice(0, 43)+'...'}
              if(items[1]['measure'].length > 45){items[1]['measure'] = items[1]['measure'].slice(0, 43)+'...'}
              lowestScore = Math.min(items[0]['score'], items[1]['score'])
              msg = `Your ${items[0]['measure']} and ${items[1]['measure']} were put in.`
              if(showScore) msg += ` You got a${items[0].score<90&&items[0].score>=80?'n':''} ${items[0].score}% and a${items[1].score<90&&items[1].score>=80?'n':''} ${items[1].score}% respectively.`
            }
            else if(ntLength === 1){
              // Single new item
              // Your (item) was put in. You got a(n) (score). 
              let item = toNotify[Object.keys(toNotify)[0]]; 
              lowestScore = item['score'];
              if(item['measure'].length > 60){item['measure'] = item['measure'].slice(0, 58)+'...'}
              msg = `Your ${item['measure']} in ${rlib.trimTitle(item['course'])} was put in.${showScore?` You got a${item.score<90&&item.score>=80?'n':''} ${item.score}%.`:''}`
            }
            if(!blunt && showScore && lowestScore >= 80){ // Add a small message based on the score, if enabled.
              if(lowestScore >= 93){msg += ' Congrats!'}
              else if(lowestScore >= 86){msg += ' Not Bad!'}
              else{msg += ' Could be worse.'}
            }

            // Push the "notified" items to db so they don't get a duplicate notification 
            // Also sets the "lastNotified" property to the current time
            userdb.updateOne({ 
              domain: item.domain, 
              user: item.user
            }, {
              $addToSet: {
                ['notifier.sent']: {
                  $each: Object.keys(toNotify)
                }
              }, 
              $set: {
                'notifier.lastNotified': new Date() 
              }
            });

            // Send the actual message and finish up
            logger.info('notifier: ['+item.user+'] found new items. sending message: '+msg);
            if(item.notifier.text){
              if(item.notifier.text.active){
                notifier.sendText(item.notifier.text.number, item.notifier.text.carrier, msg);
              }
            }

            // logger.info('notifier: gradebook for user '+item.user+' complete'); (old, no longer necessary)
          }
          else if(r.RT_ERROR){ // credential error (most likely, the password changed)
            userdb.updateOne({
              user: item.user, 
              domain: item.domain
            }, {
              $set: {
                'notifier.enabled': false, 
                'notifier.mustUpdateCreds': true
              }
            });
            if(item.notifier.text){
              if(item.notifier.text.active){
                notifier.sendText(item.notifier.text.number, item.notifier.text.carrier, `[Warn] Notifier was unable to reach your account, and is now disabled. Sign in to SVUE+ to re-enable it.`);
              }
            }
            logger.info('notifier: credentials for user '+item.user+' are no longer valid, disabling and moving on')
            return; 
          }
          else{
            // An error occured with checking for notifications. Log the error and skip the user.
            userdb.updateOne({
              user: item.user, 
              domain: item.domain
            }, {
              $inc: {
                'notifier.failCount': 1
              }
            });
            logger.info('notifier: gradebook for user '+item.user+' failed, skipping')
            return; 
          }
        }, r => {
          // Failed
          logger.warn('notifier: failed fetchSVUE (runNotifierCheck) msg:', r)
          userdb.updateOne({
            user: item.user, 
            domain: item.domain
          }, {
          $inc: {
            'notifier.failCount': 1
          }});
        }); 
      } catch (err){
        logger.error('notifier: runNotifierCheck: processing failure: ', err);
      }
  })
}

module.exports = {
  carriers: notifier.carriers, 
  init: (creds, db, log) => {
    nt_transporter = nodemailer.createTransport({
      service: 'gmail', 
      auth: creds
    });
    userdb = db; 
    logger = log; 
    notifier.active = true; 
    logger.info('Initialized and activated Notifier module.')
  }, 
  runNotifierCheck: runNotifierCheck, 
  stats: ntCheck_stats, 
  sendText: notifier.sendText, 
  getStatus: () => {
    return {
      active: notifier.active, 
      lastRun: lastRun
    }
  }, 
  setStatus: (bool) => {
    notifier.active = bool; 
  }
}