const componentMarker = 'STATEFUL-COMPONENT-BASE'

Component({
  data: {
    count: 0,
    marker: componentMarker,
  },
  methods: {
    increment() {
      this.setData({ count: this.data.count + 1 })
    },
  },
})
