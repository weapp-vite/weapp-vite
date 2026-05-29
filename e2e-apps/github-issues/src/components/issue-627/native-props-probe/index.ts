Component({
  properties: {
    class: String,
    style: String,
    customClass: String,
    customStyle: String,
  },
  methods: {
    snapshot() {
      return {
        class: this.properties.class ?? '',
        style: this.properties.style ?? '',
        customClass: this.properties.customClass ?? '',
        customStyle: this.properties.customStyle ?? '',
      }
    },
  },
})
