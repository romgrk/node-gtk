import { renderNode, render } from './render'
import {writeFileSync} from 'fs'
import { extractObjects } from './inspect'

const {library} =extractObjects('Gtk')
writeFileSync('tmp.ts', render({target: {Gtk: library}}))
writeFileSync('tmp.json', JSON.stringify(library.splice(0,5), null, 2))