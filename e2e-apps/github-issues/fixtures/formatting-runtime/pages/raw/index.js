Page({
  data: {
    count: 0,
    visible: true,
    label: 'alpha',
    selected: '',
    bubbled: 0,
    caught: 0,
    items: [{ id: 'first', name: 'One' }, { id: 'second', name: 'Two' }],
  },
  increment() {
    this.setData({ count: this.data.count + 1, label: 'beta' })
  },
  onBubble() {
    this.setData({ bubbled: this.data.bubbled + 1 })
  },
  onCatch() {
    this.setData({ caught: this.data.caught + 1 })
  },
  select(event) {
    this.setData({ selected: event.currentTarget.dataset.id })
  },
  toggle() {
    this.setData({ visible: !this.data.visible })
  },
})
