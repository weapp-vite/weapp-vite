Component({
  properties: { dataDebugInfo: String, probe: String },
  methods: {
    emitReady() {
      this.triggerEvent('_ready')
    },
  },
})
