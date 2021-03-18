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
}

