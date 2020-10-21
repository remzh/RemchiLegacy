## 1x: Server-side errors
- 10: Unable to regenerate session cookie (/signin)
- 19: User account is missing from DB (whenever dbf.query fails)

## 2x: Client-validated (user-side) errors
- 20: User is offline ("You appear to be offline") (/signin)
- 21: Username < 4 chars ("Your username is invalid") (/signin)
- 22: Password < 6 chras ("Your password is invalid") (/signin)
- 28: Bad request (bad parameters / characters that aren't allowed) (/data/gradebook)
- 29: Request timed out (>3.25s) (/signin)

## 3x: Server-validated (user-side) errors
- 30: Bad request / data (Login credentials, item history, etc.) ("Malformed request / invalid data, try again") (POST /signin, /itemHistory)
- 31: Domain is not valid ("The domain provided is invalid.") (POST /signin)
- 32: Username rejected by Synergy ("The user name provided is invalid") (POST /signin)
- 33: Password rejected by Synergy ("The password provided is incorrect") (POST /signin)
- 34: Invalid verification code ("Invalid Code") (POST /notifier/verify)
- 37: District URL / Zip code provided is invalid
- 38: No notifier access (anything under /notifier that requires whitelisting)
- 39: Too Many Requests (>6/24s) (POST /signin)

## 4x: Synergy / PSD error 
- 40: Exception thrown and logged when parsing login result from Synergy, likely a format change ("An unknown error has occured on the PSD endpoint.") (POST /signin)
- 41: Exception thrown and logged when parsing ChildList result from Synergy, likely a format change ("An internal server error occured") (POST /signin)
- 42: Exception thrown from Synergy when attempting to get grades (likely credentials changed) (varies) (/data/gradebook)
- 43: Unable to parse Gradebook data (user changed password?) ("Unable to fetch Gradebook. Did you change your password?") (/data/gradebook)
- 48: Synergy server is down (ECONNRESET) 
- 49: Unknown synergy exception (non-ECONNRESET error)

## 5x: Internal Server Errors
- 50: Generic internal server error