// What an NSH canvas draws (`["cv", id, ops]`, the backend's `canvas.rs`),
// replayed on the Mini Program's 2D canvas (`<canvas type="2d">`), as
// NSH's web runtime replays it on a browser's. The Mini Program's context
// has the browser's methods and properties but no `Path2D` and, on older
// base libraries, no `roundRect`: paths are built on the context itself.

'use strict'

/** A value of an op: a number, or `["$", slot]` (animated: 0 here). */
const num = (n) => (Array.isArray(n) && n[0] === '$' ? 0 : n)

function paint(cx, p) {
  if (Array.isArray(p) && p[0] === '$') return 'transparent'
  if (p && typeof p === 'object' && p.g) {
    const a = p.args
    let g
    if (p.g === 'linear') g = cx.createLinearGradient(a[0], a[1], a[2], a[3])
    else if (p.g === 'radial') g = cx.createRadialGradient(a[0], a[1], a[2], a[3], a[4], a[5])
    else if (cx.createConicGradient) g = cx.createConicGradient(a[0], a[1], a[2])
    else return p.stops.length ? p.stops[0][1] : 'transparent'
    for (const [offset, color] of p.stops) g.addColorStop(Math.min(1, Math.max(0, offset)), color)
    return g
  }
  return p
}

/** A rounded rectangle as a path, where the context has no `roundRect`. */
function roundRect(cx, x, y, w, h, radii) {
  if (cx.roundRect) return cx.roundRect(x, y, w, h, radii)
  const r = radii.length ? radii : [0]
  const [tl, tr = tl, br = tl, bl = tr] = r.map((v) => Math.min(Math.abs(v), Math.abs(w) / 2, Math.abs(h) / 2))
  cx.moveTo(x + tl, y)
  cx.arcTo(x + w, y, x + w, y + h, tr)
  cx.arcTo(x + w, y + h, x, y + h, br)
  cx.arcTo(x, y + h, x, y, bl)
  cx.arcTo(x, y, x + w, y, tl)
  cx.closePath()
}

function pathOp(cx, name, args) {
  if (name === 'roundRect') roundRect(cx, ...args.slice(0, 4).map(num), args[4].map(num))
  else if (typeof cx[name] === 'function') cx[name](...args.map(num))
}

/** Replaces the current path with `ops` (an op's own path). */
function path(cx, ops) {
  cx.beginPath()
  for (const [name, ...args] of ops) pathOp(cx, name, args)
}

/**
 * Draws `ops` on `canvas` (a `<canvas type="2d">` node) at `width` ×
 * `height` px, `ratio` device pixels per px.
 */
function draw(canvas, ops, width, height, ratio) {
  const pw = Math.max(1, Math.round(width * ratio))
  const ph = Math.max(1, Math.round(height * ratio))
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw
    canvas.height = ph
  }
  const cx = canvas.getContext('2d')
  cx.setTransform(ratio, 0, 0, ratio, 0, 0)
  cx.clearRect(0, 0, width, height)
  cx.save()
  for (const [name, ...args] of ops) {
    try {
      if (name.startsWith('=')) {
        const prop = name.slice(1)
        cx[prop] = prop.endsWith('Style') ? paint(cx, args[0]) : num(args[0])
      } else if (name === 'fill' || name === 'clip') {
        if (args[0]) path(cx, args[0])
        cx[name](args[1])
      } else if (name === 'stroke') {
        if (args[0]) path(cx, args[0])
        cx.stroke()
      } else if (name === 'shadowOffset') {
        cx.shadowOffsetX = args[0]
        cx.shadowOffsetY = args[1]
      } else if (name === 'setTransform') {
        // The drawing's transform is in px: the device's ratio goes first.
        const [a, b, c, d, e, f] = args.map(num)
        cx.setTransform(a * ratio, b * ratio, c * ratio, d * ratio, e * ratio, f * ratio)
      } else if (name === 'fillText' || name === 'strokeText') {
        cx[name](args[0], ...args.slice(1).map(num))
      } else if (name === 'setLineDash') {
        cx.setLineDash(args[0])
      } else if (name === 'drawImage') {
        // Images on canvases: not drawn yet (the README's "Status").
      } else {
        pathOp(cx, name, args)
      }
    } catch (err) {
      console.warn('[nsh] canvas', name, err)
    }
  }
  cx.restore()
}

/**
 * Draws the changed drawings (`ids`) of `tree` and gives each as a PNG
 * data URL to `show(id, url)`. Drawn on one offscreen canvas in the logic
 * layer and shown as an image: an image is placed and scrolled as every
 * other view is, where a `<canvas>` is a layer of its own.
 */
function render(tree, ids, ratio, makeCanvas, show) {
  if (!makeCanvas) return
  for (const id of ids) {
    const node = tree.nodes.get(id)
    const ops = tree.drawings.get(id)
    if (!node || !ops) continue
    const [, , width, height] = node.f
    if (width <= 0 || height <= 0) continue
    const canvas = makeCanvas()
    draw(canvas, ops, width, height, ratio)
    show(id, canvas.toDataURL('image/png'))
  }
}

module.exports = { draw, paint, roundRect, render }
