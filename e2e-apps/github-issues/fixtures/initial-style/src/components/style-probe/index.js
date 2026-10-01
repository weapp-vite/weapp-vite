Component({
  properties: { style: String, count: Number },
  methods: {
    increment() {
      this.triggerEvent('increment')
    },
  },
})
