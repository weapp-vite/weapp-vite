Component({
  properties: { value: Number },
  methods: { choose() { this.triggerEvent('pick', { label: 'fallback', value: this.data.value }) } },
})
