<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '../lib/cn'
import HighlightedCode from './HighlightedCode.vue'

const props = defineProps<{
  code: string
  filePath: string
  lang: string
  openFiles: string[]
  projectLabel: string
  theme: 'light' | 'dark'
}>()

const lineNumbers = computed(() => {
  const count = Math.max(1, props.code.split('\n').length)
  return Array.from({ length: count }, (_, index) => index + 1)
})

const breadcrumbs = computed(() => props.filePath.split('/').filter(Boolean))
</script>

<template>
  <section class="grid min-h-0 grid-rows-[30px_28px_minmax(0,1fr)] overflow-hidden border-b border-[color:var(--sim-border)] bg-[color:var(--sim-panel-soft)]">
    <div class="flex items-center gap-2 border-b border-[color:var(--sim-divider)] bg-[color:var(--sim-panel-strong)] px-2">
      <div class="flex items-center gap-1 overflow-x-auto">
        <button class="flex h-[29px] items-center gap-2 border-r border-[color:var(--sim-divider)] bg-[color:var(--sim-tab-active)] px-3 text-[11px] text-[color:var(--sim-text)]">
          <span class="icon-[mdi--language-html5] text-[13px] text-[#7ec6ff]" aria-hidden="true" />
          <span>{{ openFiles.find(path => path.endsWith('.wxml'))?.split('/').at(-1) ?? 'index.wxml' }}</span>
          <span class="icon-[mdi--close] text-[12px] text-[color:var(--sim-muted)]" aria-hidden="true" />
        </button>
        <button class="flex h-[29px] items-center gap-2 border-r border-[color:var(--sim-divider)] bg-[color:var(--sim-panel)] px-3 text-[11px] text-[color:var(--sim-text)]">
          <span class="icon-[mdi--language-javascript] text-[13px] text-[#e2c06d]" aria-hidden="true" />
          <span>{{ filePath.split('/').at(-1) }}</span>
          <span class="icon-[mdi--close] text-[12px] text-[color:var(--sim-muted)]" aria-hidden="true" />
        </button>
      </div>
      <div class="ml-auto flex items-center gap-2 text-[color:var(--sim-muted)]">
        <span class="icon-[mdi--magnify] text-[13px]" aria-hidden="true" />
        <span class="icon-[mdi--dots-horizontal] text-[13px]" aria-hidden="true" />
      </div>
    </div>

    <div class="flex items-center gap-2 border-b border-[color:var(--sim-divider)] bg-[color:var(--sim-panel)] px-3">
      <span class="truncate text-[11px] text-[color:var(--sim-muted)]">dist</span>
      <span class="icon-[mdi--chevron-right] text-[11px] text-[color:var(--sim-muted)]" aria-hidden="true" />
      <span class="truncate text-[11px] text-[color:var(--sim-muted)]">{{ projectLabel }}</span>
      <span class="icon-[mdi--chevron-right] text-[11px] text-[color:var(--sim-muted)]" aria-hidden="true" />
      <template v-for="(crumb, index) in breadcrumbs" :key="`${crumb}-${index}`">
        <span :class="cn('truncate text-[11px]', index === breadcrumbs.length - 1 ? 'text-[color:var(--sim-text)]' : 'text-[color:var(--sim-muted)]')">{{ crumb }}</span>
        <span
          v-if="index < breadcrumbs.length - 1"
          class="icon-[mdi--chevron-right] text-[11px] text-[color:var(--sim-muted)]"
          aria-hidden="true"
        />
      </template>
    </div>

    <div class="grid min-h-0 grid-cols-[44px_minmax(0,1fr)] overflow-hidden bg-[color:var(--sim-editor-bg)]">
      <div class="overflow-hidden border-r border-[color:var(--sim-divider)] bg-[color:var(--sim-editor-gutter-bg)] px-2 py-2 text-right text-[11px] leading-7 text-[color:var(--sim-muted)]">
        <div
          v-for="line in lineNumbers"
          :key="line"
          class="truncate"
        >
          {{ line }}
        </div>
      </div>

      <div class="min-h-0 overflow-hidden p-0">
        <HighlightedCode
          :code="code"
          :lang="lang"
          :theme="theme"
        />
      </div>
    </div>
  </section>
</template>
