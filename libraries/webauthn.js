/**
 * Support for the WebAuth spec on SVUE+
 * (C) 2021 Ryan Zhang. 
 */

let db = false; 
const DB_COLLECTION_NAME = 'publicKeyTokens'; 

const { Fido2Lib } = require('fido2-library');
const path = require('path'); 
const cryptoHelper = require(path.join(__dirname, 'cryptoHelper'));

const f2l = new Fido2Lib({
  timeout: 60000,
  rpId: 'svue.itsryan.org',
  rpName: 'ItsRyan SSO',
  challengeSize: 64,
  attestation: 'none',
  cryptoParams: [-7, -35, -36, -257, -258, -259, -37, -38, -39],
  authenticatorAttachment: 'platform',
  authenticatorRequireResidentKey: false,
  authenticatorUserVerification: 'required'
}); 

function ab2str(buf) {
  return Buffer.from(String.fromCharCode.apply(null, new Uint8Array(buf)), 'binary').toString('base64');
}

function str2ab(str) {
  return new Uint8Array(Buffer.from(str, 'base64').toString('binary').split('').map(r => r.charCodeAt(0))).buffer;
}

function hook(app) {
  console.log('Initialized webauthn!');

  app.get('/secure/wa/setup', async (req, res) => {
    if (req.session.auth) { // tokens are tied to an existing account (that svue+ doesn't manage) - not for creating new ones
      const {id, user, domain, fullName} = req.session.auth; 
      if (!id || !user || !domain || !fullName) {
        res.status(500).json({
          ok: false, 
          error: 'Missing one or more account parameters'
        }); 
        return; 
      }
      let setupOptions = await f2l.attestationOptions();
      setupOptions.challenge = ab2str(setupOptions.challenge); 
      req.session.waChallenge = setupOptions.challenge; 
      res.status(200).json({ok: true, config: setupOptions, user: {
        id, 
        name: `${domain}\\${user}`, 
        displayName: fullName
      }}); 
    } else {
      res.status(400).json({
        ok: false, 
        error: 'User not signed in'
      })
    } 
  }); 

  app.post('/secure/wa/setup', async (req, res) => {
    if (req.session.auth && req.session.waChallenge) {
      let attestation = {
        rawId: str2ab(req.body.rawId), 
        response: {
          attestationObject: str2ab(req.body.attestationObject), 
          clientDataJSON: str2ab(req.body.clientDataJSON)
        }
      }; 
      try {
        let auth = await f2l.attestationResult(attestation, {
          challenge: str2ab(req.session.waChallenge), 
          origin: 'https://svue.itsryan.org', 
          factor: 'either'
        }); 
        req.session.waTmp = {
          counter: auth.authnrData.counter, 
          key: auth.authnrData.credentialPublicKeyPem
        }
        await db.collection(DB_COLLECTION_NAME).insertOne({
          uuid: req.session.auth.id, 
          keyId: req.body.rawId, 
          name: (req.body.friendlyName && typeof req.body.friendlyName === 'string')?req.body.friendlyName.slice(0, 36):false,
          counter: auth.authnrData.get('counter'), 
          key: auth.authnrData.get('credentialPublicKeyPem'), 
          pass: cryptoHelper.encrypt(req.session.auth.creds[1])
        }); 
        delete req.session.waChallenge; 
        res.status(200).json({ok: true}); 
      } catch (err) {
        res.status(400).json({ok: false})
      }
    }
  });

  app.get('/signin/wa', async (req, res) => {
    let assertionOptions = await f2l.assertionOptions();
    assertionOptions.challenge = ab2str(assertionOptions.challenge); 
    req.session.waChallenge = assertionOptions.challenge; 
    res.status(200).json({ok: true, payload: assertionOptions}); 
  });

  app.get('/signin/wa/reauth', async (req, res) => {
    if (req.session.wa) {
      let assertionOptions = await f2l.assertionOptions();
      assertionOptions.challenge = ab2str(assertionOptions.challenge); 
      assertionOptions.allowCredentials = [{
        id: req.session.waKey, 
        type: 'public-key'
      }]; 
      req.session.waChallenge = assertionOptions.challenge; 
      res.status(200).json({ok: true, payload: assertionOptions}); 
    } else {
      res.status(400).json({ok: false, error: 'Not currently signed in with a WA-enabled account.'})
    }
  });
}

/**
 * Validates that a signed WebAuthn challenge is correctly signed and not tampered with. 
 * @param {object} req - request passed from Express
 */
async function validateWASignin (req)  {
  if (req.session.waChallenge) {
    let assertion = {
      rawId: str2ab(req.body.rawId), 
      response: {
        authenticatorData: str2ab(req.body.authenticatorData), 
        clientDataJSON: str2ab(req.body.clientDataJSON), 
        signature: str2ab(req.body.signature)
        // ,userHandle: str2ab(req.body.userHandle) // user handle verification not needed as we don't actually use this value for anything
      }
    }; 
    try {
      let pkEntry = await db.collection(DB_COLLECTION_NAME).findOne({
        keyId: req.body.rawId
      }); 
      if (pkEntry) {
        let auth = await f2l.assertionResult(assertion, {
          challenge: str2ab(req.session.waChallenge), 
          origin: 'https://svue-dev.itsryan.tk', 
          factor: 'either', 
          prevCounter: pkEntry.counter, 
          publicKey: pkEntry.key, 
          userHandle: null
          // userHandle: Uint8Array.from(pkEntry.uuid, c => c.charCodeAt(0))
        }); 
        // update counter and remove challenge
        delete req.session.waChallenge; 
        await db.collection(DB_COLLECTION_NAME).updateOne({
          keyId: req.body.rawId
        }, {
          $set: {
            counter: auth.authnrData.get('counter'), 
            lastUsed: new Date() 
          }
        }); 
        return ({
          ok: true, 
          uuid: pkEntry.uuid, 
          keyId: req.body.rawId, 
          encPass: pkEntry.pass
        }); 
      } else {
        delete req.session.waChallenge; 
        return {
          ok: false, 
          error: 'Invalid Credential ID'
        }; 
      }
    } catch (err) {
      delete req.session.waChallenge; 
      return {
        ok: false, 
        error: 'Bad Credentials'
      }; 
    }
  } else {
    return {
      ok: false, 
      error: 'Missing/invalid challenge'
    }; 
  }
}

/**
 * Updates a user's password tied to their public key credential. 
 * @param {string} keyId - keyId from @function validateWASignin 
 * @param {string} pass - new password to update to
 */
async function updateWACreds(keyId, pass) {
  let pkEntry = await db.collection(DB_COLLECTION_NAME).updateOne({
    keyId
  }, {
    $set: {
      pass: cryptoHelper.encrypt(pass)
    }
  }); 
  return pkEntry; 
}

module.exports = {
  appHook: hook, 
  mongoHook: (mdb) => {
    db = mdb; 
  }, 
  validateWASignin, 
  updateWACreds
}