Component({
  props: {
    value: 0,
    onChange: (_value: number) => {},
  },
  data: {
    current: 0,
    mounted: false,
  },
  deriveDataFromProps(nextProps) {
    if (nextProps.value !== this.data.current) {
      this.setData({ current: nextProps.value })
    }
  },
  didMount() {
    this.setData({
      current: this.props.value,
      mounted: true,
    })
  },
  methods: {
    increase() {
      const next = this.data.current + 1
      this.setData({ current: next })
      this.props.onChange(next)
    },
  },
})
