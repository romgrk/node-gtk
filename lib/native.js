/*
 * native.js
 */

let native

try {
    native = require('../build/Release/node-gtk');
} catch(e) {
    native = require('../build/Debug/node-gtk');
}

module.exports = native
