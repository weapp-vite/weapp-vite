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

const emit = defineEmits<{
  pick: [path: string]
}>()

const lineNumbers = computed(() => {
  const count = Math.max(1, props.code.split('\n').length)
  return Array.from({ length: count }, (_, index) => index + 1)
})

const breadcrumbs = computed(() => props.filePath.split('/').filter(Boolean))
</script>

<template>
  <section class="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-[24px] border border-[color:var(--sim-border)] bg-[color:var(--sim-panel-soft)] shadow-[var(--sim-shadow)]">
    <div class="flex items-center gap-2 border-b border-[color:var(--sim-divider)] bg-[color:var(--sim-panel-strong)] px-3 py-2">
      <span class="icon-[mdi--language-javascript] text-sm text-[color:var(--sim-accent-strong)]" aria-hidden="true" />
      <span class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sim-muted)]">编辑器</span>
      <div class="ml-auto flex items-center gap-2">
        <span class="icon-[mdi--magnify] text-sm text-[color:var(--sim-muted)]" aria-hidden="true" />
        <span class="icon-[mdi--dots-horizontal] text-sm text-[color:var(--sim-muted)]" aria-hidden="true" />
      </div>
    </div>

    <div class="flex overflow-x-auto border-b border-[color:var(--sim-divider)] bg-[color:var(--sim-panel)] px-2">
      <button
        v-for="path in openFiles"
        :key="path"
        :class="cn(
          'flex shrink-0 items-center gap-2 border-r border-[color:var(--sim-divider)] px-4 py-2 text-[12px] transition-colors first:border-l',
          path === filePath
            ? 'bg-[color:var(--sim-tab-active)] text-[color:var(--sim-text)]'
            : 'text-[color:var(--sim-muted)] hover:bg-[color:var(--sim-tab-hover)] hover:text-[color:var(--sim-text)]',
        )"
        @click="emit('pick', path)"
      >
        <span class="icon-[mdi--file-document-outline] text-sm" aria-hidden="true" />
        <span>{{ path.split('/').at(-1) }}</span>
      </button>
    </div>

    <div class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      <div class="flex items-center gap-2 border-b border-[color:var(--sim-divider)] px-4 py-2 text-[11px] text-[color:var(--sim-muted)]">
        <span class="truncate font-semibold uppercase tracking-[0.16em]">{{ projectLabel }}</span>
        <span class="icon-[mdi--chevron-right] text-xs" aria-hidden="true" />
        <template v-for="(crumb, index) in breadcrumbs" :key="`${crumb}-${index}`">
          <span class="truncate">{{ crumb }}</span>
          <span
            v-if="index < breadcrumbs.length - 1"
            class="icon-[mdi--chevron-right] text-xs"
            aria-hidden="true"
          />
        </template>
      </div>

      <div class="grid min-h-0 grid-cols-[48px_minmax(0,1fr)] overflow-hidden">
        <div class="overflow-hidden border-r border-[color:var(--sim-divider)] bg-[color:var(--sim-panel-strong)] px-2 py-3 text-right text-[11px] leading-7 text-[color:var(--sim-muted)]">
          <div
            v-for="line in lineNumbers"
            :key="line"
            class="truncate"
          >
            {{ line }}
          </div>
        </div>

        <div class="min-h-0 overflow-hidden p-3">
          <HighlightedCode
            :code="code"
            :lang="lang"
            :theme="theme"
          />
        </div>
      </div>
    </div>
  </section>
</template>
