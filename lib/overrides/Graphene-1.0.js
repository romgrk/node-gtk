/*
 * Graphene-1.0.js
 */


exports.apply = (Graphene) => {

  /**
   * Graphene.Rect.create
   * Creates a new Rect with the given values
   * @param {number} x
   * @param {number} y
   * @param {number} width
   * @param {number} height
   */
  Graphene.Rect.create = function create(x, y, width, height) {
    const r = new Graphene.Rect()
    r.init(x, y, width, height)
    return r
  }

  /**
   * Graphene.Point.create
   * Creates a new Point with the given values
   * @param {number} x
   * @param {number} y
   */
  Graphene.Point.create = function create(x, y) {
    const r = new Graphene.Point()
    r.init(x, y)
    return r
  }
}

