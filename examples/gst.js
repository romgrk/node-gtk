const gi = require('../lib/')
const Gst = gi.require('Gst', '1.0')
const Gtk = gi.require('Gtk', '3.0')

gi.startLoop()
Gst.init()

const gstVersion = Gst.version()
console.log(`Gstreamer Version: ${gstVersion[0]}.${gstVersion[1]}.${gstVersion[2]}`)

var pipeline = new Gst.Pipeline("pipeline1")

pipeline.on('child-added', (element, name) => {
    console.log('child-added:', element, name)
})

var src = Gst.ElementFactory.make("videotestsrc", "src1")
var sink = Gst.ElementFactory.make("autovideosink", "sink1")

pipeline.add(src)
pipeline.add(sink)
src.link(sink)

console.log(src.getName(), sink.getName())

pipeline.setState(Gst.State.PLAYING)

let pattern = true
setInterval(() => {
    // TODO Add support for setting unintrospectable properties like below
    // gi.setProperty(src, 'pattern', pattern ? 1 : 0)
    pattern = !pattern
}, 1000);

// TODO: fix so we don't need Gtk for the loop
Gtk.main()
