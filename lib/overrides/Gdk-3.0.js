/*
 * Gdk-3.0.js
 */

const gi = require('../../lib/index.js')
const internal = require('../native.js')

exports.apply = (Gdk) => {

  defineKeyProperty('shiftKey', Gdk.ModifierType.SHIFT_MASK)
  defineKeyProperty('ctrlKey',  Gdk.ModifierType.CONTROL_MASK)
  defineKeyProperty('altKey',   Gdk.ModifierType.MOD1_MASK)
  defineKeyProperty('superKey', Gdk.ModifierType.SUPER_MASK)
  defineKeyProperty('metaKey',  Gdk.ModifierType.META_MASK)

  function defineKeyProperty(name, value) {
    Object.defineProperty(Gdk.EventKey.prototype, name, {
      get: function() {
        return (this.state & value) !== 0
      }
    })
  }
}

