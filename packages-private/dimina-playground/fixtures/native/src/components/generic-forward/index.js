Component({
  properties: { value: Number },
  methods: { selected(event) { this.triggerEvent('pick', event.detail) } },
})
