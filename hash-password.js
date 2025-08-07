// hash-password.js
const bcrypt = require('bcryptjs');
const password = 'newPassword1!';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
  if (err) throw err;
  console.log('Hash:', hash);
});