import { createWevuComponent, defineComponent, nextTick, normalizeClass, normalizeStyle, onMounted, ref } from 'wevu'
import { createVNode, normalizeJsxIsland } from 'wevu/internal-runtime'

// 原生页面间接选择公开工厂，不能依赖 SFC 编译器注入能力安装器。
const factories = { defineComponent, createWevuComponent }
const factoryName = ['define', 'Component'].join('') as keyof typeof factories
const register = factories[factoryName] as typeof createWevuComponent

register({
  __wevu_isPage: true,
  setup(_props, context) {
    const count = ref(0)
    const phase = ref('setup')
    const node = normalizeJsxIsland.call(context.proxy, createVNode('button', {
      onTap() { count.value += 1 },
    }), 'public', { normalizeClass, normalizeStyle })
    onMounted(() => {
      phase.value = 'mounted'
    })
    return {
      count,
      phase,
      handlerId: node?.events?.tap,
      readSnapshot() { return { count: count.value, phase: phase.value } },
      flush: nextTick,
    }
  },
})
