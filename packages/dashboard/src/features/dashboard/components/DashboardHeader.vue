<script setup lang="ts">
import type { ThemePreference } from '../composables/useThemeMode'
import type { ThemeOption } from '../types'
import { cn } from '../../../lib/cn'
import { metricCardStyles, pillButtonStyles, surfaceStyles } from '../utils/styles'
import AppThemeSelectPill from './AppThemeSelectPill.vue'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  statusText: string
  lastUpdatedAt: string
  subpackageCount: number
  themeOptions: ThemeOption[]
  themePreference: ThemePreference
  resolvedTheme: 'light' | 'dark'
  statusTone: string
}>()

const emit = defineEmits<{
  setTheme: [value: ThemePreference]
}>()
</script>

<template>
  <header :class="surfaceStyles({ tone: 'strong', padding: 'header' })">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div class="max-w-3xl space-y-2">
        <p class="text-[11px] uppercase tracking-[0.32em] text-[color:var(--dashboard-accent)]">
          weapp-vite UI
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight md:text-[2rem]">
            Analyze Workspace
          </h1>
          <span :class="cn(pillButtonStyles({ kind: 'badge' }))">
            <span class="h-4 w-4 text-[color:var(--dashboard-accent)]">
              <DashboardIcon :name="statusTone" />
            </span>
            {{ resolvedTheme === 'dark' ? 'dark console' : 'light console' }}
          </span>
        </div>
        <p class="max-w-2xl text-sm leading-6 text-[color:var(--dashboard-text-muted)]">
          统一查看主包、分包、chunk、asset 与跨包模块映射。当前页面是 `--ui` 的分析视图，后续可继续挂接更多调试面板。
        </p>
      </div>

      <div class="flex flex-col gap-3 xl:min-w-[31rem]">
        <div class="flex items-center justify-start gap-2 xl:justify-end">
          <AppThemeSelectPill
            input-id="dashboard-theme-select"
            :theme-options="themeOptions"
            :theme-preference="themePreference"
            @select="emit('setTheme', $event)"
          />
        </div>

        <div class="grid gap-2 text-sm sm:grid-cols-3">
          <div :class="metricCardStyles()">
            <p class="text-[11px] uppercase tracking-[0.2em] text-[color:var(--dashboard-text-soft)]">
              同步状态
            </p>
            <p class="mt-1.5 text-base font-semibold md:text-lg">
              {{ statusText }}
            </p>
          </div>
          <div :class="metricCardStyles()">
            <p class="text-[11px] uppercase tracking-[0.2em] text-[color:var(--dashboard-text-soft)]">
              最近刷新
            </p>
            <p class="mt-1.5 text-base font-semibold md:text-lg">
              {{ lastUpdatedAt }}
            </p>
          </div>
          <div :class="metricCardStyles()">
            <p class="text-[11px] uppercase tracking-[0.2em] text-[color:var(--dashboard-text-soft)]">
              分包配置
            </p>
            <p class="mt-1.5 text-base font-semibold md:text-lg">
              {{ subpackageCount }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
