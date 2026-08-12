Component({
  properties: {
    value: {
      type: Number,
      value: 0,
    },
  },
  data: {
    current: 0,
  },
  observers: {
    value(value: number) {
      this.setData({ current: value })
    },
  },
  methods: {
    increase() {
      const value = this.data.current + 1
      this.setData({ current: value })
      this.triggerEvent('change', { value })
    },
  },
})
