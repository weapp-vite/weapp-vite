<script setup lang="ts">
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import json from '@shikijs/langs/json'
import githubDarkDefault from '@shikijs/themes/github-dark-default'
import { createHighlighterCore } from 'shiki/core'
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  code: string
  lang?: string
}>(), {
  lang: 'json',
})

const highlightedHtml = ref('')

const fallbackCode = computed(() => props.code || '')

let activeRenderToken = 0

const highlighterPromise = createHighlighterCore({
  engine: createJavaScriptRegexEngine(),
  langs: [json],
  themes: [githubDarkDefault],
})

watch(
  () => [props.code, props.lang] as const,
  async ([code, lang]) => {
    const renderToken = ++activeRenderToken

    try {
      const highlighter = await highlighterPromise
      highlightedHtml.value = highlighter.codeToHtml(code || '', {
        lang,
        theme: 'github-dark-default',
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
  <div v-if="highlightedHtml" class="sim-code-html" v-html="highlightedHtml" />
  <pre v-else class="sim-code">{{ fallbackCode }}</pre>
</template>
