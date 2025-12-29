import { defineComponent, ref } from 'wevu'

defineComponent({
  setup() {
    const count = ref(0)
    function onPlus(e: WechatMiniprogram.CustomEvent) {
      const step = Number((e.detail && (e.detail.step ?? 1)) || 1)
      count.value += step
    }
    return {
      count,
      onPlus,
    }
  },
})
