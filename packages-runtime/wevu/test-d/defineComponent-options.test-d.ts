import { expectError, expectType } from 'tsd'
import { defineComponent, ref } from 'wevu'

defineComponent({
  props: { step: { type: Number, required: true } },
  data: () => ({ count: 0 }),
  computed: {
    doubled(): number {
      expectType<number>(this.count)
      return this.count * 2
    },
  },
  methods: {
    increment(amount: number) {
      expectType<number>(this.$props.step)
      expectType<number>(this.doubled)
      this.count += amount * this.$props.step
      expectError(this.count = 'invalid')
      expectError(this.missing)
    },
    reset() {
      this.increment(-this.count)
      expectError(this.increment('invalid'))
    },
  },
})

defineComponent({
  setup: () => ({ setupCount: ref(1) }),
  methods: {
    increment() {
      expectType<number>(this.setupCount)
      this.setupCount += 1
      expectError(this.setupCount = 'invalid')
    },
  },
})
