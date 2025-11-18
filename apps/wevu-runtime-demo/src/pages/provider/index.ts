import { defineComponent, provide, readonly, ref } from 'wevu'

defineComponent({
  setup() {
    const count = ref(0)
    function increment() {
      count.value += 1
    }
    // provide before children attach (页面组件可保证时序)
    provide('count', readonly(count))
    provide('increment', increment)
    return {
      count,
      increment,
    }
  },
})
