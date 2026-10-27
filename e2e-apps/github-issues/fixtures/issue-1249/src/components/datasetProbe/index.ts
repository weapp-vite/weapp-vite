Component({
  methods: {
    select() {
      this.triggerEvent('select', { selected: true })
    },
  },
})
