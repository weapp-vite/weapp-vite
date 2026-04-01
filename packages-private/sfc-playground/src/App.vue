<script setup lang="ts">
import type { CompileOutputState, OutputPaneKey } from './compiler'
import { Repl, useStore, useVueImportMap } from '@vue/repl'
import CodeMirror from '@vue/repl/codemirror-editor'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  watchEffect,
} from 'vue'
import { compileWevuSfc } from './compiler'
import { defaultSfc } from './examples/defaultSfc'
import { getPaneLanguage, highlightPaneOutput } from './highlight'

type OutputMode = 'preview' | OutputPaneKey

const compilePanes: Array<{ key: OutputPaneKey, label: string }> = [
  { key: 'script', label: 'wevu script' },
  { key: 'template', label: 'wevu template' },
  { key: 'style', label: 'wevu style' },
  { key: 'config', label: 'wevu config' },
  { key: 'meta', label: 'wevu meta' },
  { key: 'warnings', label: 'wevu warnings' },
]

const replShellRef = ref<HTMLElement | null>(null)
const customTabMountRef = shallowRef<HTMLElement | null>(null)
const customOutputMountRef = shallowRef<HTMLElement | null>(null)
const activeOutputMode = ref<OutputMode>('preview')
const isCompiling = ref(false)
const highlightedOutputs = ref<Record<OutputPaneKey, string>>({
  script: '',
  template: '',
  style: '',
  config: '',
  meta: '',
  warnings: '',
})
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

const warningCount = computed(() => {
  const warningText = compileState.value.outputs.warnings
  if (!warningText || warningText.startsWith('// 当前没有编译警告')) {
    return 0
  }

  return warningText.split('\n').filter(Boolean).length
})

const activeCompilePane = computed(() => {
  if (activeOutputMode.value === 'preview') {
    return null
  }

  return compilePanes.find(pane => pane.key === activeOutputMode.value) ?? null
})

const activeHighlightedOutput = computed(() => {
  if (activeOutputMode.value === 'preview') {
    return ''
  }

  return highlightedOutputs.value[activeOutputMode.value]
})

const activePaneLanguage = computed(() => {
  if (activeOutputMode.value === 'preview') {
    return null
  }

  return getPaneLanguage(activeOutputMode.value)
})

function syncReplMounts() {
  const root = replShellRef.value
  if (!root) {
    return
  }

  const outputContainer = root.querySelector<HTMLElement>('.output-container')
  const tabButtons = root.querySelector<HTMLElement>('.tab-buttons')

  customOutputMountRef.value = outputContainer
  customTabMountRef.value = tabButtons
}

function handleReplClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target) {
    return
  }

  const clickedButton = target.closest<HTMLButtonElement>('.tab-buttons button')
  if (!clickedButton) {
    return
  }

  if (clickedButton.dataset.wevuPane) {
    return
  }

  const label = clickedButton.textContent?.trim().toLowerCase()
  if (label === 'preview') {
    activeOutputMode.value = 'preview'
  }
}

let observer: MutationObserver | null = null
let compileRunId = 0
let highlightRunId = 0

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

watch(
  compileState,
  async (nextState) => {
    const currentRunId = ++highlightRunId
    const entries = await Promise.all(
      compilePanes.map(async (pane) => {
        const html = await highlightPaneOutput(pane.key, nextState.outputs[pane.key])
        return [pane.key, html] as const
      }),
    )

    if (currentRunId !== highlightRunId) {
      return
    }

    highlightedOutputs.value = Object.fromEntries(entries) as Record<OutputPaneKey, string>
  },
  {
    immediate: true,
  },
)

onMounted(async () => {
  await nextTick()
  syncReplMounts()

  if (replShellRef.value) {
    replShellRef.value.addEventListener('click', handleReplClick)
    observer = new MutationObserver(() => {
      syncReplMounts()
    })
    observer.observe(replShellRef.value, {
      childList: true,
      subtree: true,
    })
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  replShellRef.value?.removeEventListener('click', handleReplClick)
})
</script>

<template>
  <main class="app-shell">
    <header class="playground-header">
      <div class="header-brand">
        <span class="brand-badge">WV</span>
        <div class="brand-copy">
          <h1>Wevu SFC Playground</h1>
          <p>基于 @vue/repl，直接在预览输出区追加 wevu 编译结果 tab。</p>
        </div>
      </div>

      <div class="header-meta">
        <span class="header-chip">{{ compileState.activeFilename }}</span>
        <span class="header-chip">{{ compileState.durationMs }} ms</span>
        <span class="header-chip">warnings {{ warningCount }}</span>
        <span
          class="header-chip"
          :data-status="compileState.success ? 'ready' : 'error'"
        >
          {{ compileState.success ? 'compile ready' : 'compile failed' }}
        </span>
      </div>
    </header>

    <section
      ref="replShellRef"
      class="repl-shell"
      :data-wevu-active-pane="activeOutputMode"
    >
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

      <Teleport
        v-if="customTabMountRef"
        :to="customTabMountRef"
      >
        <button
          v-for="pane in compilePanes"
          :key="pane.key"
          type="button"
          class="wevu-tab-button"
          :class="{ active: activeOutputMode === pane.key }"
          :data-wevu-pane="pane.key"
          @click="activeOutputMode = pane.key"
        >
          <span>{{ pane.label }}</span>
        </button>
      </Teleport>

      <Teleport
        v-if="customOutputMountRef"
        :to="customOutputMountRef"
      >
        <section
          class="wevu-output-panel"
          :data-visible="activeOutputMode !== 'preview'"
        >
          <header class="wevu-output-header">
            <div>
              <p class="wevu-output-overline">
                wevu compile result
              </p>
              <h2>{{ activeCompilePane?.label ?? 'preview' }}</h2>
            </div>
            <div class="wevu-output-meta">
              <span
                v-if="activePaneLanguage"
                class="wevu-output-chip"
              >
                {{ activePaneLanguage }}
              </span>
              <span class="wevu-output-chip">{{ compileState.activeFilename }}</span>
              <span class="wevu-output-chip">{{ compileState.durationMs }} ms</span>
              <span
                v-if="isCompiling"
                class="wevu-output-chip"
              >
                compiling
              </span>
            </div>
          </header>

          <div
            v-if="compileState.success"
            class="wevu-output-code"
            v-html="activeHighlightedOutput"
          />

          <div
            v-else
            class="wevu-output-error"
          >
            <p class="wevu-output-error-title">
              编译失败
            </p>
            <pre class="wevu-output-error-stack">
<code>{{ compileState.error }}</code>
</pre>
          </div>
        </section>
      </Teleport>
    </section>
  </main>
</template>
