import { defineComponent, ref } from 'wevu'

defineComponent({
  setup() {
    const result = ref<string>('尚未计算')
    const running = ref(false)
    async function run() {
      running.value = true
      const { compute } = await import('../../../../utils/heavy')
      const out = compute(20000)
      result.value = `结果：${out}`
      running.value = false
    }
    return {
      result,
      running,
      run,
    }
  },
})
