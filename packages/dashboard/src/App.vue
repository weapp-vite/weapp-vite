<script setup lang="ts">
import type { DashboardTitleBlock } from './features/dashboard/types'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppNavigationList from './features/dashboard/components/AppNavigationList.vue'
import AppShellHeader from './features/dashboard/components/AppShellHeader.vue'
import DashboardIcon from './features/dashboard/components/DashboardIcon.vue'
import { provideDashboardTheme } from './features/dashboard/composables/useDashboardTheme'
import { createDashboardWorkspace, provideDashboardWorkspace } from './features/dashboard/composables/useDashboardWorkspace'
import { useThemeMode } from './features/dashboard/composables/useThemeMode'
import { workspaceNavigation } from './features/dashboard/constants/shell'
import { themeOptions } from './features/dashboard/constants/view'
import { dashboardConnectionStatus } from './features/dashboard/utils/dashboardDevframe'

const route = useRoute()
const mobileNavOpen = ref(false)
const { themePreference, resolvedTheme, setThemePreference } = useThemeMode()
const workspace = createDashboardWorkspace()
const hasPayload = computed(() => Boolean(workspace.resultRef.value))
const currentAnalyzeTab = computed(() => typeof route.query.tab === 'string' ? route.query.tab : 'overview')

provideDashboardTheme({
  themePreference,
  resolvedTheme,
  setThemePreference,
})
provideDashboardWorkspace(workspace)

const pageMeta = computed<DashboardTitleBlock>(() => {
  if (route.path.startsWith('/analyze')) {
    return {
      title: '构建分析',
      description: '包、模块、文件与构建诊断',
    }
  }
  if (route.path.startsWith('/activity')) {
    return {
      title: '运行事件',
      description: 'Build、HMR、命令和错误',
    }
  }
  if (route.path.startsWith('/tokens')) {
    return {
      title: '设计令牌',
      description: 'Dashboard 主题与组件状态',
    }
  }
  return {
    title: '概览',
    description: '当前构建与运行会话',
  }
})

watch(() => route.fullPath, () => {
  mobileNavOpen.value = false
})

function closeMobileNavigation(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    mobileNavOpen.value = false
  }
}

onMounted(() => window.addEventListener('keydown', closeMobileNavigation))
onBeforeUnmount(() => window.removeEventListener('keydown', closeMobileNavigation))
</script>

<template>
  <div class="h-dvh overflow-hidden bg-(--dashboard-bg) text-(--dashboard-text)">
    <div class="grid h-full min-w-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside class="hidden min-h-0 border-r border-(--dashboard-border) bg-(--dashboard-panel) lg:flex lg:flex-col">
        <div class="flex h-13 shrink-0 items-center gap-2.5 border-b border-(--dashboard-border) px-3">
          <span class="flex h-7 w-7 items-center justify-center rounded bg-(--dashboard-accent-soft) text-(--dashboard-accent)">
            <span class="h-4 w-4">
              <DashboardIcon name="hero-system" />
            </span>
          </span>
          <span class="min-w-0">
            <strong class="block truncate text-[13px] font-semibold">weapp-vite DevTools</strong>
            <span class="block truncate font-mono text-[10px] text-(--dashboard-text-soft)">mini-program workspace</span>
          </span>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <AppNavigationList
            :current-analyze-tab="currentAnalyzeTab"
            :current-path="route.path"
            :items="workspaceNavigation"
          />
        </div>

        <div class="shrink-0 border-t border-(--dashboard-border) px-3 py-2.5">
          <div class="flex items-center gap-2 text-[11px]">
            <span
              class="h-1.5 w-1.5 rounded-full"
              :class="dashboardConnectionStatus === 'connected' ? 'bg-emerald-500' : dashboardConnectionStatus === 'error' ? 'bg-red-500' : 'bg-amber-500'"
            />
            <span class="truncate text-(--dashboard-text-muted)">
              {{ dashboardConnectionStatus === 'connected' ? 'Devframe connected' : dashboardConnectionStatus }}
            </span>
          </div>
          <p class="mt-1 truncate font-mono text-[10px] text-(--dashboard-text-soft)">
            {{ workspace.statusSummary.value }}
          </p>
        </div>
      </aside>

      <main class="flex min-h-0 min-w-0 flex-col">
        <AppShellHeader
          :connection-status="dashboardConnectionStatus"
          :has-payload="hasPayload"
          :package-count="workspace.resultRef.value?.packages.length ?? 0"
          :title="pageMeta.title"
          :description="pageMeta.description"
          :theme-options="themeOptions"
          :theme-preference="themePreference"
          @menu="mobileNavOpen = true"
          @set-theme="setThemePreference"
        />
        <div class="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 lg:p-4">
          <RouterView />
        </div>
      </main>
    </div>

    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="mobileNavOpen"
        class="fixed inset-0 z-40 bg-slate-950/45 lg:hidden"
        @click="mobileNavOpen = false"
      />
    </transition>

    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="-translate-x-4"
      enter-to-class="translate-x-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-4"
    >
      <aside
        v-if="mobileNavOpen"
        class="fixed inset-y-0 left-0 z-50 flex w-[min(17rem,88vw)] flex-col border-r border-(--dashboard-border) bg-(--dashboard-panel) shadow-xl lg:hidden"
      >
        <div class="flex h-13 items-center justify-between border-b border-(--dashboard-border) px-3">
          <strong class="text-sm">weapp-vite DevTools</strong>
          <button class="h-8 w-8 rounded border border-(--dashboard-border)" type="button" aria-label="关闭导航" @click="mobileNavOpen = false">
            ×
          </button>
        </div>
        <AppNavigationList
          mobile
          :current-analyze-tab="currentAnalyzeTab"
          :current-path="route.path"
          :items="workspaceNavigation"
          @navigate="mobileNavOpen = false"
        />
      </aside>
    </transition>
  </div>
</template>
