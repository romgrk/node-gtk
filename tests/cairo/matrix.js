/*
 * matrix.js
 */


const gi = require('../../lib/')
const Cairo = gi.require('cairo')
const { describe, it } = require('../__common__.js')

gi.startLoop()

describe('Matrix:', () => {
  it('new Matrix()', () => {
    const matrix = new Cairo.Matrix(1, 2, 3, 4, 5, 6)
  })

  it('initXxxx()', () => {
    let matrix
    matrix = Cairo.Matrix.initIdentity()
    matrix = Cairo.Matrix.initTranslate(50, 50)
    matrix = Cairo.Matrix.initScale(2.0, 3.5)
    matrix = Cairo.Matrix.initRotate(2.5 * Math.PI)
  })

  it('other instance methods', () => {
    const matrix = Cairo.Matrix.initIdentity()

    matrix.translate(50, 25);
    matrix.scale (2.0, 3.5);
    matrix.rotate (1.5 * Math.PI);
    const status = matrix.invert ();

    let distance = matrix.transformDistance(10, 20);
    let point = matrix.transformPoint(20, 30);

    const other = new Cairo.Matrix(1, 2, 3, 4, 5, 6)
    const result = Cairo.Matrix.multiply(matrix, other)

    console.log({ status, distance, point, result })
  })

})
