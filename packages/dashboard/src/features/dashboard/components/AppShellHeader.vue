<script setup lang="ts">
import type { DevframeConnectionStatus } from 'devframe/client'
import type { DashboardTitleBlock, ThemeOption, ThemePreference } from '../types'
import { computed } from 'vue'
import { cn } from '../../../lib/cn'
import DashboardIcon from './DashboardIcon.vue'

const props = defineProps<{
  connectionStatus: DevframeConnectionStatus
  hasPayload: boolean
  packageCount: number
  title: DashboardTitleBlock['title']
  description?: DashboardTitleBlock['description']
  themeOptions: ThemeOption[]
  themePreference: ThemePreference
}>()

const emit = defineEmits<{
  menu: []
  setTheme: [value: ThemePreference]
}>()

const currentThemeIconName = computed(() =>
  props.themeOptions.find(option => option.value === props.themePreference)?.iconName ?? 'theme-system',
)
const connectionLabel = computed(() => {
  if (props.connectionStatus === 'connected') {
    return 'Devframe connected'
  }
  if (props.connectionStatus === 'unauthorized') {
    return 'Authorization required'
  }
  return props.connectionStatus
})

function handleThemeChange(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) {
    return
  }
  const option = props.themeOptions.find(item => item.value === target.value)
  if (option) {
    emit('setTheme', option.value)
  }
}
</script>

<template>
  <header class="flex min-h-13 items-center justify-between gap-3 border-b border-(--dashboard-border) bg-(--dashboard-panel) px-3 lg:px-4">
    <div class="flex min-w-0 items-center gap-2.5">
      <button
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-(--dashboard-border) bg-(--dashboard-panel-muted) text-(--dashboard-text) lg:hidden"
        type="button"
        aria-label="打开 DevTools 导航"
        @click="emit('menu')"
      >
        <span class="h-4 w-4">
          <DashboardIcon name="nav-menu" />
        </span>
      </button>
      <div class="min-w-0">
        <div class="flex min-w-0 items-center gap-2">
          <h1 class="truncate text-sm font-semibold text-(--dashboard-text)">
            {{ title }}
          </h1>
          <span v-if="description" class="hidden truncate text-[11px] text-(--dashboard-text-soft) md:block">
            {{ description }}
          </span>
        </div>
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-1.5">
      <span class="hidden items-center gap-1.5 rounded border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2 py-1 text-[11px] text-(--dashboard-text-muted) sm:inline-flex">
        <span
          :class="cn(
            'h-1.5 w-1.5 rounded-full',
            connectionStatus === 'connected' ? 'bg-emerald-500' : connectionStatus === 'error' ? 'bg-red-500' : 'bg-amber-500',
          )"
        />
        {{ connectionLabel }}
      </span>
      <span class="hidden rounded border border-(--dashboard-border) px-2 py-1 font-mono text-[10px] text-(--dashboard-text-soft) md:inline-flex">
        {{ hasPayload ? `${packageCount} packages` : 'no payload' }}
      </span>
      <label
        class="inline-flex h-8 items-center gap-1.5 rounded border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-2 text-[11px] text-(--dashboard-text-muted)"
        for="dashboard-global-theme"
      >
        <span class="h-3.5 w-3.5 text-(--dashboard-text-soft)">
          <DashboardIcon :name="currentThemeIconName" />
        </span>
        <select
          id="dashboard-global-theme"
          class="w-17 bg-transparent text-(--dashboard-text) outline-none"
          :value="themePreference"
          aria-label="主题"
          @change="handleThemeChange"
        >
          <option
            v-for="option in themeOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>
    </div>
  </header>
</template>
