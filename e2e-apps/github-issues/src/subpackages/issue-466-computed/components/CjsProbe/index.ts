import { ComponentWithComputed } from 'miniprogram-computed'

ComponentWithComputed({
  properties: {
    a: {
      type: Number,
      value: 0,
    },
    b: {
      type: Number,
      value: 0,
    },
  },

  data: {
    watchCount: 0,
    lastWatch: '',
  },

  computed: {
    sum(data) {
      return data.a + data.b
    },
    summary(data) {
      return `${data.a}+${data.b}=${data.sum}`
    },
  },

  watch: {
    'a, b': function (a, b, oldA, oldB) {
      this.setData({
        watchCount: this.data.watchCount + 1,
        lastWatch: `${oldA ?? 'none'}:${oldB ?? 'none'}->${a}:${b}`,
      })
    },
  },

  methods: {
    _runE2E() {
      return {
        a: this.data.a,
        b: this.data.b,
        sum: this.data.sum,
        summary: this.data.summary,
        watchCount: this.data.watchCount,
        lastWatch: this.data.lastWatch,
      }
    },
  },
})
