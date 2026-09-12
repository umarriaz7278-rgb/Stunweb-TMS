const fs = require('fs');
const parts = [];
module.exports = { parts, append: (str) => parts.push(str), save: () => fs.writeFileSync('src/pages/VehicleManagement.jsx', parts.join(''), 'utf8') };
