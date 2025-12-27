import { defineComponent, onHide, onReady, onShow, onTabItemTap, ref } from 'wevu'

defineComponent({
  setup() {
    const logs = ref<string[]>([])
    const append = (m: string) => {
      logs.value = [...logs.value, m]
    }
    onReady(() => append('ready'))
    onShow(() => append('show'))
    onHide(() => append('hide'))
    onTabItemTap(opt => append(`tabItemTap: ${JSON.stringify(opt || {})}`))
    function simulateRouteDone() {
      // 用方法触发 onRouteDone 的映射（演示用途）
      // @ts-ignore
      this.onRouteDone?.()
      append('routeDone (simulated)')
    }
    return {
      logs,
      simulateRouteDone,
    }
  },
  onRouteDone() {
    // 仅用于演示映射，将会通过 runtime 调用 onRouteDone 钩子
  },
})
