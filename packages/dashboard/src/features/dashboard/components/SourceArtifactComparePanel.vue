<script setup lang="ts">
import type { SourceArtifactTarget } from '../composables/useSourceArtifactCompare'
import type { ResolvedTheme } from '../types'
import { computed, shallowRef, toRefs, watch } from 'vue'
import { useSourceArtifactCompare } from '../composables/useSourceArtifactCompare'
import { copyText } from '../utils/clipboard'
import { formatBytes } from '../utils/format'
import AppEmptyState from './AppEmptyState.vue'

const props = defineProps<{
  artifact: SourceArtifactTarget | null
  sourcePath: string | null
  theme: ResolvedTheme
}>()
const { artifact, sourcePath, theme } = toRefs(props)
const { artifactContent, sourceContent, editorElement, loadComparison, loadError, loading, statusText } = useSourceArtifactCompare({ artifact, sourcePath, theme })
const copyStatus = shallowRef('')
const copyContent = computed(() => [
  sourceContent.value ? `当前源码：${sourceContent.value.path}\n${sourceContent.value.content}` : '',
  artifactContent.value ? `报告产物：${artifactContent.value.path}\n${artifactContent.value.content}` : '',
].filter(Boolean).join('\n\n'))
watch([artifactContent, sourceContent], () => {
  copyStatus.value = ''
})

async function copyContents() {
  const content = copyContent.value
  try {
    await copyText(content)
    if (copyContent.value === content) {
      copyStatus.value = '内容已复制'
    }
  }
  catch {
    if (copyContent.value === content) {
      copyStatus.value = '复制失败，请在只读编辑器中选择内容后手动复制。'
    }
  }
}
</script>

<template>
  <section class="content-reader" aria-label="对象内容">
    <header class="content-toolbar">
      <div>
        <h3>{{ statusText }}</h3>
        <p>源码为当前文件，产物来自报告快照；两者展示构建转换，不代表优化收益或构建前后变化。</p>
      </div>
      <div class="content-actions">
        <button type="button" :disabled="!copyContent" @click="copyContents">复制内容</button>
        <button type="button" :disabled="loading || (!artifact && !sourcePath)" @click="loadComparison">重新读取</button>
      </div>
    </header>
    <p v-if="copyStatus" role="status" class="content-message">{{ copyStatus }}</p>
    <p v-if="loadError" role="alert" class="content-message">{{ loadError }}</p>
    <div class="content-paths">
      <p v-if="sourcePath"><span>源码</span> <code>{{ sourcePath }}</code><span v-if="sourceContent"> · {{ formatBytes(sourceContent.size) }}</span></p>
      <p v-if="artifact"><span>产物</span> <code>{{ artifact.file }}</code><span v-if="artifactContent"> · {{ formatBytes(artifactContent.size) }}</span></p>
    </div>
    <div class="editor-frame" :aria-busy="loading">
      <div v-show="sourceContent || artifactContent" ref="editorElement" class="editor-host" />
      <AppEmptyState v-if="!sourceContent && !artifactContent" class="m-3">
        {{ loading ? '正在读取…' : loadError || '此对象没有可请求的文本内容。二进制、缺失文件和无读取授权的来源不会生成替代内容。' }}
      </AppEmptyState>
    </div>
  </section>
</template>

<style scoped>
.content-reader {
  min-width: 0;
}

.content-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
}

.content-toolbar h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 550;
}

.content-toolbar p {
  max-width: 680px;
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--dashboard-text-muted);
}

.content-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-start;
}

.content-actions button {
  min-height: 38px;
  padding: 7px 10px;
  color: var(--dashboard-text);
  background: var(--dashboard-panel);
  border: 1px solid var(--dashboard-border);
  border-radius: 6px;
}

.content-actions button:disabled {
  opacity: 0.5;
}

.content-message {
  padding: 10px 12px;
  margin: 12px 0;
  font-size: 13px;
  line-height: 1.6;
  background: var(--dashboard-panel-muted);
  border-left: 2px solid var(--dashboard-accent);
}

.content-paths {
  margin: 12px 0;
  font-size: 12px;
  color: var(--dashboard-text-muted);
}

.content-paths p {
  margin: 6px 0;
}

.content-paths code {
  font-family: var(--dashboard-code);
  overflow-wrap: anywhere;
}

.editor-frame {
  position: relative;
  min-width: 0;
  height: 420px;
  overflow: hidden;
  background: var(--dashboard-panel);
  border: 1px solid var(--dashboard-border);
  border-radius: 6px;
}

.editor-host {
  position: absolute;
  inset: 0;
}
</style>
