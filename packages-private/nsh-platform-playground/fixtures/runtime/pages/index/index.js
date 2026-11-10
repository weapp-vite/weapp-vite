// A page of the NSH app. The first shows NSH's root view, and starts the
// app (`nsh/nsh-mp.js`), which keeps `root` up to date; each screen the
// app pushes over a stack's first opens this page again with the screen's
// id (`?screen=`), showing that screen, so the Mini Program's navigation
// bar, back button and gestures go back from it. The top page also shows
// the views over the app in the root (`ov`: popups, modals). Taps and
// scrolls of the views come back as `nsh` events of the `nsh-node`
// components.
const { start, running } = require('../../nsh/nsh-mp.js')

Page({
  data: { root: { id: 1, c: [] }, ov: [], screen: false },

  onLoad(query) {
    if (query && query.screen) {
      this.screen = Number(query.screen)
      this.app = running()
      this.setData({ screen: true })
      if (this.app) this.app.attach(this, this.screen)
      return
    }
    start(this)
      .then((app) => {
        this.app = app
      })
      .catch((error) => console.error('nsh: the app did not start', error))
  },

  onUnload() {
    if (!this.app) return
    if (this.screen != null) this.app.detach(this.screen)
    else this.app.stop()
  },

  onNsh(e) {
    if (!this.app) return
    const { kind, id, x, y, text } = e.detail
    if (kind === 'scroll') this.app.scroll(id, x, y)
    else if (kind === 'onChangeText' || kind === 'onSubmitEditing') this.app.text(id, kind, text)
    else this.app.event(id, kind)
  },
})
