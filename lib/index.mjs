/*
 * index.mjs
 *
 * ESM facade over the CommonJS entry (index.js), so that named imports work:
 *
 *     import gi, { require, registerClass } from 'node-gtk'
 *
 * Node's CommonJS-to-ESM named-export detection (cjs-module-lexer) cannot see
 * through index.js's computed `module.exports`, so we re-export explicitly here.
 * Both this file and `require('node-gtk')` share the same underlying index.js
 * instance (Node caches it by path), so there is no duplicated state.
 */

import gi from './index.js'

export default gi

export const require = gi.require
export const isLoaded = gi.isLoaded
export const prependSearchPath = gi.prependSearchPath
export const prependLibraryPath = gi.prependLibraryPath
export const listAvailableModules = gi.listAvailableModules
export const registerClass = gi.registerClass
export const flushRegistrations = gi.flushRegistrations
export const getGType = gi.getGType
export const System = gi.System
