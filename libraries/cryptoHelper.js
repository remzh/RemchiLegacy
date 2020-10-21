/**
 * cryptoHelper.js
 * Believe it or not, for the longest time, user passwords were stored in plain-text in the database. And, because we're using the free version of MongoDB Server, said passwords were then stored in plain-text on disk. 
 * The reason this was not previously a thing was due to the need to have plaintext passwords (since we are acting as a gateway to Synergy), and reversible encryption is frankly meaningless if the key gets compromised. Nonetheless, the encryption key is NOT stored on the database, so doing this should help slightly in the event that the database is somehow compromised. This realistically won't do too much, but it also has a very low performance cost. 
 * (C) 2020 Ryan Zhang. 
*/

const crypto = require('crypto'); 
let key = false; 

/**
 * Encrypts a provided string (intended for StudentVUE passwords - and nothing else!) 
 * @param {string} string - input string to encrypt
 * @returns {string} encrypted string
 */
function encrypt(string) {
  if (!key || key.length !== 16) throw 'KeyError: AES key is either not provided or invalid';  
  if (typeof string !== 'string') throw `InputError: Expcted type "string", got "${typeof string}"`
  const iv = crypto.randomBytes(16); 
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key, 'hex'), iv); 
  let out = cipher.update(string, 'utf8', 'base64'); 
  out += cipher.final('base64'); 
  return iv.toString('base64') + '$' + out; 
}

/**
 * Encrypts a provided string (intended for StudentVUE passwords - and nothing else!), using the user's OID as 12 of the 16 bytes needed for the IV
 * @param {string} string - input string to encrypt
 * @param {string} oid - MongoDB ObjectID of the user
 * @returns {string} encrypted string
 */
function encryptWithOID(string, oid) {
  if (!key || key.length !== 16) throw 'KeyError: AES key is either not provided or invalid';  
  if (!oid || oid.length !== 24) throw 'InputError: OID is either not provided or invalid';  
  if (typeof string !== 'string') throw `InputError: Expcted type "string", got "${typeof string}"`
  const iv = crypto.randomBytes(4); 
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key, 'hex'), Buffer.concat([Buffer.from(oid, 'hex'), iv])); 
  let out = cipher.update(string, 'utf8', 'base64'); 
  out += cipher.final('base64'); 
  return iv.toString('hex') + '$' + out; 
}

/**
 * Decrypts a provided string. 
 * @param {string} input - encrypted input string
 * @returns {string|boolean} false if invalid, otherwise decoded string
 */
function decrypt(input) {
  if (!key || key.length !== 16) throw 'KeyError: AES key is either not provided or invalid';  
  if (typeof input !== 'string') throw `InputError: Expcted type "string", got "${typeof input}"`
  if (input.indexOf('$') === -1) return false; 
  try {
    const iv = Buffer.from(input.split('$')[0], 'base64'); 
    const cipher = crypto.createDecipheriv('aes-128-cbc', key, iv); 
    let out = cipher.update(input.split('$')[1], 'base64', 'utf8');
    out += cipher.final('utf8'); 
    return out; 
  } catch (err) {
    return false; 
  }
}

/**
 * Decrypts a provided string, using the OID as 12 of the 16 IV bytes. 
 * @param {string} input - encrypted input string
 * @param {string} oid - MongoDB ObjectID of the user
 * @returns {string|boolean} false if invalid, otherwise decoded string
 */
function decryptWithOID(input, oid) {
  if (!key || key.length !== 16) throw 'KeyError: AES key is either not provided or invalid';  
  if (!oid || oid.length !== 24) throw 'InputError: OID is either not provided or invalid';  
  if (typeof input !== 'string') throw `InputError: Expcted type "string", got "${typeof input}"`
  if (input.indexOf('$') === -1) return false; 
  try {
    const iv = Buffer.concat([Buffer.from(oid, 'hex'), Buffer.from(input.split('$')[0], 'hex')]); 
    const cipher = crypto.createDecipheriv('aes-128-cbc', key, iv); 
    let out = cipher.update(input.split('$')[1], 'base64', 'utf8');
    out += cipher.final('utf8'); 
    return out; 
  } catch (err) {
    return false; 
  }
}

module.exports = {
  /**
   * 
   */
  init: (userKey) => {
    if (userKey.length === 32) {
      key = Buffer.from(userKey, 'hex'); 
      return true; 
    } else {
      throw 'KeyError: AES key is invalid';  
    }
  }, 
  encrypt, 
  encryptWithOID, 
  decrypt, 
  decryptWithOID
}