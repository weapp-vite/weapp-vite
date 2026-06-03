Component({
  data: {
    label: 'component-initial',
    nested: {
      value: 'component-nested',
    },
  },

  methods: {
    mark(value = 'component-invoked') {
      this.setData({
        label: value,
      })
      return `component:${value}`
    },
  },
})
