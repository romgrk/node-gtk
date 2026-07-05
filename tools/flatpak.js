/*
 * flatpak.js — package a node-gtk application as a Flatpak: the format real
 * users install (one-click via GNOME Software / Flathub), with shared GTK
 * runtimes, updates and sandboxing.
 *
 * Driven by the CLI: `node-gtk flatpak [app-directory] [options]`.
 *
 * How it fits together:
 *  - The GTK runtime comes from org.gnome.Platform — nothing GTK-related is
 *    bundled (unlike `node-gtk bundle`). Apps share one platform copy.
 *  - flatpak-builder builds OFFLINE. The usual answer for node apps is
 *    lockfile→sources generators; we sidestep that entirely by staging the
 *    app tree (files + production node_modules, symlinks dereferenced) with
 *    the same app-tree step `node-gtk bundle` uses, and feeding it in as a
 *    plain `dir` source.
 *  - The only thing compiled in the sandbox is the node-gtk addon, against
 *    the runtime's GTK: node + npm's internal node-gyp come from the
 *    org.freedesktop.Sdk.Extension.node<N> SDK extension, and
 *    `--nodedir=/usr/lib/sdk/node<N>` points node-gyp at the extension's
 *    bundled headers so nothing is downloaded.
 *  - The node binary is copied out of the SDK extension into /app/bin (the
 *    Platform does not ship node at runtime).
 *
 * Output: <app>/dist/flatpak/ with the manifest + desktop/metainfo/launcher
 * files and the staged app tree; if a builder is available it also produces
 * a local build and a single-file <Name>.flatpak bundle that users can
 * double-click to install — GNOME Software fetches the Platform from Flathub
 * automatically (--runtime-repo).
 */

const fs = require('fs')
const path = require('path')

const { exists, mkdirp, copyFile, formatSize, dirSize, exec, tryExec } = require('./bundle/util.js')
const { loadConfig, prepareOutput } = require('./bundle.js')
const appTree = require('./bundle/app-tree.js')

const FLATHUB_REPO = 'https://dl.flathub.org/repo/flathub.flatpakrepo'

const HELP = `Usage: node-gtk flatpak [app-directory] [options]

Packages a node-gtk application as a Flatpak. Generates the manifest and
desktop files, stages the app for an offline flatpak-builder build, then (if
flatpak-builder or org.flatpak.Builder is available) builds it and produces a
single-file .flatpak bundle users can double-click to install.

Options:
  --out <dir>      output directory (default: <app>/dist/flatpak)
  --no-build       only generate the manifest + staged sources
  --install        install the result into the user's flatpak installation
  -h, --help       show this help

Configuration (package.json "bundle" key): everything \`node-gtk bundle\` uses,
plus: summary, icon, license, categories, and
  "flatpak": { "runtimeVersion": "49", "node": 26, "finishArgs": [...] }

See doc/bundling.md for the full reference, sandbox permissions, and the
Flathub submission path.`

function run(argv) {
  try {
    const flags = parseArgs(argv)
    if (flags.help) {
      console.log(HELP)
      return
    }
    if (process.platform !== 'linux')
      throw new Error('flatpaks are built on Linux')
    flatpak(flags)
  } catch (e) {
    console.error(`node-gtk flatpak: ${e.message}`)
    if (process.env.NODE_GTK_BUNDLE_DEBUG)
      console.error(e.stack)
    process.exit(1)
  }
}

function flatpak(flags) {
  const appDir = path.resolve(flags.appDir || '.')
  const config = loadConfig(appDir, {})
  const outBase = path.resolve(appDir, flags.out || path.join('dist', 'flatpak'))
  const log = message => console.log(`  ${message}`)

  console.log(`## Packaging ${config.name} (${config.id}) as a Flatpak`)
  console.log(`   runtime org.gnome.Platform//${config.flatpak.runtimeVersion}, node ${config.flatpak.node}`)

  prepareOutput(outBase)

  const ctx = {
    config, appDir, outBase, log,
    appOutDir: path.join(outBase, 'app'),
    rebuildAddon: true,
  }
  mkdirp(ctx.appOutDir)

  console.log('## Staging application (offline sources for flatpak-builder)')
  appTree.copyApp(ctx)

  console.log('## Generating manifest')
  stageIcon(ctx) // before the manifest: it references the staged icon file
  const manifestPath = writeManifest(ctx)
  writeLauncher(ctx)
  writeDesktopFile(ctx)
  writeMetainfo(ctx)

  // Marker for prepareOutput, and a record of what produced this.
  fs.writeFileSync(path.join(outBase, 'bundle.json'), JSON.stringify({
    name: config.name,
    id: config.id,
    version: config.version,
    format: 'flatpak',
    runtime: `org.gnome.Platform//${config.flatpak.runtimeVersion}`,
    node: config.flatpak.node,
    nodeGtk: require('../package.json').version,
    created: new Date().toISOString(),
  }, null, 2) + '\n')

  log(`manifest: ${path.relative(process.cwd(), manifestPath)}`)

  if (flags.noBuild) {
    console.log(`## Done (generation only). Build with:`)
    console.log(`   flatpak-builder --user --install-deps-from=flathub --force-clean ${path.join(outBase, 'build')} ${manifestPath}`)
    return
  }

  const builder = findBuilder()
  if (builder === undefined) {
    console.log('## flatpak-builder not found — skipping build. Install it with:')
    console.log('   flatpak install flathub org.flatpak.Builder')
    console.log(`   then: ${HELP.split('\n')[0]}`)
    return
  }

  console.log(`## Building (${builder.label}) — first build downloads the GNOME SDK`)
  const repoDir = path.join(outBase, 'repo')
  const buildDir = path.join(outBase, 'build')
  exec(`${builder.command(outBase)} --user --force-clean --install-deps-from=flathub ` +
       `--state-dir=${JSON.stringify(path.join(outBase, '.flatpak-builder'))} ` +
       `--repo=${JSON.stringify(repoDir)} ${JSON.stringify(buildDir)} ${JSON.stringify(manifestPath)}`,
       { stdio: ['ignore', 'inherit', 'inherit'] })

  const bundleFile = path.join(outBase, `${config.name}.flatpak`)
  console.log('## Creating single-file bundle')
  exec(`flatpak build-bundle --runtime-repo=${FLATHUB_REPO} ` +
       `${JSON.stringify(repoDir)} ${JSON.stringify(bundleFile)} ${config.id}`)
  log(`${path.relative(process.cwd(), bundleFile)} (${formatSize(fs.statSync(bundleFile).size)})`)

  if (flags.install) {
    console.log('## Installing (user)')
    exec(`flatpak install --user -y --reinstall ${JSON.stringify(bundleFile)}`,
         { stdio: ['ignore', 'inherit', 'inherit'] })
    log(`installed — run with: flatpak run ${config.id}`)
  }

  console.log(`## Done: ${path.relative(process.cwd(), bundleFile)}`)
}

// Native flatpak-builder if present, else the org.flatpak.Builder flatpak
// (the Flathub-recommended way to get the builder). The flatpak-run variant
// gets explicit access to the output directory: its sandbox sees the host
// filesystem EXCEPT /tmp and other special paths, so builds outside $HOME
// fail without it.
function findBuilder() {
  if (tryExec('flatpak-builder --version') !== undefined)
    return { label: 'flatpak-builder', command: () => 'flatpak-builder' }
  if (tryExec('flatpak info org.flatpak.Builder') !== undefined)
    return {
      label: 'org.flatpak.Builder',
      command: outBase => `flatpak run --filesystem=${JSON.stringify(outBase)} org.flatpak.Builder`,
    }
  return undefined
}

// ---------------------------------------------------------------------------
// generated files
// ---------------------------------------------------------------------------

// YAML single-quoted scalar.
function yq(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function writeManifest(ctx) {
  const { config, outBase } = ctx
  const { runtimeVersion, node } = config.flatpak
  const sdk = `/usr/lib/sdk/node${node}`

  // The addon build, run inside the sandbox: compile with npm's internal
  // node-gyp against the SDK extension's node headers (offline). The
  // module_name/module_path gyp variables are normally node-pre-gyp's job;
  // with them set, binding.gyp's action_after_build installs the addon where
  // lib/native.js finds it. Compile inputs are dropped afterwards.
  const buildAddon = [
    `cd /app/main/node_modules/node-gtk`,
    `B=$PWD/lib/binding/node-v$(node -p process.versions.modules)-linux-$(node -p process.arch)`,
    `node ${sdk}/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js rebuild ` +
      `--nodedir=${sdk} -- -Dmodule_name=node_gtk -Dmodule_path=$B`,
    `rm -rf build src binding.gyp ../nan`,
  ].join(' && ')

  const finishArgs = [
    '--socket=wayland',
    '--socket=fallback-x11',
    '--share=ipc',
    '--device=dri',
    ...config.flatpak.finishArgs,
  ]

  const icon = iconInstallCommand(ctx)

  const manifest = `# Flatpak manifest for ${config.name} — generated by \`node-gtk flatpak\`.
# Reference: doc/bundling.md. Regenerate rather than editing where possible;
# persistent settings (finish-args etc.) belong in package.json "bundle".
app-id: ${config.id}
runtime: org.gnome.Platform
runtime-version: ${yq(runtimeVersion)}
sdk: org.gnome.Sdk
sdk-extensions:
  - org.freedesktop.Sdk.Extension.node${node}
command: ${config.id}
finish-args:
${finishArgs.map(a => `  - ${yq(a)}`).join('\n')}
modules:
  - name: ${config.id.split('.').pop().toLowerCase()}
    buildsystem: simple
    build-options:
      append-path: ${sdk}/bin
    build-commands:
      # the app: staged offline by \`node-gtk flatpak\` (files + production
      # node_modules); nothing is fetched from npm here
      - mkdir -p /app/main && cp -a app/. /app/main/
      # the node-gtk addon, compiled against the runtime's GTK
      - ${yq(buildAddon)}
      # the node runtime (the Platform does not ship one)
      - install -Dm755 ${sdk}/bin/node /app/bin/node
      # launcher + desktop integration
      - install -Dm755 launcher.sh /app/bin/${config.id}
      - install -Dm644 ${config.id}.desktop /app/share/applications/${config.id}.desktop
      - install -Dm644 ${config.id}.metainfo.xml /app/share/metainfo/${config.id}.metainfo.xml
${icon !== undefined ? `      - ${icon}\n` : ''}    sources:
      - type: dir
        path: app
        dest: app
      - type: file
        path: launcher.sh
      - type: file
        path: ${config.id}.desktop
      - type: file
        path: ${config.id}.metainfo.xml
${ctx.iconFile !== undefined ? `      - type: file\n        path: ${ctx.iconFile}\n` : ''}`

  const manifestPath = path.join(outBase, `${config.id}.yml`)
  fs.writeFileSync(manifestPath, manifest)
  return manifestPath
}

function writeLauncher(ctx) {
  const { config, outBase } = ctx
  const nodeArgs = config.nodeArgs.length > 0 ? config.nodeArgs.join(' ') + ' ' : ''
  const entry = config.entry.split(path.sep).join('/')
  fs.writeFileSync(path.join(outBase, 'launcher.sh'), `#!/bin/sh
# ${config.name} — generated by \`node-gtk flatpak\`.
cd /app/main
exec /app/bin/node ${nodeArgs}./${entry} "$@"
`)
}

function writeDesktopFile(ctx) {
  const { config, outBase } = ctx
  fs.writeFileSync(path.join(outBase, `${config.id}.desktop`), `[Desktop Entry]
Type=Application
Name=${config.name}
Comment=${config.summary}
Exec=${config.id} %U
Icon=${config.id}
Terminal=false
Categories=${[...config.categories, ''].join(';')}
`)
}

function writeMetainfo(ctx) {
  const { config, outBase } = ctx
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Enough for local installs; Flathub review needs real content — the
  // generated TODOs mark what to fill in.
  fs.writeFileSync(path.join(outBase, `${config.id}.metainfo.xml`), `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${esc(config.id)}</id>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>${esc(config.license || 'LicenseRef-proprietary')}</project_license>
  <name>${esc(config.name)}</name>
  <summary>${esc(config.summary)}</summary>
  <description>
    <p>${esc(config.summary)}</p>
    <!-- TODO for Flathub: real description, screenshots, releases, developer, content_rating -->
  </description>
  <launchable type="desktop-id">${esc(config.id)}.desktop</launchable>
</component>
`)
}

// Copy the configured icon next to the manifest and return the in-sandbox
// install command for it. SVG installs as scalable; PNG as 256x256.
function stageIcon(ctx) {
  const { config, appDir, outBase, log } = ctx
  if (config.icon === undefined) {
    log('no "bundle.icon" configured — the app will show a generic icon (Flathub requires one)')
    return
  }
  const src = path.resolve(appDir, config.icon)
  if (!exists(src))
    throw new Error(`icon not found: ${config.icon}`)
  const ext = path.extname(src).toLowerCase()
  if (ext !== '.svg' && ext !== '.png')
    throw new Error(`icon must be .svg or .png, got: ${config.icon}`)
  ctx.iconFile = `icon${ext}`
  copyFile(src, path.join(outBase, ctx.iconFile))
}

function iconInstallCommand(ctx) {
  if (ctx.iconFile === undefined)
    return undefined
  const { config } = ctx
  const dir = ctx.iconFile.endsWith('.svg') ? 'scalable' : '256x256'
  return `install -Dm644 ${ctx.iconFile} /app/share/icons/hicolor/${dir}/apps/${config.id}${path.extname(ctx.iconFile)}`
}

// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '-h': case '--help': flags.help = true; break
      case '--no-build': flags.noBuild = true; break
      case '--install': flags.install = true; break
      case '--out': flags.out = argv[++i]; break
      default:
        if (arg.startsWith('-'))
          throw new Error(`unknown option '${arg}' — see node-gtk flatpak --help`)
        if (flags.appDir !== undefined)
          throw new Error(`unexpected argument '${arg}'`)
        flags.appDir = arg
    }
  }
  return flags
}

module.exports = { run }
