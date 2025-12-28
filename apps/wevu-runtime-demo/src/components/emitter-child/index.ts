import { defineComponent } from 'wevu'

defineComponent({
  props: {
    step: { type: Number, default: 1 },
  },
  setup(props, { emit }) {
    function emitPlus() {
      const step = typeof props.step === 'number' ? props.step : 1
      emit('plus', { step })
    }
    return {
      emitPlus,
    }
  },
})
