<script setup lang="ts">
import type { MermaidConfig } from 'mermaid'
import config from 'virtual:mermaid-config'
import { useData } from 'vitepress'
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { renderDiagram } from './render'

// eslint-disable-next-line vue/no-restricted-props -- 网站组件沿用 Mermaid 插件的 id 契约，不进入小程序产物。
const props = defineProps<{ id: string, graph: string }>()
const { isDark, frontmatter } = useData()
const instanceId = useId().replace(/[^\w-]/g, '')
const svg = ref('')
const error = ref('')
let revision = 0

onBeforeUnmount(() => revision++)
onMounted(() => {
  watch([() => props.graph, () => isDark.value, () => frontmatter.value.mermaidTheme], async () => {
    const current = ++revision
    const theme = isDark.value ? 'dark' : frontmatter.value.mermaidTheme || config.theme || 'default'
    try {
      // 每次使用新 ID，避免 Mermaid 删除仍在展示的旧 SVG，造成页面高度跳变。
      const result = await renderDiagram(`${props.id}-${instanceId}-${current}`, decodeURIComponent(props.graph), {
        ...config,
        theme: theme as MermaidConfig['theme'],
      })
      if (current !== revision) {
        return
      }
      svg.value = result.svg
      error.value = ''
      await nextTick()
      // 异步图表改变布局后，通知主题按当前视口重新计算目录，不接管滚动和高亮。
      window.dispatchEvent(new Event('scroll'))
    }
    catch (cause) {
      if (current !== revision) {
        return
      }
      error.value = String(cause)
    }
  }, { immediate: true })
})
</script>

<template>
  <div class="mermaid">
    <pre v-if="error" role="alert">{{ error }}</pre>
    <div v-else v-html="svg" />
  </div>
</template>
