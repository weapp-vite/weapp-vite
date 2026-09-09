Page({
  data: { override: false, state: 'initial' },
  toggle() {
    const override = !this.data.override
    this.setData({ override, state: override ? 'updated' : 'initial' })
  },
})
