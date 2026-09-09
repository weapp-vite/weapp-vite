Component({
  data: {
    count: 0,
    result: 'ready',
  },
  methods: {
    increment() {
      this.setData({ count: this.data.count + 1, result: 'step:1' })
    },
  },
})
