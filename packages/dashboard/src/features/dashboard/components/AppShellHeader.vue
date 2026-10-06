<script setup lang="ts">
import type { DevframeConnectionStatus } from 'devframe/client'
import type { DashboardTitleBlock, ThemeOption, ThemePreference } from '../types'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import logoUrl from '../../../assets/weapp-vite.svg'
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
  workbench?: boolean
  projectName?: string
  revision?: number | null
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
    class="shrink-0 items-center"
    :class="workbench
      ? 'flex min-h-20 flex-wrap gap-x-5 gap-y-3 py-4'
      : 'grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-(--dashboard-border) bg-(--dashboard-panel) px-3 py-2 lg:px-4'"
  >
    <div :class="workbench ? 'contents' : 'flex min-w-0 items-center gap-2.5'">
      <button
        v-if="!workbench"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-(--dashboard-border) bg-(--dashboard-panel-muted) text-(--dashboard-text) lg:hidden"
        type="button"
        aria-label="打开 DevTools 导航"
        @click="emit('menu')"
      >
        <span class="h-4 w-4">
          <DashboardIcon name="nav-menu" />
        </span>
      </button>
      <RouterLink v-if="workbench" to="/" aria-label="返回 DevTools 概览" class="inline-flex shrink-0 items-center gap-2.5">
        <img :src="logoUrl" alt="" class="size-7" width="28" height="28">
        <h1 class="font-mono text-[17px] font-semibold">weapp-vite</h1>
      </RouterLink>
      <h1 v-else class="min-w-0 text-base leading-6 font-semibold text-(--dashboard-text)">{{ title }}</h1>
      <p v-if="workbench" class="order-2 w-full min-w-0 border-l border-(--dashboard-border) pl-4 text-sm text-(--dashboard-text-muted) sm:order-none sm:w-auto">{{ projectName }} / {{ title }}</p>
    </div>

    <div class="flex shrink-0 items-center gap-1.5" :class="{ 'ml-auto': workbench }">
      <span v-if="workbench && revision != null" class="hidden font-mono text-xs text-(--dashboard-text-muted) sm:inline">R{{ revision }}</span>
      <span class="hidden items-center gap-1.5 text-xs text-(--dashboard-text-muted) sm:inline-flex">
        <span
          :class="cn(
            'h-1.5 w-1.5 rounded-full',
            connectionStatus === 'connected' ? 'bg-emerald-500' : connectionStatus === 'error' ? 'bg-red-500' : 'bg-amber-500',
          )"
        />
        {{ dashboardConnectionLabels[connectionStatus] }}
      </span>
      <span v-if="!workbench" class="hidden text-xs text-(--dashboard-text-soft) lg:inline-flex">
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
    <p v-if="description && !workbench" class="col-span-2 text-[13px] leading-5 text-(--dashboard-text-muted)">
      {{ description }}
    </p>
  </header>
</template>
