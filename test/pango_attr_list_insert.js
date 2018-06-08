/*
 * pango_attr_list_insert.js
 */

const gi = require('../');
const Pango = gi.require('Pango');

const attrs = new Pango.AttrList();

attrs.insert.debug = true;
attrs.insert(new Pango.AttrSize(300));
