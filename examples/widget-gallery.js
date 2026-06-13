/*
 * widget-gallery.js
 *
 * A tour of common libadwaita (GTK 4) widgets, organized into pages behind an
 * Adw.ViewStack with an Adw.ViewSwitcher in the header bar (and a bottom
 * Adw.ViewSwitcherBar for narrow windows).
 *
 * Meant as a living reference: each page builds a family of widgets — boxed
 * list rows, buttons, controls, avatars and feedback widgets (toasts, banners,
 * status pages) — using the same node-gtk idioms as the other examples.
 *
 *   node examples/widget-gallery.js
 */

const gi = require('..')
const GLib = gi.require('GLib', '2.0')
const Gtk = gi.require('Gtk', '4.0')
const Adw = gi.require('Adw', '1')

const loop = GLib.MainLoop.new(null, false)
const app = new Adw.Application('com.github.romgrk.node-gtk.widget-gallery', 0)

app.on('activate', onActivate)
gi.startLoop()
const status = app.run([])
console.log('Finished with status:', status)

function onActivate() {
  const window = new Adw.ApplicationWindow(app)
  window.setTitle('Adwaita Widget Gallery')
  window.setDefaultSize(460, 720)
  window.on('close-request', onQuit)

  // Toast overlay wraps everything so any page can raise transient messages.
  const toastOverlay = new Adw.ToastOverlay()

  const stack = new Adw.ViewStack({ vexpand: true })
  stack.addTitledWithIcon(buildRowsPage(), 'rows', 'Rows', 'view-list-symbolic')
  stack.addTitledWithIcon(buildButtonsPage(toastOverlay), 'buttons', 'Buttons', 'emblem-ok-symbolic')
  stack.addTitledWithIcon(buildControlsPage(), 'controls', 'Controls', 'preferences-system-symbolic')
  stack.addTitledWithIcon(buildFeedbackPage(toastOverlay), 'feedback', 'Feedback', 'dialog-information-symbolic')
  stack.addTitledWithIcon(buildAvatarsPage(), 'avatars', 'Avatars', 'avatar-default-symbolic')

  // ViewSwitcher in the header for wide windows; a ViewSwitcherBar at the
  // bottom takes over when the window is too narrow to fit the switcher.
  const switcher = new Adw.ViewSwitcher({ stack, policy: Adw.ViewSwitcherPolicy.WIDE })
  const switcherBar = new Adw.ViewSwitcherBar({ stack })

  const header = new Adw.HeaderBar()
  header.setTitleWidget(switcher)

  const view = new Adw.ToolbarView()
  view.addTopBar(header)
  view.setContent(stack)
  view.addBottomBar(switcherBar)

  // Reveal the bottom switcher only at narrow widths.
  switcherBar.setReveal(false)
  window.on('notify::default-width', () => {
    switcherBar.setReveal(window.getWidth() < 500)
  })

  toastOverlay.setChild(view)
  window.setContent(toastOverlay)
  window.present()
  loop.run()
}

/* Add one or more CSS classes to a widget and return it.
 * (node-gtk can't set the array-valued `css-classes` construct property.) */
function styled(widget, ...classes) {
  for (const c of classes)
    widget.addCssClass(c)
  return widget
}

/* A scrolled, clamped vertical column — the canonical Adwaita content layout. */
function makePage(spacing = 18) {
  const scrolled = new Gtk.ScrolledWindow({ vexpand: true })
  const clamp = new Adw.Clamp({
    'maximum-size': 500,
    'margin-top': 18, 'margin-bottom': 18, 'margin-start': 12, 'margin-end': 12,
  })
  const column = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing })
  clamp.setChild(column)
  scrolled.setChild(clamp)
  return { scrolled, column }
}

/* ----- Rows: the boxed-list widgets that make up most Adwaita UIs ----- */
function buildRowsPage() {
  const { scrolled, column } = makePage()

  const group = new Adw.PreferencesGroup({ title: 'List Rows' })
  column.append(group)

  const action = new Adw.ActionRow({ title: 'Action Row', subtitle: 'With a prefix icon and a suffix button' })
  action.addPrefix(new Gtk.Image({ 'icon-name': 'starred-symbolic' }))
  action.addSuffix(styled(new Gtk.Button({ 'icon-name': 'go-next-symbolic', valign: Gtk.Align.CENTER }), 'flat'))
  action.setActivatableWidget(action)
  group.add(action)

  const entry = new Adw.EntryRow({ title: 'Entry Row' })
  group.add(entry)

  const password = new Adw.PasswordEntryRow({ title: 'Password Entry Row' })
  group.add(password)

  const toggle = new Adw.SwitchRow({ title: 'Switch Row', subtitle: 'A labelled toggle', active: true })
  group.add(toggle)

  const combo = new Adw.ComboRow({ title: 'Combo Row' })
  combo.setModel(Gtk.StringList.new(['Low', 'Medium', 'High']))
  group.add(combo)

  const spin = Adw.SpinRow.newWithRange(0, 100, 1)
  spin.setTitle('Spin Row')
  spin.setValue(42)
  group.add(spin)

  const expander = new Adw.ExpanderRow({ title: 'Expander Row', subtitle: 'Expand for more' })
  expander.addRow(new Adw.ActionRow({ title: 'Nested row 1' }))
  expander.addRow(new Adw.ActionRow({ title: 'Nested row 2' }))
  group.add(expander)

  return scrolled
}

/* ----- Buttons: the standard style classes and grouped variants ----- */
function buildButtonsPage(toastOverlay) {
  const { scrolled, column } = makePage()

  const toast = (title) => () => toastOverlay.addToast(new Adw.Toast({ title }))

  // Style classes
  const styles = new Adw.PreferencesGroup({ title: 'Styles' })
  column.append(styles)
  const styleBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, homogeneous: true, 'margin-top': 6 })
  const regular = new Gtk.Button({ label: 'Regular' })
  const suggested = styled(new Gtk.Button({ label: 'Suggested' }), 'suggested-action')
  const destructive = styled(new Gtk.Button({ label: 'Destructive' }), 'destructive-action')
  for (const b of [regular, suggested, destructive]) {
    b.on('clicked', toast(`${b.getLabel()} clicked`))
    styleBox.append(b)
  }
  styles.add(styleBox)

  // Pill + circular
  const shapes = new Adw.PreferencesGroup({ title: 'Shapes' })
  column.append(shapes)
  const shapeBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, halign: Gtk.Align.CENTER, 'margin-top': 6 })
  shapeBox.append(styled(new Gtk.Button({ label: 'Pill Button' }), 'pill', 'suggested-action'))
  shapeBox.append(styled(new Gtk.Button({ 'icon-name': 'list-add-symbolic' }), 'circular'))
  shapes.add(shapeBox)

  // Linked group + a split button
  const grouped = new Adw.PreferencesGroup({ title: 'Grouped' })
  column.append(grouped)
  const groupedBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12, halign: Gtk.Align.CENTER, 'margin-top': 6 })
  const linked = styled(new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL }), 'linked')
  linked.append(new Gtk.Button({ 'icon-name': 'format-justify-left-symbolic' }))
  linked.append(new Gtk.Button({ 'icon-name': 'format-justify-center-symbolic' }))
  linked.append(new Gtk.Button({ 'icon-name': 'format-justify-right-symbolic' }))
  groupedBox.append(linked)
  const split = new Adw.SplitButton({ label: 'Split' })
  split.on('clicked', toast('Split button clicked'))
  groupedBox.append(split)
  grouped.add(groupedBox)

  return scrolled
}

/* ----- Controls: plain GTK input widgets, Adwaita-styled ----- */
function buildControlsPage() {
  const { scrolled, column } = makePage()

  const group = new Adw.PreferencesGroup({ title: 'Controls' })
  column.append(group)

  const scale = new Gtk.Scale({ orientation: Gtk.Orientation.HORIZONTAL, hexpand: true, 'draw-value': true })
  scale.setRange(0, 100)
  scale.setValue(35)
  group.add(wrapControl('Scale', scale))

  const sw = new Gtk.Switch({ active: true, valign: Gtk.Align.CENTER, halign: Gtk.Align.START })
  group.add(wrapControl('Switch', sw))

  const level = new Gtk.LevelBar({ hexpand: true, valign: Gtk.Align.CENTER })
  level.setValue(0.7)
  group.add(wrapControl('Level Bar', level))

  const dropdown = Gtk.DropDown.newFromStrings(['One', 'Two', 'Three'])
  dropdown.setValign(Gtk.Align.CENTER)
  group.add(wrapControl('Drop Down', dropdown))

  const spinner = new Gtk.Spinner({ spinning: true, valign: Gtk.Align.CENTER, halign: Gtk.Align.START })
  group.add(wrapControl('Spinner', spinner))

  // A radio group via linked check buttons.
  const radioBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12, valign: Gtk.Align.CENTER })
  const first = new Gtk.CheckButton({ label: 'A', active: true })
  const second = new Gtk.CheckButton({ label: 'B', group: first })
  const third = new Gtk.CheckButton({ label: 'C', group: first })
  radioBox.append(first)
  radioBox.append(second)
  radioBox.append(third)
  group.add(wrapControl('Radio Group', radioBox))

  return scrolled
}

/* Put a label and a control side by side inside an Adw.ActionRow. */
function wrapControl(title, control) {
  const row = new Adw.ActionRow({ title })
  control.setHexpand(true)
  control.setHalign(control instanceof Gtk.Scale || control instanceof Gtk.LevelBar ? Gtk.Align.FILL : Gtk.Align.END)
  row.addSuffix(control)
  return row
}

/* ----- Feedback: banners, toasts and status pages ----- */
function buildFeedbackPage(toastOverlay) {
  const { scrolled, column } = makePage(12)

  // A banner is a full-width, dismissible notification strip.
  const banner = new Adw.Banner({ title: 'This is an Adw.Banner', 'button-label': 'Dismiss', revealed: true })
  banner.on('button-clicked', () => banner.setRevealed(false))
  column.append(banner)

  const group = new Adw.PreferencesGroup({ title: 'Toasts' })
  column.append(group)

  const simpleRow = new Adw.ActionRow({ title: 'Simple toast' })
  const simpleButton = new Gtk.Button({ label: 'Show', valign: Gtk.Align.CENTER })
  simpleButton.on('clicked', () => toastOverlay.addToast(new Adw.Toast({ title: 'Hello from a toast!' })))
  simpleRow.addSuffix(simpleButton)
  group.add(simpleRow)

  const actionRow = new Adw.ActionRow({ title: 'Toast with an action' })
  const actionButton = new Gtk.Button({ label: 'Show', valign: Gtk.Align.CENTER })
  actionButton.on('clicked', () => {
    const t = new Adw.Toast({ title: 'File deleted', 'button-label': 'Undo' })
    t.on('button-clicked', () => toastOverlay.addToast(new Adw.Toast({ title: 'Restored' })))
    toastOverlay.addToast(t)
  })
  actionRow.addSuffix(actionButton)
  group.add(actionRow)

  // A small status page — the empty/placeholder pattern.
  const status = new Adw.StatusPage({
    'icon-name': 'emblem-ok-symbolic',
    title: 'Status Page',
    description: 'Used for empty states and placeholders.',
    vexpand: true,
  })
  column.append(status)

  return scrolled
}

/* ----- Avatars: Adw.Avatar at a few sizes ----- */
function buildAvatarsPage() {
  const { scrolled, column } = makePage()

  const group = new Adw.PreferencesGroup({ title: 'Avatars', description: 'Initials are generated from the text' })
  column.append(group)

  const box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 18, halign: Gtk.Align.CENTER, 'margin-top': 6 })
  for (const [size, text] of [[48, 'Ada Lovelace'], [72, 'Alan Turing'], [96, 'Grace Hopper']]) {
    box.append(new Adw.Avatar({ size, text, 'show-initials': true }))
  }
  group.add(box)

  return scrolled
}

function onQuit() {
  loop.quit()
  app.quit()
  return false
}
