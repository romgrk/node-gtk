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
 *
 * --release additionally produces what a Flathub submission needs: Flathub
 * builds on its own infrastructure from FETCHABLE sources, so the staged
 * tree is tarballed and a second manifest (<id>.flathub.yml) references that
 * tarball by url + sha256. Upload the tarball to a release, submit the
 * manifest.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const child_process = require('child_process')

const { exists, mkdirp, copyFile, copyTree, formatSize, exec, tryExec } = require('./bundle/util.js')
const { loadConfig, prepareOutput } = require('./bundle.js')
const appTree = require('./bundle/app-tree.js')

const FLATHUB_REPO = 'https://dl.flathub.org/repo/flathub.flatpakrepo'

const HELP = `Usage: node-gtk flatpak [app-directory] [options]

Packages a node-gtk application as a Flatpak. Generates the manifest and
desktop files, stages the app for an offline flatpak-builder build, then (if
flatpak-builder or org.flatpak.Builder is available) builds it and produces a
single-file .flatpak bundle users can double-click to install.

Options:
  --out <dir>            output directory (default: <app>/dist/flatpak)
  --no-build             only generate the manifest + staged sources
  --install              install the result into the user's flatpak installation
  --run                  install, then run the app (implies --install)
  --release              also produce Flathub submission sources: a tarball of
                         the staged app + <id>.flathub.yml referencing it
  --release-url <url>    download URL the release tarball will live at
                         (default: derived from package.json "repository")
  --lint                 run flatpak-builder-lint on the manifest + metainfo
  -h, --help             show this help

Configuration (package.json "bundle" key): everything \`node-gtk bundle\` uses,
plus: summary, icon, license, categories, desktopFile, metainfo, iconsDir, and
  "flatpak": { "runtimeVersion": "50", "node": 26, "finishArgs": [...],
               "lintExceptions": { "<check>": "<justification>" } }

Desktop integration: an app that ships its own files at the conventional
locations — data/<id>.desktop, data/<id>.metainfo.xml, data/icons/hicolor/ —
gets them used as-is (Exec rewritten for the sandbox); otherwise minimal
stubs are generated. Flathub review needs the real thing.

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

  // Marker for prepareOutput (so a failed run stays overwriteable), and a
  // record of what produced this. Written first on purpose.
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

  const ctx = {
    config, appDir, outBase, log,
    appOutDir: path.join(outBase, 'app'),
    rebuildAddon: true,
  }
  mkdirp(ctx.appOutDir)

  checkFlathubConventions(ctx, flags)

  console.log('## Staging application (offline sources for flatpak-builder)')
  appTree.copyApp(ctx)
  checkApplicationId(ctx)

  console.log('## Generating manifest')
  stageIcons(ctx) // before the manifest: it references the staged files
  const manifestPath = writeManifest(ctx)
  writeLauncher(ctx)
  stageDesktopFile(ctx)
  stageMetainfo(ctx)

  log(`manifest: ${path.relative(process.cwd(), manifestPath)}`)

  const lintTargets = [['manifest', manifestPath], ['appstream', path.join(outBase, `${config.id}.metainfo.xml`)]]

  if (flags.release) {
    console.log('## Producing Flathub submission sources (--release)')
    const flathubManifest = writeReleaseArtifacts(ctx, flags)
    lintTargets[0] = ['manifest', flathubManifest]
  }

  if (flags.lint) {
    console.log('## Linting (flatpak-builder-lint)')
    if (!runLint(ctx, lintTargets))
      process.exitCode = 1
  }

  if (flags.noBuild) {
    console.log(`## Done (generation only). Build with:`)
    console.log(`   flatpak-builder --user --install-deps-from=flathub --force-clean ${path.join(outBase, 'build')} ${manifestPath}`)
    return
  }

  const builder = findBuilder()
  if (builder === undefined) {
    console.log('## flatpak-builder not found — skipping build. Install it with:')
    console.log('   flatpak install flathub org.flatpak.Builder')
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

  if (flags.install || flags.run) {
    console.log('## Installing (user)')
    exec(`flatpak install --user -y --reinstall ${JSON.stringify(bundleFile)}`,
         { stdio: ['ignore', 'inherit', 'inherit'] })
    log(`installed — run with: flatpak run ${config.id}`)
  }

  console.log(`## Done: ${path.relative(process.cwd(), bundleFile)}`)

  if (flags.run) {
    console.log(`## Running ${config.id}`)
    const result = child_process.spawnSync('flatpak', ['run', config.id], { stdio: 'inherit' })
    process.exitCode = result.status === null ? 1 : result.status
  }
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
// Flathub conventions check
// ---------------------------------------------------------------------------

// Flathub gates submissions on conventions a local build never trips over;
// surface them up front — they are expensive to discover at review time.
function checkFlathubConventions(ctx, flags) {
  const { config, log } = ctx
  if (/^(com|org)\.(github|gitlab)\./.test(config.id))
    log(`WARNING: Flathub rejects '${config.id}' — ids based on code hosting must use ` +
        `io.github.* / io.gitlab.* (and the GApplication applicationId must follow)`)
  if (flags.release && /^com\.example\./.test(config.id))
    log(`WARNING: '${config.id}' is a placeholder id — Flathub requires an id under a domain you control`)
  const broad = config.flatpak.finishArgs.filter(a => /^--filesystem=(host|home)\b/.test(a))
  const acknowledged = Object.keys(config.flatpak.lintExceptions).some(k => k.includes('filesystem'))
  if (broad.length > 0 && !acknowledged)
    log(`note: ${broad.join(', ')} is a Flathub linter error — prefer portals, or declare the ` +
        `justification in bundle.flatpak.lintExceptions and request an exception in the submission PR`)
}

// ---------------------------------------------------------------------------
// application-id check
// ---------------------------------------------------------------------------

// The sandbox only lets the app own the D-Bus name matching its flatpak id:
// a GApplication with a different applicationId fails to register
// (GDBus.Error ServiceUnknown) and typically exits without a window. Scan the
// staged sources for applicationId literals and warn on a mismatch.
function checkApplicationId(ctx) {
  const { config, appOutDir, log } = ctx
  const found = new Set()
  const re = /application_?[iI]d\s*[:=]\s*['"]([A-Za-z0-9._-]+)['"]/g

  const visit = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.'))
        continue
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        visit(p)
      } else if (/\.(js|mjs|cjs|ts|mts|jsx|tsx)$/.test(entry.name) && fs.statSync(p).size < 512 * 1024) {
        for (const m of fs.readFileSync(p, 'utf8').matchAll(re))
          found.add(m[1])
      }
    }
  }
  visit(appOutDir)

  if (found.size > 0 && !found.has(config.id)) {
    log(`WARNING: the app sets applicationId ${[...found].join(', ')} but the flatpak id is ${config.id}.`)
    log(`         The sandbox only allows owning the flatpak id on D-Bus, so GApplication`)
    log(`         registration WILL fail. Make bundle.id and applicationId identical.`)
  }
}

// ---------------------------------------------------------------------------
// Flathub release sources
// ---------------------------------------------------------------------------

// Flathub builds from fetchable sources on its own infrastructure. Tarball
// the staged sources (with a top-level directory, matching the default
// strip-components of archive sources) and emit a manifest referencing it.
// The manifest lands in flathub/<id>.yml: the linter requires the file to be
// named exactly after the app id, and the flathub/ directory is what the
// submission PR (and later the app's Flathub repo) contains.
function writeReleaseArtifacts(ctx, flags) {
  const { config, outBase, log } = ctx
  const top = `${config.name}-${config.version}`
  const tarName = `${top}-flatpak-src.tar.gz`
  const tarPath = path.join(outBase, tarName)

  const members = ['app', 'launcher.sh', `${config.id}.desktop`, `${config.id}.metainfo.xml`]
  if (ctx.iconsStaged)
    members.push('icons')
  if (ctx.iconFile !== undefined)
    members.push(ctx.iconFile)
  exec(`tar -czf ${JSON.stringify(tarPath)} --transform ${JSON.stringify(`s,^,${top}/,`)} ` +
       `-C ${JSON.stringify(outBase)} ${members.map(m => JSON.stringify(m)).join(' ')}`)

  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(tarPath)).digest('hex')
  const url = releaseUrl(ctx, tarName, flags)

  const sources = `      - type: archive
        url: ${url}
        sha256: ${sha256}`
  const flathubDir = path.join(outBase, 'flathub')
  mkdirp(flathubDir)
  const flathubManifestPath = path.join(flathubDir, `${config.id}.yml`)
  fs.writeFileSync(flathubManifestPath, manifestContent(ctx, sources,
    `# Flathub submission manifest: sources are fetched from the release tarball.`))

  log(`${tarName} (${formatSize(fs.statSync(tarPath).size)}) sha256=${sha256.slice(0, 12)}…`)
  log(`flathub/${config.id}.yml (sources: ${url})`)
  console.log(`   Next: upload ${tarName} to a release at that URL, then submit the`)
  console.log(`   flathub/ manifest via PR to github.com/flathub/flathub (see doc/bundling.md)`)
  return flathubManifestPath
}

function releaseUrl(ctx, tarName, flags) {
  if (flags.releaseUrl !== undefined)
    return flags.releaseUrl.endsWith('.tar.gz') ? flags.releaseUrl
      : `${flags.releaseUrl.replace(/\/$/, '')}/${tarName}`
  const { config } = ctx
  const m = /github\.com[:/]([^/]+)\/([^/.]+)/.exec(config.repository || '')
  if (m !== null)
    return `https://github.com/${m[1]}/${m[2]}/releases/download/v${config.version}/${tarName}`
  ctx.log(`(no --release-url and no github "repository" in package.json — using a placeholder URL)`)
  return `https://example.com/TODO/${tarName}`
}

// ---------------------------------------------------------------------------
// lint
// ---------------------------------------------------------------------------

function runLint(ctx, targets) {
  const { config, outBase, log } = ctx
  let command, args
  if (tryExec('flatpak-builder-lint --version') !== undefined) {
    command = 'flatpak-builder-lint'
    args = []
  } else if (tryExec('flatpak info org.flatpak.Builder') !== undefined) {
    command = 'flatpak'
    args = ['run', `--filesystem=${outBase}`, '--command=flatpak-builder-lint', 'org.flatpak.Builder']
  } else {
    log('flatpak-builder-lint not available — install with: flatpak install flathub org.flatpak.Builder')
    return true
  }

  // Permissions the app stands by, declared with their justification in
  // bundle.flatpak.lintExceptions — same JSON shape as Flathub's exceptions
  // store, so the file documents exactly what the submission PR must request.
  const exceptions = config.flatpak.lintExceptions
  if (Object.keys(exceptions).length > 0) {
    const exceptionsFile = path.join(outBase, 'lint-exceptions.json')
    fs.writeFileSync(exceptionsFile, JSON.stringify({ [config.id]: exceptions }, null, 2) + '\n')
    // --user-exceptions only supplies the store; --exceptions enables it.
    args.push('--exceptions', '--user-exceptions', exceptionsFile)
    log(`lint: tolerating ${Object.keys(exceptions).join(', ')} — request these as exceptions in the Flathub submission PR`)
  }

  let ok = true
  for (const [kind, file] of targets) {
    const result = child_process.spawnSync(command, [...args, kind, file], { encoding: 'utf8' })
    const output = ((result.stdout || '') + (result.stderr || '')).trim()
    if (result.status === 0) {
      log(`lint ${kind}: OK`)
    } else {
      ok = false
      log(`lint ${kind}: FAILED`)
      if (output !== '')
        console.log(output.split('\n').map(l => `    ${l}`).join('\n'))
    }
  }
  return ok
}

// ---------------------------------------------------------------------------
// generated files
// ---------------------------------------------------------------------------

// YAML single-quoted scalar.
function yq(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

// The manifest body, parameterized over the sources block: local builds use
// dir+file sources pointing at the generated tree; the Flathub variant uses
// a single release-tarball archive source (extracted with the default
// strip-components=1, hence the tarball's top-level directory).
function manifestContent(ctx, sourcesYaml, note) {
  const { config } = ctx
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

  return `# Flatpak manifest for ${config.name} — generated by \`node-gtk flatpak\`.
${note}
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
${icon !== undefined ? `      - ${yq(icon)}\n` : ''}    sources:
${sourcesYaml}
`
}

function writeManifest(ctx) {
  const { config, outBase } = ctx
  const sources = [
    '      - type: dir\n        path: app\n        dest: app',
    '      - type: file\n        path: launcher.sh',
    `      - type: file\n        path: ${config.id}.desktop`,
    `      - type: file\n        path: ${config.id}.metainfo.xml`,
    ...(ctx.iconsStaged ? ['      - type: dir\n        path: icons\n        dest: icons'] : []),
    ...(ctx.iconFile !== undefined ? [`      - type: file\n        path: ${ctx.iconFile}`] : []),
  ].join('\n')

  const manifestPath = path.join(outBase, `${config.id}.yml`)
  fs.writeFileSync(manifestPath, manifestContent(ctx, sources,
    `# Local-build manifest: sources point at the generated tree next to it.`))
  return manifestPath
}

function writeLauncher(ctx) {
  const { config, outBase } = ctx
  const args = [...(config.register ? ['--import', 'node-gtk/register'] : []), ...config.nodeArgs]
  const nodeArgs = args.length > 0 ? args.join(' ') + ' ' : ''
  const entry = config.entry.split(path.sep).join('/')
  fs.writeFileSync(path.join(outBase, 'launcher.sh'), `#!/bin/sh
# ${config.name} — generated by \`node-gtk flatpak\`.
cd /app/main
exec /app/bin/node ${nodeArgs}./${entry} "$@"
`)
}

// An app-provided desktop-integration file: the explicit config path (an
// error when missing — it was asked for), else the first conventional
// location that exists, else undefined (a stub is generated).
function findAppFile(ctx, configured, candidates) {
  if (configured !== undefined) {
    const p = path.resolve(ctx.appDir, configured)
    if (!exists(p))
      throw new Error(`configured file not found: ${configured}`)
    return p
  }
  for (const candidate of candidates) {
    const p = path.join(ctx.appDir, candidate)
    if (exists(p))
      return p
  }
  return undefined
}

// The .desktop file: the app's own ("bundle.desktopFile", or the
// conventional data/<id>.desktop) ships nearly verbatim — only Exec is
// rewritten, because inside the sandbox the launch command is the flatpak id
// installed at /app/bin/<id>, whatever the file says for host installs.
function stageDesktopFile(ctx) {
  const { config, appDir, outBase, log } = ctx
  const dest = path.join(outBase, `${config.id}.desktop`)
  const src = findAppFile(ctx, config.desktopFile, [
    path.join('data', `${config.id}.desktop`),
    `${config.id}.desktop`,
  ])

  if (src === undefined) {
    fs.writeFileSync(dest, `[Desktop Entry]
Type=Application
Name=${config.name}
Comment=${config.summary}
Exec=${config.id} %U
Icon=${config.id}
Terminal=false
Categories=${[...config.categories, ''].join(';')}
`)
    return
  }

  let content = fs.readFileSync(src, 'utf8')
  content = content.replace(/^Exec=(\S+)( .*)?$/m, (_, __, rest) => `Exec=${config.id}${rest || ''}`)
  const icon = /^Icon=(.*)$/m.exec(content)
  if (icon !== null && icon[1].trim() !== config.id)
    log(`WARNING: ${path.relative(appDir, src)} sets Icon=${icon[1].trim()} — flatpak only exports icons named after the app id (${config.id})`)
  if (/^DBusActivatable=true/m.test(content))
    log(`WARNING: ${path.relative(appDir, src)} sets DBusActivatable=true but no D-Bus service file is installed — launches from GNOME Shell will fail`)
  fs.writeFileSync(dest, content)
  log(`desktop: ${path.relative(appDir, src)} (Exec rewritten for the sandbox)`)
}

// The AppStream metainfo: the app's own ("bundle.metainfo", or the
// conventional data/<id>.metainfo.xml) ships verbatim; the generated stub is
// enough for appstreamcli but Flathub review wants real content —
// description, screenshots — which only the app author can write.
function stageMetainfo(ctx) {
  const { config, appDir, outBase, log } = ctx
  const dest = path.join(outBase, `${config.id}.metainfo.xml`)
  const src = findAppFile(ctx, config.metainfo, [
    path.join('data', `${config.id}.metainfo.xml`),
    path.join('data', `${config.id}.appdata.xml`),
    `${config.id}.metainfo.xml`,
  ])

  if (src === undefined) {
    writeGeneratedMetainfo(ctx, dest)
    return
  }

  const content = fs.readFileSync(src, 'utf8')
  const id = /<id>([^<]+)<\/id>/.exec(content)
  if (id === null || id[1] !== config.id)
    log(`WARNING: ${path.relative(appDir, src)} declares <id>${id !== null ? id[1] : '(none)'}</id> but the flatpak id is ${config.id} — AppStream requires them to match`)
  fs.writeFileSync(dest, content)
  log(`metainfo: ${path.relative(appDir, src)}`)
}

function writeGeneratedMetainfo(ctx, dest) {
  const { config } = ctx
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const gh = /github\.com[:/]([^/]+)\/([^/.]+)/.exec(config.repository || '')
  const homepage = gh !== null ? `https://github.com/${gh[1]}/${gh[2]}` : undefined
  const developer = authorName(config.author)
  // The generated stub carries everything derivable (it passes appstreamcli
  // validate); description and screenshots are the author's — Flathub review
  // rejects placeholders, run with --lint for the full checklist.
  fs.writeFileSync(dest, `<?xml version="1.0" encoding="UTF-8"?>
<component type="desktop-application">
  <id>${esc(config.id)}</id>
  <metadata_license>CC0-1.0</metadata_license>
  <project_license>${esc(config.license || 'LicenseRef-proprietary')}</project_license>
  <name>${esc(config.name)}</name>
  <summary>${esc(config.summary)}</summary>
  <description>
    <p>${esc(config.summary)}</p>
    <!-- TODO for Flathub: real description and screenshots (ship your own
         data/<id>.metainfo.xml — it will be used instead of this stub) -->
  </description>
  <launchable type="desktop-id">${esc(config.id)}.desktop</launchable>
  <content_rating type="oars-1.1"/>
${developer !== undefined ? `  <developer id="${esc(config.id.split('.').slice(0, -1).join('.'))}">
    <name>${esc(developer)}</name>
  </developer>
` : ''}${homepage !== undefined ? `  <url type="homepage">${esc(homepage)}</url>\n` : ''}  <releases>
    <release version="${esc(config.version)}" date="${new Date().toISOString().slice(0, 10)}"/>
  </releases>
</component>
`)
}

// package.json "author": "Name <email> (url)" or { "name": ... }.
function authorName(author) {
  const raw = typeof author === 'object' && author !== null ? author.name : author
  if (typeof raw !== 'string')
    return undefined
  const name = raw.replace(/<[^>]*>|\([^)]*\)/g, '').trim()
  return name === '' ? undefined : name
}

// Icons: an app-provided theme tree ("bundle.iconsDir", or the conventional
// data/icons/hicolor/) ships whole — sized, scalable and symbolic variants;
// else the single "bundle.icon" file; else a warning, Flathub requires one.
function stageIcons(ctx) {
  const { config, appDir, outBase, log } = ctx

  const themeDir = findAppFile(ctx, config.iconsDir, [path.join('data', 'icons')])
  if (themeDir !== undefined && exists(path.join(themeDir, 'hicolor'))) {
    copyTree(themeDir, path.join(outBase, 'icons'))
    ctx.iconsStaged = true
    const named = fs.globSync(
      [`hicolor/*/apps/${config.id}.svg`, `hicolor/*/apps/${config.id}.png`], { cwd: themeDir })
    if (named.length === 0)
      log(`WARNING: no ${config.id}.svg/.png under ${path.relative(appDir, themeDir)}/hicolor/*/apps/ — the app will show a generic icon`)
    log(`icons: ${path.relative(appDir, themeDir)} (${named.length > 0 ? named.join(', ') : 'theme tree'})`)
    return
  }

  if (config.icon === undefined) {
    log('no icon found (data/icons/hicolor/ or "bundle.icon") — the app will show a generic icon (Flathub requires one)')
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

// The in-sandbox install command for whatever stageIcons staged. A theme
// tree merges into /app/share/icons; a single SVG installs as scalable, a
// PNG as 256x256.
function iconInstallCommand(ctx) {
  const { config } = ctx
  if (ctx.iconsStaged)
    return `mkdir -p /app/share/icons && cp -a icons/. /app/share/icons/`
  if (ctx.iconFile === undefined)
    return undefined
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
      case '--run': flags.run = true; break
      case '--release': flags.release = true; break
      case '--release-url': flags.release = true; flags.releaseUrl = argv[++i]; break
      case '--lint': flags.lint = true; break
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
