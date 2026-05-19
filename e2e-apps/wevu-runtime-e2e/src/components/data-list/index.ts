Component({
  properties: {
    selected: {
      type: String,
      value: '',
    },
  },
  methods: {
    inspectProps(this: any) {
      return {
        selected: this.data?.selected,
        selectedType: typeof this.data?.selected,
      }
    },
  },
})
