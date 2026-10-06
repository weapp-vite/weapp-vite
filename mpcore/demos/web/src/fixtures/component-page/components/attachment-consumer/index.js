Component({
  properties: {
    model: { type: null, value: null },
  },
  data: {
    attachedLabel: '',
  },
  lifetimes: {
    attached() {
      this.setData({ attachedLabel: this.properties.model.label })
    },
  },
})
