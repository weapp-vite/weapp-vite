<script setup lang="ts">
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import css from '@shikijs/langs/css'
import html from '@shikijs/langs/html'
import javascript from '@shikijs/langs/javascript'
import json from '@shikijs/langs/json'
import xml from '@shikijs/langs/xml'
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
  langs: [javascript, json, html, css, xml],
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
    class="sim-code-html min-h-0 h-full overflow-auto border border-(--sim-border) bg-(--sim-code-bg)"
    v-html="highlightedHtml"
  />
  <pre
    v-else
    :class="`${codeFrameClass} min-h-0 h-full rounded-none px-3.5 py-3 text-[11px] leading-7 text-(--sim-text) whitespace-pre-wrap`"
  >{{ fallbackCode }}</pre>
</template>
