Component({
  data: { count: 0 },
  methods: {
    increment() {
      this.setData({ count: this.data.count + 1 })
    },
  },
})
export const nativeLabel = 'Native library'
