<script setup lang="ts">
import type { ThemePreference } from '../composables/useThemeMode'
import type { ThemeOption } from '../types'
import AppInfoPill from './AppInfoPill.vue'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  title: string
  description: string
  themeOptions: ThemeOption[]
  themePreference: ThemePreference
}>()

const emit = defineEmits<{
  menu: []
  setTheme: [value: ThemePreference]
}>()
</script>

<template>
  <header class="flex flex-col gap-4 rounded-[24px] border border-[color:var(--dashboard-border-strong)] bg-[color:var(--dashboard-panel-strong)] px-4 py-4 shadow-[var(--dashboard-shadow)] md:px-5">
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <button
          class="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] text-[color:var(--dashboard-text)] md:hidden"
          type="button"
          @click="emit('menu')"
        >
          <span class="h-5 w-5">
            <DashboardIcon name="nav-menu" />
          </span>
        </button>
        <div>
          <p class="text-[11px] uppercase tracking-[0.28em] text-[color:var(--dashboard-accent)]">
            weapp-vite dashboard
          </p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight md:text-[2rem]">
            {{ title }}
          </h1>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
            {{ description }}
          </p>
        </div>
      </div>

      <label
        class="hidden items-center gap-2 rounded-full border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-3 py-2 text-xs font-medium text-[color:var(--dashboard-text-soft)] md:inline-flex"
        for="dashboard-global-theme"
      >
        <span class="h-4 w-4 text-[color:var(--dashboard-accent)]">
          <DashboardIcon :name="themeOptions.find(option => option.value === themePreference)?.iconName ?? 'theme-system'" />
        </span>
        <select
          id="dashboard-global-theme"
          class="min-w-[8rem] bg-transparent text-[color:var(--dashboard-text)] outline-none"
          :value="themePreference"
          @change="emit('setTheme', ($event.target as HTMLSelectElement).value as ThemePreference)"
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
        class="inline-flex items-center gap-2 rounded-full border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-3 py-2 text-xs font-medium text-[color:var(--dashboard-text-soft)]"
        for="dashboard-mobile-theme"
      >
        <span class="h-4 w-4 text-[color:var(--dashboard-accent)]">
          <DashboardIcon :name="themeOptions.find(option => option.value === themePreference)?.iconName ?? 'theme-system'" />
        </span>
        <select
          id="dashboard-mobile-theme"
          class="min-w-[8rem] bg-transparent text-[color:var(--dashboard-text)] outline-none"
          :value="themePreference"
          @change="emit('setTheme', ($event.target as HTMLSelectElement).value as ThemePreference)"
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
