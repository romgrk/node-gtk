/*
 * system-monitor.mjs
 *
 * A live system monitor built with libadwaita (GTK 4).
 *
 * This example shows off what makes node-gtk distinct from a plain C/Python
 * Adwaita demo: Node's runtime (the `os` module, `fs`, `/proc`) driving a
 * modern Adwaita UI, with a GLib timeout integrated into the GTK main loop to
 * refresh the readings once per second.
 *
 * Widgets used: Adw.ApplicationWindow, Adw.HeaderBar, Adw.ToastOverlay,
 * Adw.Clamp, Adw.PreferencesGroup and Adw.ActionRow (with progress-bar
 * suffixes), plus a Gtk.Box layout.
 *
 * Run with:  node --import node-gtk/register examples/system-monitor.mjs
 */

import GLib from 'gi:GLib-2.0'
import Gtk from 'gi:Gtk-4.0'
import Adw from 'gi:Adw-1'
import os from 'node:os'
import fs from 'node:fs'

const loop = GLib.MainLoop.new(null, false)
const app = new Adw.Application('com.github.romgrk.node-gtk.system-monitor', 0)

app.on('activate', onActivate)
app.run([])

function onActivate() {
  const window = new Adw.ApplicationWindow(app)
  window.setTitle('System Monitor')
  window.setDefaultSize(420, 640)
  window.on('close-request', onQuit)

  // Toast overlay lets us surface transient messages (e.g. high-load warnings).
  const toastOverlay = new Adw.ToastOverlay()

  const root = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })

  const header = new Adw.HeaderBar()
  const refreshButton = new Gtk.Button({ 'icon-name': 'view-refresh-symbolic' })
  refreshButton.setTooltipText('Refresh now')
  header.packStart(refreshButton)
  root.append(header)

  // A scrolled, clamped column is the canonical Adwaita content layout.
  const scrolled = new Gtk.ScrolledWindow({ vexpand: true })
  const clamp = new Adw.Clamp({ 'maximum-size': 600, 'margin-top': 18, 'margin-bottom': 18, 'margin-start': 12, 'margin-end': 12 })
  const column = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 18 })
  clamp.setChild(column)
  scrolled.setChild(clamp)
  root.append(scrolled)

  toastOverlay.setChild(root)
  window.setContent(toastOverlay)

  // --- Build the metric rows once; we only mutate their values on refresh. ---

  const coreCount = os.cpus().length

  const cpuGroup = new Adw.PreferencesGroup({ title: 'Processor', description: `${coreCount} cores` })
  column.append(cpuGroup)

  // Per-core activity shown as a compact grid of vertical meters that
  // stretch to fill the available width, rather than one row per core.
  const cols = coreCount > 8 ? 8 : coreCount
  const coreGrid = new Gtk.Grid({
    'row-spacing': 8, 'column-spacing': 8,
    'margin-top': 6, 'margin-bottom': 6, 'column-homogeneous': true,
    halign: Gtk.Align.FILL, hexpand: true,
  })
  cpuGroup.add(coreGrid)

  const coreBars = []
  for (let i = 0; i < coreCount; i++) {
    const { box, bar } = makeMiniMeter(i)
    coreGrid.attach(box, i % cols, Math.floor(i / cols), 1, 1)
    coreBars.push(bar)
  }

  const memGroup = new Adw.PreferencesGroup({ title: 'Memory' })
  column.append(memGroup)
  const ram = makeMeterRow('RAM')
  memGroup.add(ram.row)

  const sysGroup = new Adw.PreferencesGroup({ title: 'System' })
  column.append(sysGroup)
  const loadRow = makeValueRow('Load average (1m)')
  const uptimeRow = makeValueRow('Uptime')
  const hostRow = makeValueRow('Host')
  sysGroup.add(loadRow.row)
  sysGroup.add(uptimeRow.row)
  sysGroup.add(hostRow.row)

  hostRow.value.setLabel(`${os.hostname()} · ${os.type()} ${os.release()}`)

  // Previous /proc/stat snapshot, for computing per-core deltas.
  let prevStat = readCpuStat()
  let warnedHighLoad = false

  function refresh() {
    const stat = readCpuStat()

    for (let i = 0; i < coreBars.length; i++) {
      const usage = cpuUsage(prevStat[i], stat[i])
      coreBars[i].setValue(usage)
    }
    prevStat = stat

    const usedMem = os.totalmem() - os.freemem()
    const memFraction = usedMem / os.totalmem()
    ram.bar.setFraction(memFraction)
    ram.bar.setText(`${formatBytes(usedMem)} / ${formatBytes(os.totalmem())}`)

    const load1 = os.loadavg()[0]
    loadRow.value.setLabel(load1.toFixed(2))
    uptimeRow.value.setLabel(formatUptime(os.uptime()))

    // Warn once when load exceeds the core count (a classic saturation signal).
    if (load1 > coreCount && !warnedHighLoad) {
      toastOverlay.addToast(new Adw.Toast({ title: `High load: ${load1.toFixed(2)} on ${coreCount} cores` }))
      warnedHighLoad = true
    } else if (load1 <= coreCount) {
      warnedHighLoad = false
    }
  }

  refreshButton.on('clicked', () => {
    refresh()
    toastOverlay.addToast(new Adw.Toast({ title: 'Refreshed' }))
  })

  refresh()
  const timeoutId = GLib.timeoutAddSeconds(0, 1, () => {
    refresh()
    return true // keep the timeout alive
  })
  window._timeoutId = timeoutId // keep a reference so it isn't collected

  window.present()
  loop.run()
}

/* Build an Adw.ActionRow with a progress bar as its suffix (a meter). */
function makeMeterRow(title) {
  const row = new Adw.ActionRow({ title })
  const bar = new Gtk.ProgressBar({ 'show-text': true, valign: Gtk.Align.CENTER, hexpand: true })
  bar.setSizeRequest(140, -1)
  row.addSuffix(bar)
  return { row, bar }
}

/* Build a small vertical level-bar meter labelled with a core index. */
function makeMiniMeter(index) {
  // The box fills its (equal-width) grid column; the bar stays narrow and
  // centered, so the bars end up evenly spaced across the available width.
  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 2, halign: Gtk.Align.FILL, hexpand: true })
  const bar = new Gtk.LevelBar({
    orientation: Gtk.Orientation.VERTICAL,
    inverted: true,
    'min-value': 0,
    'max-value': 1,
    halign: Gtk.Align.CENTER,
  })
  bar.setSizeRequest(12, 72)
  const label = new Gtk.Label({ label: String(index), halign: Gtk.Align.CENTER })
  label.getStyleContext().addClass('dim-label')
  label.getStyleContext().addClass('caption')
  box.append(bar)
  box.append(label)
  return { box, bar }
}

/* Build an Adw.ActionRow with a plain text value as its suffix. */
function makeValueRow(title) {
  const row = new Adw.ActionRow({ title })
  const value = new Gtk.Label({ label: '—', valign: Gtk.Align.CENTER })
  value.getStyleContext().addClass('dim-label')
  row.addSuffix(value)
  return { row, value }
}

/* Parse per-core counters from /proc/stat into [{ idle, total }, ...]. */
function readCpuStat() {
  const lines = fs.readFileSync('/proc/stat', 'utf8').split('\n')
  const cores = []
  for (const line of lines) {
    const m = line.match(/^cpu(\d+)\s+(.*)$/)
    if (!m)
      continue
    const fields = m[2].trim().split(/\s+/).map(Number)
    const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0, steal = 0] = fields
    const idleAll = idle + iowait
    const total = user + nice + system + idle + iowait + irq + softirq + steal
    cores[Number(m[1])] = { idle: idleAll, total }
  }
  return cores
}

/* Fraction in [0, 1] of busy time between two /proc/stat snapshots. */
function cpuUsage(prev, cur) {
  if (!prev || !cur)
    return 0
  const totalDelta = cur.total - prev.total
  const idleDelta = cur.idle - prev.idle
  if (totalDelta <= 0)
    return 0
  return Math.min(1, Math.max(0, 1 - idleDelta / totalDelta))
}

function formatBytes(bytes) {
  const gb = bytes / 1024 ** 3
  if (gb >= 1)
    return `${gb.toFixed(1)} GiB`
  return `${(bytes / 1024 ** 2).toFixed(0)} MiB`
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (d) parts.push(`${d}d`)
  if (h || d) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

function onQuit() {
  loop.quit()
  app.quit()
  return false
}
