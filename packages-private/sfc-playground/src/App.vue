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
    <section class="hero-panel">
      <p class="eyebrow">
        @weapp-vite/sfc-playground
      </p>
      <div class="hero-copy">
        <h1>wevu SFC 编译对照台</h1>
        <p>
          左侧用 <code>@vue/repl</code> 编辑和预览 Vue SFC，右侧实时展示
          <code>@wevu/compiler</code> 产出的 script、template、style、config 与 meta。
        </p>
      </div>
      <div class="hero-metrics">
        <span class="metric-chip">{{ compileState.activeFilename }}</span>
        <span class="metric-chip">{{ compileState.durationMs }} ms</span>
        <span
          class="metric-chip"
          :data-status="compileState.success ? 'ok' : 'error'"
        >
          {{ compileState.success ? 'compile ok' : 'compile error' }}
        </span>
      </div>
    </section>

    <section class="workspace-grid">
      <div class="editor-panel">
        <Repl
          :store="store"
          :editor="CodeMirror"
          layout="vertical"
          :showCompileOutput="false"
          :showImportMap="false"
          :showOpenSourceMap="false"
          :showSsrOutput="false"
          :showTsConfig="false"
          theme="light"
        />
      </div>

      <aside class="output-panel">
        <header class="output-header">
          <div>
            <p class="panel-title">
              wevu 编译产物
            </p>
            <p class="panel-subtitle">
              当前查看 {{ compileState.activeFilename }} 的 wevu 页面编译结果
            </p>
          </div>
          <span
            v-if="isCompiling"
            class="compile-pulse"
          >
            compiling
          </span>
        </header>

        <div class="tab-row">
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

        <pre
          v-if="compileState.success"
          class="code-frame"
        ><code>{{ activeOutput }}</code></pre>

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
      </aside>
    </section>
  </main>
</template>
