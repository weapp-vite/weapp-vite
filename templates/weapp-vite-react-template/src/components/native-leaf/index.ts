Component({
  properties: {
    label: String,
    value: Number,
  },
  methods: {
    emitChange() {
      this.triggerEvent('change', {
        value: Number(this.data.value ?? 0) + 1,
      })
    },
  },
})
