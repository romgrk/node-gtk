/*
 * array_convert.js
 */

const gi = require('../');
gi.startLoop();

const GI = gi.require('GIRepository');
const Gtk = gi.require('Gtk', '3.0');

const repo = GI.Repository.getDefault();

console.log('nss: ', repo.getLoadedNamespaces());
