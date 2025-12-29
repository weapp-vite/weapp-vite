import { defineComponent, getCurrentInstance, readonly, ref, watchEffect } from 'wevu'

defineComponent({
  type: 'page',
  setup() {
    const source = ref('hello')
    const length = ref(source.value.length)
    const logs = ref<string[]>([])
    const running = ref(true)
    let stopEffect = watchEffect((onCleanup) => {
      // effect: track source, update length and log
      length.value = source.value.length
      logs.value = [...logs.value, `effect: "${source.value}" (${length.value})`]
      // optional cleanup
      onCleanup(() => {
        // no-op
      })
    })

    const ro = readonly(source)

    function toggle() {
      if (running.value) {
        stopEffect()
        running.value = false
      }
      else {
        stopEffect = watchEffect((onCleanup) => {
          length.value = source.value.length
          logs.value = [...logs.value, `effect: "${source.value}" (${length.value})`]
          onCleanup(() => {})
        })
        running.value = true
      }
    }

    function setValue(e: WechatMiniprogram.Input) {
      source.value = e.detail.value
    }

    const route = ref<string>('')
    const instance = getCurrentInstance() as any
    if (instance && typeof instance.route === 'string') {
      route.value = instance.route
    }

    return {
      source,
      length,
      logs,
      running,
      ro,
      toggle,
      setValue,
      route,
    }
  },
})
