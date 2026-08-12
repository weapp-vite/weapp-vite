Component({
  properties: {
    label: {
      type: String,
      value: 'npm component',
    },
  },
  methods: {
    confirm() {
      this.triggerEvent('confirm', { label: this.data.label })
    },
  },
})
