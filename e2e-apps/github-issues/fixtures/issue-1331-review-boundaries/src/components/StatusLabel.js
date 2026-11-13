function record(instance, phase, value, previous) {
  instance.initialTrace.probe = instance.data.probe
  instance.initialTrace.events.push({ phase, value, previous })
}

Component({
  properties: {
    probe: String,
    text: {
      type: String,
      value: '',
      observer(value, previous) {
        record(this, 'observer', value, previous)
      },
    },
  },
  lifetimes: {
    created() {
      this.initialTrace = { probe: '', events: [] }
      getApp().globalData.initialPropsEvents.push(this.initialTrace)
      record(this, 'created', this.data.text)
    },
    attached() { record(this, 'attached', this.data.text) },
    ready() { record(this, 'ready', this.data.text) },
  },
})
