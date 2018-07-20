/*
 * array_convert.js
 */

const gi = require('../');
const GI = gi.require('GIRepository');
const Gtk = gi.require('Gtk', '3.0');
const common = require('./__common__.js')

gi.startLoop();

const repo = GI.Repository.getDefault();

console.log('nss: ', repo.getLoadedNamespaces());
