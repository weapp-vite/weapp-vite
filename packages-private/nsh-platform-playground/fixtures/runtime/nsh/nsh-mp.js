// The Mini Program's side of nsh-platform-miniprogram, in the logic layer:
// loads the app's WebAssembly module (the engine and the app, NSH's core
// in Rust), gives it what it imports, runs it when it asks (`schedule`,
// `request_frame`), applies each commit to the tree the page draws
// (`tree.js`, `setData`) and hands the user's taps back as events.
//
// `start(page)` runs the app in `page`, a `Page` whose data has `root`
// (`pages/index/index.js`). Everything the Mini Program provides comes
// through `host`, so tests run it on Node with stand-ins.

'use strict'

const { Tree, ROOT_ID, STATE_PRESSED, STATE_FOCUSED } = require('./tree.js')
const canvases = require('./canvas.js')

/** The module the runner builds, in the package (brotli-compressed). */
const WASM_PATH = '/nsh/app.wasm.br'

function utf8Decode(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++]
    let cp
    if (b < 0x80) cp = b
    else if (b < 0xe0) cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f)
    else if (b < 0xf0) cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
    else
      cp =
        ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)
    out += String.fromCodePoint(cp)
  }
  return out
}

function utf8Encode(text) {
  const out = []
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp < 0x80) out.push(cp)
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    else
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
  }
  return Uint8Array.from(out)
}

/** The Mini Program's APIs this runtime uses. */
function wxHost() {
  /* global wx, WXWebAssembly */
  const canvas = wx.createOffscreenCanvas({ type: '2d', width: 1, height: 1 })
  const context = canvas.getContext('2d')
  const started = Date.now()
  return {
    instantiate: (path, imports) => WXWebAssembly.instantiate(path, imports),
    measure(font, text) {
      context.font = font
      return context.measureText(text).width
    },
    device() {
      const info = wx.getWindowInfo()
      const theme = wx.getAppBaseInfo ? wx.getAppBaseInfo().theme : 'light'
      const device = wx.getDeviceInfo ? wx.getDeviceInfo() : {}
      return {
        width: info.windowWidth,
        height: info.windowHeight,
        pixelRatio: info.pixelRatio,
        dark: theme === 'dark',
        os: osOf(device.platform, device.system),
      }
    },
    // Each returns a function that stops listening.
    onThemeChange: (f) => {
      if (!wx.onThemeChange) return () => {}
      wx.onThemeChange(f)
      return () => wx.offThemeChange && wx.offThemeChange(f)
    },
    onResize: (f) => {
      if (!wx.onWindowResize) return () => {}
      wx.onWindowResize(f)
      return () => wx.offWindowResize && wx.offWindowResize(f)
    },
    now: () => Date.now() - started,
    setTimeout: (f, ms) => setTimeout(f, ms),
    clearTimeout: (t) => clearTimeout(t),
    navigateTo: (url) => new Promise((resolve) => wx.navigateTo({ url, complete: resolve })),
    navigateBack: (delta) => new Promise((resolve) => wx.navigateBack({ delta, complete: resolve })),
    setTitle: (title) => wx.setNavigationBarTitle({ title }),
    // One canvas for every drawing: each is drawn, read and shown at once.
    offscreenCanvas: (() => {
      let canvas = null
      return () => canvas || (canvas = wx.createOffscreenCanvas({ type: '2d', width: 1, height: 1 }))
    })(),
    error: (message) => console.error(message),
    log: (level, message) => (level <= 2 ? console.warn(message) : console.log(message)),
  }
}

/**
 * NSH's OS of `wx.getDeviceInfo()`'s `platform` (`ios`, `android`, `mac`,
 * `windows`, `ohos`, ...; `devtools` in WeChat DevTools, whose `system`
 * names the simulated device's, `"iOS 17.0"`).
 */
function osOf(platform = '', system = '') {
  const name = platform === 'devtools' ? system.split(' ')[0].toLowerCase() : platform
  if (name === 'android' || name === 'ohos') return 'android'
  if (name === 'mac' || name === 'macos') return 'macos'
  if (name === 'windows') return 'windows'
  if (name === 'linux') return 'linux'
  return 'ios'
}

/** The code of an OS for the module (`ffi.rs`, `os_of`). */
const OS_CODES = { ios: 0, android: 1, macos: 2, windows: 3, linux: 4 }

/** Seconds east of UTC of local time at `ms` (NSH's `local_offset`). */
function localOffset(ms) {
  return -new Date(ms).getTimezoneOffset() * 60
}

/**
 * Starts the app in `page`; resolves to the running app (`event`,
 * `scroll`, `stop`).
 */
function start(page, host = wxHost(), path = WASM_PATH) {
  const tree = new Tree()
  let exports = null
  let pumpTimer = null
  let frameTimer = null
  let stopped = false
  // What the batches of one turn change, sent to the render layer in one
  // `setData` when the turn ends: a pump commits several batches, and each
  // `setData` crosses to the render layer.
  const ratio = host.device().pixelRatio || 2
  let flushQueued = false
  // The Mini Program's pages: the root's (`page`), then one per screen
  // pushed over a stack's first (`Tree.pages`), by the screen's id once it
  // loaded (`attach`). `opened`: the pushed screens the Mini Program
  // navigated to, bottom to top; `leaving`: the ones the app popped, whose
  // pages are going back.
  const pages = new Map([[ROOT_ID, page]])
  const opened = []
  const leaving = new Set()
  // Screens the user went back from, until the app removes them: never
  // navigated to again meanwhile.
  const dismissed = new Set()
  let navigating = Promise.resolve()
  const top = () => pages.get(opened.length ? opened[opened.length - 1] : ROOT_ID)
  // The root's page draws the root's views itself: only modals are over
  // it; a pushed screen's page draws every overlay.
  const showOverlays = (target) => {
    if (target) target.setData({ ov: target === page ? tree.modals : tree.overlays() })
  }
  // Pages follow the app's stacks: screens pushed are navigated to, the
  // ones it popped are gone back from (in order, one navigation at a time).
  const syncPages = () => {
    const all = tree.pages()
    const live = new Set(all)
    for (const id of dismissed) if (!live.has(id)) dismissed.delete(id)
    const want = all.filter((id) => !dismissed.has(id))
    let common = 0
    while (common < opened.length && common < want.length && opened[common] === want[common]) common++
    const back = opened.length - common
    if (back > 0) {
      const gone = opened.splice(common, back)
      for (const id of gone) leaving.add(id)
      navigating = navigating.then(() => host.navigateBack(back))
    }
    for (const id of want.slice(common)) {
      opened.push(id)
      navigating = navigating.then(() => host.navigateTo(`/pages/index/index?screen=${id}`))
    }
  }
  const flush = () => {
    flushQueued = false
    if (stopped) return
    const { pages: changes, overlays, titles } = tree.take()
    for (const [id, data] of changes) {
      const target = pages.get(id)
      if (target && Object.keys(data).length > 0) target.setData(data)
    }
    if (overlays) showOverlays(top())
    const topId = opened.length ? opened[opened.length - 1] : null
    for (const [id, title] of titles) {
      // The navigation bar shows the top page's title.
      if (id === topId || (topId == null && !tree.isPage(id))) host.setTitle(title)
    }
    syncPages()
  }
  // A batch's operations: the tree takes them now, the pages at the end of
  // the turn (one setData per page however many batches came).
  const apply = (ops) => {
    tree.add(ops)
    if (tree.redraw.size > 0) {
      canvases.render(tree, tree.redraw, ratio, host.offscreenCanvas, (id, url) => tree.update(id, 'cv', url))
      tree.redraw.clear()
    }
    queueFlush()
  }
  const queueFlush = () => {
    if (!flushQueued) {
      flushQueued = true
      Promise.resolve().then(flush)
    }
  }
  const read = (ptr, len) => utf8Decode(new Uint8Array(exports.memory.buffer, ptr, len))
  const imports = {
    nsh: {
      now_ms: () => host.now(),
      date_now_ms: () => Date.now(),
      local_offset: localOffset,
    },
    nsh_mp: {
      submit(ptr, len) {
        apply(JSON.parse(read(ptr, len)))
      },
      request_frame() {
        if (frameTimer != null || stopped) return
        frameTimer = host.setTimeout(() => {
          frameTimer = null
          if (!stopped) exports.nsh_mp_frame()
        }, 16)
      },
      schedule(ms) {
        if (pumpTimer != null) host.clearTimeout(pumpTimer)
        pumpTimer = null
        if (ms < 0 || stopped) return
        pumpTimer = host.setTimeout(() => {
          pumpTimer = null
          if (!stopped) exports.nsh_mp_pump()
        }, Math.max(0, Math.ceil(ms)))
      },
      report_error: (ptr, len) => host.error(read(ptr, len)),
      measure_text: (fp, fl, tp, tl) => host.measure(read(fp, fl), read(tp, tl)),
      log: (level, ptr, len) => host.log(level, read(ptr, len)),
    },
  }
  const withString = (text, f) => {
    const bytes = utf8Encode(text)
    const ptr = exports.nsh_mp_alloc(bytes.length)
    new Uint8Array(exports.memory.buffer, ptr, bytes.length).set(bytes)
    try {
      f(ptr, bytes.length)
    } finally {
      exports.nsh_mp_free(ptr, bytes.length)
    }
  }
  const device = () => {
    const d = host.device()
    return [d.width, d.height, d.pixelRatio, d.dark ? 1 : 0, OS_CODES[d.os] || 0]
  }
  return host.instantiate(path, imports).then((result) => {
    exports = (result.instance || result).exports
    exports.nsh_mp_init()
    if (!exports.nsh_mp_start(...device())) throw new Error('the app did not start')
    const update = () => !stopped && exports.nsh_mp_device(...device())
    const unlisten = [host.onThemeChange(update), host.onResize(update)]
    const app = {
      tree,
      /** Applies operations as if a batch had sent them (tests). */
      apply,
      /** The page of pushed screen `id` loaded (`pages/index`): it shows
       * the screen, and the overlays while it is on top. */
      attach(target, id) {
        pages.set(id, target)
        const screen = tree.nodes.get(id)
        target.setData({ root: screen || { id, c: [] }, ov: tree.overlays() })
        if (screen && screen.title) host.setTitle(screen.title)
      },
      /** The page of pushed screen `id` unloaded: the user went back
       * (the navigation bar's back button, a swipe, Android's back), unless
       * the app popped it. */
      detach(id) {
        pages.delete(id)
        if (leaving.delete(id)) return
        const i = opened.indexOf(id)
        if (i >= 0) for (const gone of opened.splice(i)) dismissed.add(gone)
        else dismissed.add(id)
        this.event(id, 'onBackRequest')
        this.event(id, 'onDismiss')
      },
      /** An event on view `id`: `onPress`, `onPressIn`, `onPressOut`,
       * `onLongPress`, an input's `onFocus` and `onBlur`. */
      event(id, name) {
        // The user's focus changes are the field's own: `fo` follows them,
        // so the app's next `focus()` changes it again.
        if (name === 'onFocus' || name === 'onBlur') {
          tree.update(id, 'fo', name === 'onFocus')
          queueFlush()
          this.state(id, STATE_FOCUSED, name === 'onFocus')
        }
        if (name === 'onPressIn' || name === 'onPressOut') this.state(id, STATE_PRESSED, name === 'onPressIn')
        // Touches on a view that only tracks its pressed state.
        if (name === 'onPressIn' || name === 'onPressOut') {
          const node = tree.nodes.get(id)
          if (!node || !node.io) return
        }
        if (!stopped) withString(name, (ptr, len) => exports.nsh_mp_event(id, ptr, len))
      },
      /** Input `id`: the user edited it (`onChangeText`) or pressed its
       * return key (`onSubmitEditing`); `text` is its whole text. */
      text(id, name, text) {
        if (stopped) return
        const count = name === 'onChangeText' ? tree.edited(id, text) : tree.edits.get(id) || 0
        withString(name, (np, nl) =>
          withString(text, (tp, tl) => exports.nsh_mp_text(id, np, nl, tp, tl, count)),
        )
      },
      /** View `id` entered or left `state` (a `tailwind::state` bit). */
      state(id, state, on) {
        const states = tree.state(id, state, on)
        if (states != null && !stopped) exports.nsh_mp_states(id, states)
      },
      /** Scroll view `id` is at `(x, y)`. */
      scroll(id, x, y) {
        tree.scrolled(id, x, y)
        if (!stopped) exports.nsh_mp_scroll(id, x, y)
      },
      stop() {
        stopped = true
        for (const off of unlisten) if (typeof off === 'function') off()
        if (pumpTimer != null) host.clearTimeout(pumpTimer)
        if (frameTimer != null) host.clearTimeout(frameTimer)
        if (current === app) current = null
      },
    }
    current = app
    return app
  })
}

/** The running app, which the pages of pushed screens attach to. */
let current = null
const running = () => current

module.exports = { start, running, osOf, utf8Decode, utf8Encode }
