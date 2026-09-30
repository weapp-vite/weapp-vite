Component({
  properties: { value: Number },
  methods: { choose() { this.triggerEvent('pick', { label: 'beta', value: this.data.value }) } },
})
