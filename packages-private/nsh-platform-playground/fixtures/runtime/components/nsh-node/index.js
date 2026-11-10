// One view of the NSH app at the frame the engine laid it out at
// (`node.f`), with its decoration (`node.s`), its drawing (`node.cv`, a
// picture), its text's lines (`node.t`), an input's field (`node.in`)
// and its children: this component again
// (`index.json`). Taps on views that take presses and scrolls of scroll
// views go to the page as `nsh` events, which bubble across the
// components' boundaries (`composed`) to the page's one listener.

Component({
  options: { addGlobalClass: false },
  // `page`: the root of a pushed screen's page, at the page's origin.
  properties: { node: Object, page: Boolean },
  methods: {
    send(detail) {
      this.triggerEvent('nsh', detail, { bubbles: true, composed: true })
    },
    onTap() {
      this.send({ kind: 'onPress', id: this.data.node.id })
    },
    onLongPress() {
      this.send({ kind: 'onLongPress', id: this.data.node.id })
    },
    onTouchStart() {
      this.send({ kind: 'onPressIn', id: this.data.node.id })
    },
    onTouchEnd() {
      this.send({ kind: 'onPressOut', id: this.data.node.id })
    },
    onInput(e) {
      this.send({ kind: 'onChangeText', id: this.data.node.id, text: e.detail.value })
    },
    onConfirm(e) {
      this.send({ kind: 'onSubmitEditing', id: this.data.node.id, text: e.detail.value })
    },
    onFocus() {
      this.send({ kind: 'onFocus', id: this.data.node.id })
    },
    onBlur() {
      this.send({ kind: 'onBlur', id: this.data.node.id })
    },
    onScroll(e) {
      this.send({ kind: 'scroll', id: this.data.node.id, x: e.detail.scrollLeft, y: e.detail.scrollTop })
    },
  },
})
