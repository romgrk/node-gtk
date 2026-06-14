#!/usr/bin/env node
/*
 * node-gtk CLI
 *
 * Subcommands:
 *   gen-types   Generate TypeScript declarations from the installed typelibs.
 */

const cmd = process.argv[2]

switch (cmd) {
  case 'gen-types':
    require('../tools/generate-types.js').run(process.argv.slice(3))
    break
  case undefined:
  case '-h':
  case '--help':
    console.log(`node-gtk — GNOME GObject-Introspection bindings for Node.js

Usage: node-gtk <command> [options]

Commands:
  gen-types <Namespace-Version> [...]   Generate TypeScript types (.d.ts)

Run \`node-gtk gen-types --help\` for details.`)
    process.exit(cmd ? 0 : 1)
    break
  default:
    console.error(`node-gtk: unknown command '${cmd}'. Try 'node-gtk --help'.`)
    process.exit(1)
}
