Component({
  methods: {
    emit() {
      this.triggerEvent('change', { value: 1 })
    },
  },
})
