if(process.argv.length !== 4) {
  console.error('Format "passgen.js <rounds> <key>"'); 
  process.exit(1); 
}

const rounds = process.argv[2], key = process.argv[3]; 
const bcrypt = require('bcrypt'); 
if(parseInt(rounds).toString() !== rounds){
  console.error('Invalid saltRounds: '+rounds); 
  process.exit(1); 
}
console.log('Generating...');
bcrypt.hash(key, parseInt(rounds)).then(hash => {
  console.log(hash); 
})