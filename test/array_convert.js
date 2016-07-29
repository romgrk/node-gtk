/*
 * array_convert.js
 * Copyright (C) 2016 romgrk <romgrk@Romgrk-ARCH>
 *
 * Distributed under terms of the MIT license.
 */
'use strict';

const nodegtk = require('node-gtk');
nodegtk.startLoop();

const GI = nodegtk.require('GIRepository');
const Gtk = nodegtk.require('Gtk', '3.0');

const repo = GI.Repository.getDefault();

console.log('nss: ', repo.getLoadedNamespaces());

