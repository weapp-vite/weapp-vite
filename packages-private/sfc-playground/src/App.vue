<script setup lang="ts">
import type { CompileOutputState, OutputPaneKey } from './compiler'
import { Repl, useStore, useVueImportMap } from '@vue/repl'
import CodeMirror from '@vue/repl/codemirror-editor'
import { computed, ref, watch, watchEffect } from 'vue'
import { compileWevuSfc } from './compiler'
import { defaultSfc } from './examples/defaultSfc'

const outputPanes: Array<{ key: OutputPaneKey, label: string }> = [
  { key: 'script', label: 'script' },
  { key: 'template', label: 'template' },
  { key: 'style', label: 'style' },
  { key: 'config', label: 'config' },
  { key: 'meta', label: 'meta' },
  { key: 'warnings', label: 'warnings' },
]

const activePane = ref<OutputPaneKey>('script')
const isCompiling = ref(false)
const compileState = ref<CompileOutputState>({
  success: true,
  activeFilename: 'App.vue',
  durationMs: 0,
  outputs: {
    script: '// waiting for compile result...',
    template: '<!-- waiting for compile result... -->',
    style: '/* waiting for compile result... */',
    config: '{\n  "note": "waiting for compile result..."\n}',
    meta: '{\n  "note": "waiting for compile result..."\n}',
    warnings: '// waiting for compile result...',
  },
})

const paneMeta = computed(() => {
  return outputPanes.find(pane => pane.key === activePane.value) ?? outputPanes[0]
})

const warningCount = computed(() => {
  const warningText = compileState.value.outputs.warnings
  if (!warningText || warningText.startsWith('// 当前没有编译警告')) {
    return 0
  }

  return warningText.split('\n').filter(Boolean).length
})

const compileStatusLabel = computed(() => {
  return compileState.value.success ? 'ready' : 'error'
})

const { importMap, vueVersion } = useVueImportMap()
const store = useStore({
  builtinImportMap: importMap,
  vueVersion,
  showOutput: ref(true),
  outputMode: ref('preview'),
})

void store.setFiles({
  'App.vue': defaultSfc,
}, 'App.vue')

watchEffect(() => {
  history.replaceState({}, '', store.serialize())
})

let compileRunId = 0

watch(
  [
    () => store.activeFile.filename,
    () => store.activeFile.code,
  ],
  async ([filename, source]) => {
    const currentRunId = ++compileRunId
    isCompiling.value = true

    const nextState = await compileWevuSfc(source, filename)

    if (currentRunId !== compileRunId) {
      return
    }

    compileState.value = nextState
    isCompiling.value = false
  },
  {
    immediate: true,
  },
)

const activeOutput = computed(() => compileState.value.outputs[activePane.value])
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand-block">
        <div class="brand-mark">
          WV
        </div>
        <div class="brand-copy">
          <p class="brand-overline">
            @weapp-vite/sfc-playground
          </p>
          <h1>Wevu SFC Playground</h1>
        </div>
      </div>

      <div class="topbar-summary">
        <span class="topbar-chip">file · {{ compileState.activeFilename }}</span>
        <span class="topbar-chip">compile · {{ compileState.durationMs }} ms</span>
        <span class="topbar-chip">warnings · {{ warningCount }}</span>
        <span
          class="topbar-chip"
          :data-status="compileStatusLabel"
        >
          {{ compileState.success ? 'wevu compile ready' : 'wevu compile failed' }}
        </span>
      </div>
    </header>

    <section class="workspace-shell">
      <div class="workspace-frame">
        <div class="surface-toolbar">
          <div class="surface-title">
            <span class="surface-dot" />
            <span>Vue REPL</span>
          </div>
          <div class="surface-actions">
            <span class="surface-pill">official-style layout</span>
            <span class="surface-pill">wevu compile target</span>
          </div>
        </div>

        <div class="repl-stage">
          <Repl
            :store="store"
            :editor="CodeMirror"
            layout="horizontal"
            :showCompileOutput="false"
            :showImportMap="false"
            :showOpenSourceMap="false"
            :showSsrOutput="false"
            :showTsConfig="false"
            theme="light"
          />
        </div>
      </div>

      <section class="inspector-panel">
        <header class="inspector-header">
          <div>
            <p class="inspector-overline">
              wevu compile inspector
            </p>
            <h2>{{ paneMeta.label }}</h2>
            <p class="inspector-copy">
              这里专门展示 wevu 的页面编译结果，把 Vue 官方 playground 的编辑体验和小程序产物观察窗口拼在一起。
            </p>
          </div>
          <span
            v-if="isCompiling"
            class="compile-pulse"
          >
            compiling
          </span>
        </header>

        <div class="inspector-tabs">
          <button
            v-for="pane in outputPanes"
            :key="pane.key"
            type="button"
            class="tab-button"
            :data-active="pane.key === activePane"
            @click="activePane = pane.key"
          >
            {{ pane.label }}
          </button>
        </div>

        <div class="inspector-meta">
          <span class="meta-chip">source · {{ compileState.activeFilename }}</span>
          <span class="meta-chip">render · {{ compileState.durationMs }} ms</span>
          <span class="meta-chip">status · {{ compileStatusLabel }}</span>
        </div>

        <pre
          v-if="compileState.success"
          class="code-frame"
        >
<code>{{ activeOutput }}</code>
</pre>

        <div
          v-else
          class="error-frame"
        >
          <p class="error-title">
            编译失败
          </p>
          <pre class="error-stack">
<code>{{ compileState.error }}</code>
</pre>
        </div>
      </section>
    </section>

    <footer class="statusbar">
      <div class="statusbar-group">
        <span class="status-label">mode</span>
        <span class="status-value">SFC -> wevu</span>
      </div>
      <div class="statusbar-group">
        <span class="status-label">pane</span>
        <span class="status-value">{{ paneMeta.label }}</span>
      </div>
      <div class="statusbar-group">
        <span class="status-label">runtime</span>
        <span class="status-value">{{ compileState.success ? 'healthy' : 'blocked' }}</span>
      </div>
    </footer>
  </main>
</template>
