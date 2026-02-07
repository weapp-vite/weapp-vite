Component({
  properties: {
    'title': String,
    'level': {
      type: Number,
      optionalTypes: [String],
    },
    'visible': Boolean,
    'meta': Object,
    'items': Array,
    'anyValue': null,
    'custom-prop': String,
  },
})
