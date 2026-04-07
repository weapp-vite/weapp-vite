Component({
  properties: {
    label: {
      type: String,
      value: 'native-ref-probe',
    },
  },
  methods: {
    getLabel() {
      return this.data.label
    },
  },
})
