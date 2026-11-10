// The tree of views the render layer draws, kept in the logic layer as
// plain objects, and the `setData` paths that bring the render layer up to
// date after each batch of operations (`crates/nsh-platform-miniprogram/
// src/encode.rs` lists them).
//
// A node is `{ id, k, f, s, p, io, t, h, cs, im, c }`: its kind, frame
// `[x, y, width, height]`, inline CSS, whether it takes presses (`p`) and
// press in / out (`io`), its text, a scroll view's axis and content size,
// an image, its drawing as a picture (`cv`, a PNG data URL), and its children in drawing order (the last on top). The page's
// data is `{ root }`, the node of NSH's root view.

'use strict'

/** NSH's root view (`nsh_core::ROOT_ID`). */
const ROOT_ID = 1

/** Where modals are drawn: over the top page (`overlays`). */
const MODALS = 'modals'

/** The bits of op `e` (`encode::events`). */
const PRESS = 1
const PRESS_IN_OUT = 2
const LONG_PRESS = 4

/** `nsh_core::tailwind::state` bits the field reports. */
const STATE_PRESSED = 1
const STATE_FOCUSED = 4

function node(id, kind) {
  return { id, k: kind, f: [0, 0, 0, 0], s: '', p: false, io: false, lp: false, t: null, h: false, cs: null, im: null, cv: null, c: [] }
}

class Tree {
  constructor() {
    this.root = node(ROOT_ID, 'view')
    this.nodes = new Map([[ROOT_ID, this.root]])
    // Kept apart from the nodes, which `setData` copies whole.
    this.parents = new Map()
    // What canvases draw (`cv`): drawn in the logic layer, never sent to
    // the render layer, whose nodes only say they have one (`cv: true`).
    this.drawings = new Map()
    /** The states the core tracks by view (`tailwind::state` bits), and
     * the ones each view shows. */
    this.tracked = new Map()
    this.states = new Map()
    /** Inputs' edits by the user (counts) and the text each shows. */
    this.edits = new Map()
    this.typed = new Map()
    /** Scroll views' offsets, as last scrolled. */
    this.offsets = new Map()
    // Canvases whose drawing changed in the last batch.
    this.redraw = new Set()
    // A stack's screens, bottom to top. The stack's node shows only the
    // first: each screen over it is the root of a page of its own
    // (`pages`), which the Mini Program pushes with its navigation.
    this.screens = new Map()
    // Modals (dialogs, sheets), wherever the app placed them: shown over
    // the top page, as the native platforms show them in a window of
    // their own, never inside the view that holds them.
    this.modals = []
  }

  /** Whether `id` is a screen pushed over its stack's first: a page root. */
  isPage(id) {
    const parentId = this.parents.get(id)
    const screens = parentId != null && this.screens.get(parentId)
    return !!screens && screens.findIndex((n) => n.id === id) > 0
  }

  /** The pages over the root's, bottom to top: pushed screens' ids. */
  pages() {
    const out = []
    const visit = (n) => {
      const screens = this.screens.get(n.id)
      if (screens) {
        screens.forEach((screen, i) => {
          if (i > 0) out.push(screen.id)
          visit(screen)
        })
        return
      }
      for (const child of n.c) visit(child)
    }
    visit(this.root)
    return out
  }

  /** The views over the app's content in the root (overlays, modals),
   * which the top page shows. */
  overlays() {
    return this.root.c.slice(1).concat(this.modals)
  }

  /**
   * Applies one batch's operations; returns the `setData` object that
   * updates the render layer (empty when nothing it shows changed).
   */
  apply(ops) {
    this.add(ops)
    return this.take().pages.get(ROOT_ID) || {}
  }

  /**
   * Applies one batch's operations, keeping what changed for `take`: the
   * batches of a turn go to the render layer together, with paths
   * computed once the tree is as the last one left it.
   */
  add(ops) {
    // Nodes whose children changed, and nodes whose own fields changed
    // (field names by id).
    if (!this.changes) this.changes = { structure: new Set(), fields: new Map() }
    const { structure, fields } = this.changes
    const touch = (id, field) => {
      if (!fields.has(id)) fields.set(id, new Set())
      fields.get(id).add(field)
    }
    for (const op of ops) {
      const id = op[1]
      switch (op[0]) {
        case 'c':
          this.nodes.set(id, node(id, op[2]))
          break
        case 'i': {
          const parent = this.nodes.get(id)
          const child = this.nodes.get(op[2])
          if (!parent || !child) break
          this.detach(child, structure)
          if (child.k === 'modal') {
            this.modals.push(child)
            this.parents.set(child.id, parent.id)
            structure.add(MODALS)
            break
          }
          const list = parent.k === 'stack' ? this.stackScreens(parent.id) : parent.c
          const before = op[3] == null ? -1 : list.findIndex((n) => n.id === op[3])
          if (before < 0) list.push(child)
          else list.splice(before, 0, child)
          this.parents.set(child.id, parent.id)
          if (parent.k === 'stack') parent.c = list.slice(0, 1)
          structure.add(parent.id)
          break
        }
        case 'r': {
          const child = this.nodes.get(id)
          if (child) this.detach(child, structure)
          break
        }
        case 'd': {
          const child = this.nodes.get(id)
          if (child) this.detach(child, structure)
          this.nodes.delete(id)
          this.drawings.delete(id)
          this.offsets.delete(id)
          this.edits.delete(id)
          this.tracked.delete(id)
          this.states.delete(id)
          this.typed.delete(id)
          fields.delete(id)
          break
        }
        case 'f':
          this.set(id, 'f', [op[2], op[3], op[4], op[5]], touch)
          if (this.drawings.has(id)) this.redraw.add(id)
          break
        case 's':
          this.set(id, 's', op[2], touch)
          break
        case 't':
          this.set(id, 't', op[2], touch)
          break
        case 'e': {
          const bits = op[2]
          this.set(id, 'p', (bits & PRESS) !== 0, touch)
          this.set(id, 'io', (bits & PRESS_IN_OUT) !== 0, touch)
          this.set(id, 'lp', (bits & LONG_PRESS) !== 0, touch)
          break
        }
        case 'sc':
          this.set(id, 'h', op[2], touch)
          break
        case 'ss':
          this.set(id, 'cs', [op[2], op[3]], touch)
          break
        case 'ts': {
          // States the core tracks: the field reports presses (`tp`); the
          // runtime reports an input's focus.
          this.tracked.set(id, op[2])
          this.set(id, 'tp', (op[2] & STATE_PRESSED) !== 0, touch)
          break
        }
        case 'in':
          this.set(id, 'in', op[2], touch)
          break
        case 'iv': {
          // A value the app set before the user's latest edit is stale; one
          // equal to what the field shows is not sent again (which would
          // move the caret).
          const [, , text, count] = op
          if (count < (this.edits.get(id) || 0)) break
          if (this.typed.get(id) === text) break
          this.typed.set(id, text)
          this.set(id, 'v', text, touch)
          break
        }
        case 'ic':
          this.set(id, 'ic', [op[2], op[3], op[4], op[5]], touch)
          break
        case 'fo':
          this.set(id, 'fo', op[2], touch)
          break
        case 'a':
          // Animated properties, over the style's.
          this.set(id, 'a', op[2], touch)
          break
        case 'st':
          this.scrollTo(id, op[2], op[3], op[4], touch)
          break
        case 'sb': {
          const [x, y] = this.offsets.get(id) || [0, 0]
          this.scrollTo(id, x + op[2], y + op[3], false, touch)
          break
        }
        case 'cv':
          this.drawings.set(id, op[2])
          this.redraw.add(id)
          break
        case 'scr': {
          const screen = this.nodes.get(id)
          if (!screen) break
          const config = op[2]
          this.set(id, 'title', config.title || '', touch)
          // The page's `header` slot, which the core lays out at its top:
          // drawn in the screen, over its content.
          const header = config.header != null ? this.nodes.get(config.header) : null
          if (header && this.parents.get(header.id) !== id) {
            this.detach(header, structure)
            screen.c.push(header)
            this.parents.set(header.id, id)
            structure.add(id)
          }
          break
        }
        case 'im':
          this.set(id, 'im', op[2] == null ? null : { src: op[2], mode: op[3] }, touch)
          break
        default:
          break
      }
    }
  }

  /** View `id` is (or no longer is) in `state` (a bit): the new states
   * to report, or null when the core does not track it or nothing changed. */
  state(id, state, on) {
    if (((this.tracked.get(id) || 0) & state) === 0) return null
    const old = this.states.get(id) || 0
    const now = on ? old | state : old & ~state
    if (now === old) return null
    this.states.set(id, now)
    return now
  }

  /** The user edited input `id` to `text`: returns the edit's count. */
  edited(id, text) {
    const count = (this.edits.get(id) || 0) + 1
    this.edits.set(id, count)
    this.typed.set(id, text)
    return count
  }

  /** Scroll view `id` was scrolled to `(x, y)` (by the user or the app). */
  scrolled(id, x, y) {
    this.offsets.set(id, [x, y])
  }

  // A scroll view scrolls when its `scroll-top` / `scroll-left` change:
  // an offset equal to the one set last, after the user scrolled away from
  // it, is set a hair apart so it still changes.
  scrollTo(id, x, y, animated, touch) {
    const node = this.nodes.get(id)
    if (!node) return
    const last = node.so
    if (last && last[0] === x && last[1] === y) y += 0.01
    this.set(id, 'so', [x, y, !!animated], touch)
    this.offsets.set(id, [x, y])
  }

  /** Sets `field` of node `id` to `value` outside a batch (a canvas's
   * picture), for the next `take`. */
  update(id, field, value) {
    if (!this.changes) this.changes = { structure: new Set(), fields: new Map() }
    const { fields } = this.changes
    this.set(id, field, value, (i, f) => {
      if (!fields.has(i)) fields.set(i, new Set())
      fields.get(i).add(f)
    })
  }

  /** What changed since the last `take` (`paths`). */
  take() {
    const changes = this.changes
    this.changes = null
    return changes ? this.paths(changes.structure, changes.fields) : { pages: new Map(), overlays: false, titles: new Map() }
  }

  set(id, field, value, touch) {
    const n = this.nodes.get(id)
    if (!n) return
    n[field] = value
    touch(id, field)
  }

  stackScreens(id) {
    if (!this.screens.has(id)) this.screens.set(id, [])
    return this.screens.get(id)
  }

  detach(child, structure) {
    const parentId = this.parents.get(child.id)
    if (parentId == null) return
    if (child.k === 'modal') {
      const i = this.modals.indexOf(child)
      if (i >= 0) this.modals.splice(i, 1)
      this.parents.delete(child.id)
      structure.add(MODALS)
      return
    }
    const parent = this.nodes.get(parentId)
    if (parent) {
      const list = parent.k === 'stack' ? this.stackScreens(parent.id) : parent.c
      const i = list.indexOf(child)
      if (i >= 0) list.splice(i, 1)
      if (parent.k === 'stack') parent.c = list.slice(0, 1)
      structure.add(parent.id)
    }
    this.parents.delete(child.id)
  }

  /** The data path of node `id` in its page (`root.c[2].c[0]`), or null
   * when detached. */
  path(id) {
    const place = this.place(id)
    return place && place.path
  }

  /** The page node `id` is drawn in (the root's: `ROOT_ID`, or a pushed
   * screen's id) and its path there; null when detached. */
  place(id) {
    const steps = []
    let current = id
    while (current !== ROOT_ID && !this.isPage(current)) {
      const n = this.nodes.get(current)
      if (!n) return null
      if (n.k === 'modal') return { page: MODALS, path: null }
      const parentId = this.parents.get(current)
      if (parentId == null) return null
      const parent = this.nodes.get(parentId)
      const i = parent.c.findIndex((n) => n.id === current)
      if (i < 0) return null
      steps.push(i)
      current = parentId
    }
    return { page: current, path: 'root' + steps.reverse().map((i) => `.c[${i}]`).join('') }
  }

  /** Whether an ancestor of `id` (or `id` itself, `self`) sends its children whole. */
  covered(id, structure, self) {
    const own = this.nodes.get(id)
    if (!self && own && own.k === 'modal') return false
    if (!self && this.isPage(id)) return false
    let current = self ? id : this.parents.get(id)
    while (current != null) {
      if (structure.has(current)) return true
      // A page's root or a modal: what is above it is drawn elsewhere.
      if (this.isPage(current)) return false
      const n = this.nodes.get(current)
      if (n && n.k === 'modal') return false
      current = this.parents.get(current)
    }
    return false
  }

  /**
   * What changed as `setData` objects by page (`Map` of a page's root id:
   * `ROOT_ID` or a pushed screen's), whether the overlays changed
   * (`overlays`, which the top page shows), and the titles of screens
   * that changed (`titles`).
   */
  paths(structure, fields) {
    const pages = new Map()
    let overlays = false
    const titles = new Map()
    const put = (place, key, value) => {
      // In a modal: the overlays go whole.
      if (place.page === MODALS) {
        overlays = true
        return
      }
      if (!pages.has(place.page)) pages.set(place.page, {})
      pages.get(place.page)[`${place.path}${key}`] = value
      // Under the root's views but its first: an overlay.
      if (place.page === ROOT_ID && /^root\.c\[(\d+)\]/.test(place.path) && !place.path.startsWith('root.c[0]')) {
        overlays = true
      }
    }
    for (const id of structure) {
      if (id === ROOT_ID || id === MODALS) overlays = true
      if (id === MODALS) continue
      if (this.covered(id, structure, false)) continue
      const place = this.place(id)
      if (place != null) put(place, '.c', this.nodes.get(id).c)
    }
    for (const [id, names] of fields) {
      if (names.has('title')) titles.set(id, this.nodes.get(id).title)
      // Sent with a parent's children (`covered`): the node object is the
      // same one, already up to date.
      if (this.covered(id, structure, false)) continue
      const place = this.place(id)
      if (place == null) continue
      const n = this.nodes.get(id)
      for (const name of names) put(place, `.${name}`, n[name])
    }
    return { pages, overlays, titles }
  }
}

module.exports = { Tree, ROOT_ID, STATE_PRESSED, STATE_FOCUSED }
