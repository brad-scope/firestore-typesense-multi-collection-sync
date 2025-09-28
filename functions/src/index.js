require("dotenv").config();

const {automaticSync} = require("./automaticSync.js");
exports.automatic_sync = automaticSync;
exports.manual_sync = require("./manualSync.js");
