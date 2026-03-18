Component({
  properties: {
    title: {
      type: String,
      value: 'Native Layout',
    },
    sidebar: {
      type: Boolean,
      value: false,
    },
  },
  options: {
    multipleSlots: true,
  },
})
