<script setup lang="ts">
import type { DevframeConnectionStatus } from 'devframe/client'
import type { DashboardTitleBlock, ThemeOption, ThemePreference } from '../types'
import { computed } from 'vue'
import { cn } from '../../../lib/cn'
import { dashboardConnectionLabels } from '../constants/shell'
import AppSelect from './AppSelect.vue'
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
</script>

<template>
  <header
    class="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-(--dashboard-border) bg-(--dashboard-panel) px-3 py-2 lg:px-4"
  >
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
      <h1 class="min-w-0 text-base leading-6 font-semibold text-(--dashboard-text)">{{ title }}</h1>
    </div>

    <div class="flex shrink-0 items-center gap-1.5">
      <span class="hidden items-center gap-1.5 text-xs text-(--dashboard-text-muted) sm:inline-flex">
        <span
          :class="cn(
            'h-1.5 w-1.5 rounded-full',
            connectionStatus === 'connected' ? 'bg-emerald-500' : connectionStatus === 'error' ? 'bg-red-500' : 'bg-amber-500',
          )"
        />
        {{ dashboardConnectionLabels[connectionStatus] }}
      </span>
      <span class="hidden text-xs text-(--dashboard-text-soft) lg:inline-flex">
        {{ hasPayload ? `${packageCount} 个包体` : '等待构建报告' }}
      </span>
      <div class="inline-flex items-center gap-1.5 text-[11px] text-(--dashboard-text-muted)">
        <span class="h-3.5 w-3.5 text-(--dashboard-text-soft)">
          <DashboardIcon :name="currentThemeIconName" />
        </span>
        <AppSelect
          class="w-24"
          label="主题"
          :model-value="themePreference"
          :options="themeOptions"
          size="sm"
          @update:model-value="emit('setTheme', $event)"
        />
      </div>
    </div>
    <p v-if="description" class="col-span-2 text-[13px] leading-5 text-(--dashboard-text-muted)">
      {{ description }}
    </p>
  </header>
</template>
