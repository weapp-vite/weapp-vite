Component({
  properties: { value: Number },
  methods: { choose() { this.triggerEvent('pick', { label: 'alpha', value: this.data.value }) } },
})
