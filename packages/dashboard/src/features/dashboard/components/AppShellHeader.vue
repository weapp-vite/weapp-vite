<script setup lang="ts">
import type { DashboardTitleBlock, ThemeOption, ThemePreference } from '../types'
import { computed } from 'vue'
import AppInfoPill from './AppInfoPill.vue'
import DashboardIcon from './DashboardIcon.vue'

const props = defineProps<{
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

function handleThemeChange(event: Event): void {
  emit('setTheme', (event.target as HTMLSelectElement).value as ThemePreference)
}
</script>

<template>
  <header class="flex flex-col gap-3 rounded-lg border border-(--dashboard-border-strong) bg-(--dashboard-panel-strong) px-4 py-3 shadow-(--dashboard-shadow) md:px-5">
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <button
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) text-(--dashboard-text) md:hidden"
          type="button"
          @click="emit('menu')"
        >
          <span class="h-5 w-5">
            <DashboardIcon name="nav-menu" />
          </span>
        </button>
        <div>
          <p class="text-[11px] uppercase tracking-[0.28em] text-(--dashboard-accent)">
            weapp-vite dashboard
          </p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight md:text-[1.8rem]">
            {{ title }}
          </h1>
          <p v-if="description" class="mt-1 max-w-3xl text-sm leading-6 text-(--dashboard-text-muted)">
            {{ description }}
          </p>
        </div>
      </div>

      <label
        class="hidden items-center gap-2 rounded-full border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2 text-xs font-medium text-(--dashboard-text-soft) md:inline-flex"
        for="dashboard-global-theme"
      >
        <span class="h-4 w-4 text-(--dashboard-accent)">
          <DashboardIcon :name="currentThemeIconName" />
        </span>
        <select
          id="dashboard-global-theme"
          class="min-w-32 bg-transparent text-(--dashboard-text) outline-none"
          :value="themePreference"
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

    <div class="flex flex-wrap items-center gap-2 md:hidden">
      <label
        class="inline-flex items-center gap-2 rounded-full border border-(--dashboard-border) bg-(--dashboard-panel-muted) px-3 py-2 text-xs font-medium text-(--dashboard-text-soft)"
        for="dashboard-mobile-theme"
      >
        <span class="h-4 w-4 text-(--dashboard-accent)">
          <DashboardIcon :name="currentThemeIconName" />
        </span>
        <select
          id="dashboard-mobile-theme"
          class="min-w-32 bg-transparent text-(--dashboard-text) outline-none"
          :value="themePreference"
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

      <AppInfoPill icon-name="status-live" label="shell ready" uppercase />
    </div>
  </header>
</template>
