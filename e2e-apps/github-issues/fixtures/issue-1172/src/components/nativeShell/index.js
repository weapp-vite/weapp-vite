Component({
  behaviors: ['wx://component-export'],
  options: { multipleSlots: true },
  data: { count: 0 },
  methods: {
    privateIncrement() {
      this.setData({ count: this.data.count + 1 })
    },
  },
  export() {
    return {
      label: 'filtered-native-owner',
      increment: () => this.privateIncrement(),
    }
  },
})
