/*
 * register.mjs — install the `gi:` import hooks.
 *
 * Usage:  node --import node-gtk/register app.mjs
 *
 * Then, in app.mjs:
 *     import Gtk from 'gi:Gtk-4.0'
 *     const { Box, Label } = Gtk
 *
 * Note: hooks only affect imports evaluated *after* registration. To use a static
 * `import ... from 'gi:...'` in your entry module, register via the `--import`
 * flag above (not a programmatic `import 'node-gtk/register'` in that same file).
 */

import { register } from 'node:module'

register(new URL('./hooks.mjs', import.meta.url))
