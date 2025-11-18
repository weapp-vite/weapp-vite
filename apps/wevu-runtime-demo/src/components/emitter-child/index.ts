import { defineComponent, getCurrentInstance } from 'wevu'

defineComponent({
  setup() {
    function emitPlus() {
      const inst = getCurrentInstance() as any
      inst?.triggerEvent?.('plus', { step: 3 })
    }
    return {
      emitPlus,
    }
  },
})
