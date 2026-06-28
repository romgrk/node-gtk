/*
 * style-manager.styles.mjs
 *
 * Inline CSS registered with styles.add(). This module's top level does nothing
 * but register styles, so node-gtk/styles can safely re-execute it on every
 * edit — change a value below while the app runs and it updates live.
 *
 * (Contrast with style-manager.mjs, which creates the window and runs the loop:
 * never put hot-reloadable inline CSS there, or a reload would re-run all of it.)
 */
import { styles } from 'node-gtk/styles'

styles.add(`
  .headline {
    font-size: 20px;
    font-weight: bold;
  }

  button.accent {
    background: #3584e4;
    color: white;
  }
`)
