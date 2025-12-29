import { defineComponent, onHide, onPageScroll, onShow, ref } from 'wevu'

defineComponent({
  features: { listenPageScroll: true },
  setup() {
    const scrollTop = ref(0)
    const logs = ref<string[]>([])

    function appendLog(text: string) {
      logs.value = [...logs.value, text]
    }

    onShow(() => appendLog('页面显示'))
    onHide(() => appendLog('页面隐藏'))
    onPageScroll((e: any) => {
      const top = Number((e && (e.scrollTop ?? 0)) || 0)
      scrollTop.value = top
      appendLog(`滚动到：${top}`)
    })

    return {
      scrollTop,
      logs,
    }
  },
})
