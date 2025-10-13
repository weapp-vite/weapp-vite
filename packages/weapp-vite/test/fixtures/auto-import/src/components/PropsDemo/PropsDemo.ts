Component({
  properties: {
    title: String,
    count: {
      type: Number,
      optionalTypes: [String],
    },
    active: {
      type: Boolean,
      value: false,
    },
    items: {
      type: Array,
    },
    dataSet: {
      type: Object,
    },
    anyValue: {
      type: null,
    },
    'custom-prop': {
      type: String,
    },
  },
})
