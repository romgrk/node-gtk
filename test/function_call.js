/*
 * function_call.js
 */

const mocha = require('mocha');
// const {describe, before, it} = mocha;
const assert = require('chai').assert;

const gi = require('../')

// const GI = gi.require('GIRepository', '2.0');
const Gtk = gi.require('Gtk', '3.0');
const Gdk = gi.require('Gdk', '3.0');

describe('Function invoking', function () {
    beforeEach(function () {
    });

    it('supports INOUT parameters', function() {
        Gtk.init.debug = true;
        //var ret = Gtk.init(['abc', 'dev']);
        var ret = Gtk.init();
        assert.isArray(ret);
        assert.lengthOf(ret, 0);
    });

    it('fills caller-allocated arguments', function () {
        var buf = new Gtk.TextBuffer();
        var i = buf.getStartIter(/* TextIter */);
        assert.equal(i.__proto__, Gtk.TextIter.prototype);
        assert.isTrue(i instanceof Gtk.TextIter);
    });

    it('throws when missing essential arguments', function () {
        var has_thrown = false;
        try {
            Gtk.accelerator_get_label();
        } catch (err) {
            has_thrown = true;
        }
        assert.isTrue(has_thrown, 'gtk_accelerator_get_label hasnt thrown');
    });

    it('ignores excess arguments', function () {
        var keyval = 106;
        var modifiers = Gdk.ModifierType.SHIFT_MASK;

        var res = Gtk.accelerator_get_label(keyval, modifiers, 'more', 10);

        assert.equal(res, 'Shift+J');
    });

});

