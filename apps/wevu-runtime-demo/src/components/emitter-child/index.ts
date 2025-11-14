import { defineComponent, getCurrentInstance } from 'wevu'

const Child = defineComponent({
  type: 'component',
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

Child.mount()

