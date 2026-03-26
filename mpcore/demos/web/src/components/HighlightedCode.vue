<script setup lang="ts">
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import json from '@shikijs/langs/json'
import githubDarkDefault from '@shikijs/themes/github-dark-default'
import githubLightDefault from '@shikijs/themes/github-light-default'
import { createHighlighterCore } from 'shiki/core'
import { computed, ref, watch } from 'vue'
import { codeFrameClass } from '../lib/ui'

const props = withDefaults(defineProps<{
  code: string
  lang?: string
  theme?: 'light' | 'dark'
}>(), {
  lang: 'json',
  theme: 'dark',
})

const highlightedHtml = ref('')

const fallbackCode = computed(() => props.code || '')

let activeRenderToken = 0

const highlighterPromise = createHighlighterCore({
  engine: createJavaScriptRegexEngine(),
  langs: [json],
  themes: [githubDarkDefault, githubLightDefault],
})

watch(
  () => [props.code, props.lang, props.theme] as const,
  async ([code, lang, theme]) => {
    const renderToken = ++activeRenderToken

    try {
      const highlighter = await highlighterPromise
      highlightedHtml.value = highlighter.codeToHtml(code || '', {
        lang,
        theme: theme === 'light' ? 'github-light-default' : 'github-dark-default',
      })
    }
    catch {
      if (renderToken !== activeRenderToken) {
        return
      }
      highlightedHtml.value = ''
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div
    v-if="highlightedHtml"
    class="sim-code-html overflow-auto rounded-2xl border border-[color:var(--sim-border)] bg-[color:var(--sim-code-bg)]"
    v-html="highlightedHtml"
  />
  <pre
    v-else
    :class="`${codeFrameClass} px-3.5 py-3 text-[11px] leading-7 text-[color:var(--sim-text)] whitespace-pre-wrap`"
  >{{ fallbackCode }}</pre>
</template>
