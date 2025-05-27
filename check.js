const bcrypt = require('bcryptjs');
const hash = '$2b$10$9benHZz9tW0xCzmKNtnFuuUQnOJmeHaWDeP3QZ84t1bNQrQc3ELni';
bcrypt.compare('test123', hash).then(console.log);