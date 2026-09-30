Component({
  properties: { value: Number },
  methods: {
    pick() { this.triggerEvent('pick', { label: 'sub', value: this.data.value }) },
  },
})
