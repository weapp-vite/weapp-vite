<script setup lang="ts">
import { cn } from '../../lib/cn'
import { labelClass, pill, toolbarSurface } from '../../lib/ui'
import { themeOptions, workbenchToolbarIcons } from '../../lib/workbench'

defineProps<{
  currentRoute: string
  projectDisplayLabel: string
  themeMode: 'auto' | 'light' | 'dark'
}>()

const emit = defineEmits<{
  setThemeMode: [mode: 'auto' | 'light' | 'dark']
}>()
</script>

<template>
  <header class="grid grid-cols-[140px_minmax(0,1fr)_320px] items-center gap-3 border-b border-(--sim-divider) bg-(--sim-toolbar-bg) px-3 text-[11px] max-[1180px]:grid-cols-[140px_minmax(0,1fr)]">
    <div class="flex items-center gap-1.5">
      <span class="h-3 w-3 rounded-full bg-[#ff5f57]" />
      <span class="h-3 w-3 rounded-full bg-[#febc2e]" />
      <span class="h-3 w-3 rounded-full bg-[#28c840]" />
    </div>
    <div class="truncate text-center text-[11px] font-medium text-(--sim-muted)">
      {{ projectDisplayLabel }} - 微信开发者工具 Stable 0.1.2510280
    </div>
    <div class="flex items-center justify-end gap-3 text-[10px] text-(--sim-muted) max-[1180px]:hidden">
      <span class="truncate">小程序模式</span>
      <span class="inline-flex items-center gap-1">
        <span class="icon-[mdi--eye-outline] text-[12px]" aria-hidden="true" />
        预览
      </span>
      <span>真机调试</span>
      <span class="icon-[mdi--upload-outline] text-[12px]" aria-hidden="true" />
      <span class="icon-[mdi--content-save-outline] text-[12px]" aria-hidden="true" />
      <span class="inline-flex h-5 w-5 items-center justify-center rounded-sm border border-(--sim-border) bg-(--sim-panel)">
        <span class="icon-[mdi--account] text-[12px]" aria-hidden="true" />
      </span>
    </div>
  </header>

  <section :class="cn(toolbarSurface(), 'border-b border-(--sim-divider) px-3 py-0')">
    <div class="flex min-w-0 items-center gap-3 overflow-hidden">
      <button class="inline-flex h-7 w-7 items-center justify-center rounded-sm text-(--sim-muted) hover:bg-(--sim-pill-hover)">
        <span class="icon-[mdi--chevron-left]" aria-hidden="true" />
      </button>
      <button class="inline-flex h-7 w-7 items-center justify-center rounded-sm text-(--sim-muted) hover:bg-(--sim-pill-hover)">
        <span class="icon-[mdi--reload]" aria-hidden="true" />
      </button>
      <div class="flex min-w-0 items-center gap-2 rounded-sm border border-(--sim-border) bg-(--sim-panel) px-2.5 py-1">
        <span class="icon-[mdi--folder-open-outline] text-[13px] text-[#8bc34a]" aria-hidden="true" />
        <span class="truncate text-[11px] text-(--sim-text)">{{ currentRoute }}</span>
      </div>
    </div>

    <div class="flex items-center gap-1 text-(--sim-muted)">
      <button
        v-for="icon in workbenchToolbarIcons"
        :key="icon"
        class="inline-flex h-7 w-7 items-center justify-center rounded-sm hover:bg-(--sim-pill-hover)"
      >
        <span :class="cn(icon, 'text-[14px]')" aria-hidden="true" />
      </button>
    </div>

    <div class="flex items-center justify-end gap-2" role="group" aria-label="主题切换">
      <span :class="cn(labelClass, 'hidden 2xl:inline-flex')">Theme</span>
      <button
        v-for="option in themeOptions"
        :key="option.value"
        :class="cn(pill({ tone: themeMode === option.value ? 'accent' : 'neutral' }), 'h-7 rounded-sm px-2.5 py-0 text-[11px]')"
        @click="emit('setThemeMode', option.value)"
      >
        <span :class="cn(option.icon, 'text-[13px]')" aria-hidden="true" />
        {{ option.label }}
      </button>
    </div>
  </section>
</template>
