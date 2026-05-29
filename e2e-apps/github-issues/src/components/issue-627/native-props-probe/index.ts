Component({
  properties: {
    'id': String,
    'class': String,
    'style': String,
    'hidden': Boolean,
    'dataFoo': String,
    'markFoo': String,
    'data-foo': String,
    'mark:foo': String,
    'slot': String,
    'wx:if': Boolean,
    'customClass': String,
    'customStyle': String,
    'customHidden': Boolean,
    'customDataFoo': String,
  },
  methods: {
    snapshot() {
      return {
        id: this.properties.id ?? '',
        class: this.properties.class ?? '',
        style: this.properties.style ?? '',
        hidden: this.properties.hidden ?? null,
        dataFoo: this.properties.dataFoo ?? '',
        dataDashFoo: this.properties['data-foo'] ?? '',
        markFoo: this.properties.markFoo ?? '',
        markColonFoo: this.properties['mark:foo'] ?? '',
        slot: this.properties.slot ?? '',
        wxIf: this.properties['wx:if'] ?? null,
        customClass: this.properties.customClass ?? '',
        customStyle: this.properties.customStyle ?? '',
        customHidden: this.properties.customHidden ?? null,
        customDataFoo: this.properties.customDataFoo ?? '',
      }
    },
  },
})
