Component({
  methods: {
    emitProbe(tag = 'manual') {
      this.emitNamed('probe', tag)
    },
    emitNamed(eventName = 'probe', tag = 'manual') {
      this.triggerEvent(eventName, {
        source: 'native-component',
        eventName,
        tag,
      })
    },
  },
})
