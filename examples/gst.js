const gi = require('../lib/')
const GLib = gi.require('GLib', '2.0')
const Gst = gi.require('Gst', '1.0')

gi.startLoop()
Gst.init()

const loop = GLib.MainLoop.new(null, false)

const gstVersion = Gst.version()
console.log(`GStreamer Version: ${gstVersion[0]}.${gstVersion[1]}.${gstVersion[2]}`)

const pipeline = new Gst.Pipeline("pipeline1")

const bus = pipeline.getBus()
bus.addWatch(0, (bus, msg) => {
    switch (msg.type) {
        case Gst.MessageType.EOS:
            console.log("Got EOS")
            loop.quit()
            break
        case Gst.MessageType.ERROR:
            const [err, dbg] = msg.parseError()
            console.log("Got error: " + err.message + " (dbg: " + dbg + ")")
            loop.quit()
            break
        default:
            break
    }

    return true
})

const src = Gst.ElementFactory.make("videotestsrc", "src1")
const sink = Gst.ElementFactory.make("autovideosink", "sink1")

pipeline.add(src)
pipeline.add(sink)
src.link(sink)

src.setProperty('num-buffers', 100)

console.log("Built pipeline: " + src.getName() + " -> " + sink.getName())

if (pipeline.setState(Gst.State.PLAYING) == Gst.StateChangeReturn.Failure) {
    console.error("Failed to change pipeline state")
    return
}

loop.run()
