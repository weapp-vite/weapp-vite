Component({
  properties: { row: String },
  methods: {
    emit() {
      this.triggerEvent('foo', this.data.row)
    },
  },
})
