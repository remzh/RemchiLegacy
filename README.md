# Remchi
> The gradebook that you wish you had in high school. 

[![GitHub](https://img.shields.io/github/license/Ryan778/RemchiLegacy?style=flat-square)](https://www.gnu.org/licenses/agpl-3.0)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/Ryan778/RemchiLegacy?style=flat-square)

## Deprecation Notice
Remchi has been deprecated and renamed to "Remchi Legacy", as I do not have the time to continue maintaining this repository. No support of any form will be provided, but the repository will remain up and public for the foreseeable future in case others want to learn from it and/or host their own instance. 

Why "Legacy"? Because I have ideas for a cross-platform, much more general grade analysis tool, and want to reserve "Remchi" for that project should it ever come to fruition...

## Welcome to Remchi!
Remchi is a modern, responsive interface that's designed to connect to Synergy's StudentVUE™ software*. It is not a replacement for Synergy, rather, a complement to it. Remchi is merely a user-facing interface to access and present data already stored in Synergy. 

*This is a **third party, unofficial tool**. We are not affiliated with this company in any way, shape, or form. StudentVUE is a registered trademark owned by Edupoint.

In short, Remchi is intended to allow users to replace StudentVUE™, but **not** Synergy. 
## Setting Up
### Quick Start
- **What you'll need:** A MongoDB or MongoDB-compatible database (v3.2 or later), Node.js (v10.x or later w/ NPM v6.x or later)
- Create a `credentials.json` file under `/secure` *(in the Remchi directory)*
- Set the `database`, `AESKey`, and `sessionKey` keys to your MongoDB URI and two random strings respectively. The AES key should be 16 bytes and in hex (32 chars). A new database will be created under the path listed and the session key will be used to encrypt the cookie used for seesion IDs. 
- Install the necessary server dependencies with `npm install`
- Start the server up with `node index.js`!

At this point, your `credentials.json` file should look something like this: 
```json
{
	"AESKey": "(32 char hexadecimal string)",
	"database": "mongodb://localhost:27017/Remchi", 
	"sessionkey": "(random, hopefully cryptographically secure string)"
}
```

### Full Configuration
Many optional features will be disabled and/or unavailable under the quick start guide. Here's a list of them, as well as how you can set them up. 

Feature|Default Behavior|How to Enable|
-|-|-
Notifier (Text Notifications)|Users will not be able to enable notifications.|Under `credentials.json`, set the `mailemail` and `mailpass` keys to an email username and password respectively. For accounts that you wish to allow Notifier on, you'll have to change `notifier.whitelisted` to true manually under each individual acccount (located in the `users` collection). This will change once the  Notifer system is reworked - it's built on a legacy codebase and hasn't been maintained for several years now. 
Zip Code Lookup|Users will not be able to search their school district by zip code.|You'll have to obtain an API key from Edupoint in order to access their zip lookup endpoint. Afterwards, set the `zipLookup` key under `credentials.json` to it. Because these are the property of Edupoint and are not intended to be publically accessible, they cannot be included by default in Remchi. You can find them in Edupoint's official mobile apps. 
Weather|Users will not see the weather on their dashboard.|[OpenWeather](https://openweathermap.org/) is used to provide current weather information as well as next day forecasts to users. You can obtain a free API key on their website, and put that into the `weather` key under `credentials.json` to enable weather reporting. 
Admin Dashboard (/admin)|While the /signin/admin page is part of the Remchi source code, users are not able to use it.|Our admin dashboard is not currently open sourced, and as such is only part of StudentVUE+. You can create your own "admin" pages by putting static files under the `secure/admin` folder, and setting up "admin" credentials by writing username:password (key:value) pairs under `secure/svue.admin.json`. All passwords are hashed and salted with bcrypt; `tools/passgen.js` is provided to easily generate bcrypt strings.
Security Keys (WebAuthn)|Users won't be able to sign in with them nor set a new one up.|By default, the relaying party (RP) is set to our production server, [svue.itsryan.org](https://svue.itsryan.org). You'll need to change that under `libraries/webauthn.js` to your own domain, and it'll need to be secure (https). Additionally, if you'd like iOS users to be able to use Face ID / Touch ID, you'll need to patch the fido2 library used (as a modification is necessary, but we've yet to release a modified version of the library on NPM). You can easily do this by running `node` on `tools/patch.js`. 
Demo Account|The /signin/demo page will not work.|This requires configuring and setting up the "internal server" - a (rather poorly) emulated StudentVUE endpoint. Contact me if you'd like to do so and want guidance. 

### Example `credentials.json` file
*(please don't use "passwordN" as your actual passwords!)*
```json
{
	"AESKey": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	"database": "mongodb://localhost:27017/Remchi", 
	"demouser": "password1", 
	"mailemail": "noreply@itsryan.org",
	"mailpass": "password2",
	"sessionkey": "password3", 
	"weather": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 
	"zipLookup": "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA"
}
```

### Note on /tools
You may have noticed a `tools` directory included with Remchi. It contains a script, `tools/patch.js`, which when run will make two small changes to two of the installed NPM libraries. 

1. Adds unofficial support to **exceljs** for implementing the filter button. Without it, the filter button will not show up for spreadsheets generated by Remchi (but all other functionality will be present). 
2. Makes an attestation change to **fido2-library** to bypass the signature counter check if the attestation counter was set to zero. In iOS 14 (unsure if it's still the case), Apple hardcodes the counter value to zero, which normally would cause all attempts at using Face ID / Touch ID as a security key to fail. This reduces security ever so slightly, but was an acceptable compromise for me to get iOS devices working. 

If you'd like to implement these changes, simply run `node patch.js` under the `tools` directory **after** you install node_modules and it'll patch the necessary files automatically. 

## Legal
### Licensing
&copy; 2021 Ryan Zhang. 

Remchi is licensed under the **AGPLv3** license. This generally means that you can do whatever you want to the code, and even commercialize it, but any modifications made must also be open sourced under this or a compatible license **if you publicly distribute it**. 

Have an idea for something that'd require more permissible terms? Contact me and we can discuss!

### Legal Disclaimers
As with all reverse engineered projects (you know, like [Dolphin](https://github.com/dolphin-emu/dolphin)), it's always a good idea to throw out some disclaimers just in case :)

Edupoint&reg; does not support nor endorse Remchi in any way. Edupoint&reg; is completely unaffiliated with Remchi. 

Remchi was fully created from reverse engineering StudentVUE's front end and mobile app, both of which are publicly accesible and did not require any form of NDA or legal agreement to not reverse engineer. This is similar to how Dolphin was legally reverse engineered from the Wii (using none of its proprietary source code).

At no point during the development of Remchi did I have access to any source code (although I am aware that Edupoint&reg; does license it to some school districts), design documents, or any other proprietary code from Synergy. Any coincidences between the internals of Remchi and StudentVUE are purely coincidental. 