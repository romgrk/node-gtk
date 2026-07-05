#!/usr/bin/env node
/*
 * node-gtk CLI
 *
 * Subcommands:
 *   generate-types   Generate TypeScript declarations from the installed typelibs.
 *   create           Create a new GTK/Adwaita application.
 *   list             List the GObject-Introspection libraries available locally.
 *   bundle           Create a self-contained bundle of a node-gtk application.
 *   flatpak          Package a node-gtk application as a Flatpak.
 */

const cmd = process.argv[2]

switch (cmd) {
  case 'generate-types':
    require('../tools/generate-types.js').run(process.argv.slice(3))
    break
  case 'create':
    require('../tools/create-app.js').run(process.argv.slice(3))
    break
  case 'list':
  case 'list-libraries':
    require('../tools/list-libraries.js').run(process.argv.slice(3))
    break
  case 'bundle':
    require('../tools/bundle.js').run(process.argv.slice(3))
    break
  case 'flatpak':
    require('../tools/flatpak.js').run(process.argv.slice(3))
    break
  case undefined:
  case '-h':
  case '--help':
    console.log(`node-gtk — GNOME GObject-Introspection bindings for Node.js

Usage: node-gtk <command> [options]

Commands:
  create <directory>                         Create a new GTK/Adwaita app
  generate-types <Namespace-Version> [...]   Generate TypeScript types (.d.ts)
  list [filter]                              List available libraries & versions
  bundle [directory]                         Create a self-contained app bundle
  flatpak [directory]                        Package the app as a Flatpak

Run \`node-gtk <command> --help\` for details.`)
    process.exit(cmd ? 0 : 1)
    break
  default:
    console.error(`node-gtk: unknown command '${cmd}'. Try 'node-gtk --help'.`)
    process.exit(1)
}
