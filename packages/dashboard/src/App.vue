<script setup lang="ts">
import type { DashboardTitleBlock } from './features/dashboard/types'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import logoUrl from './assets/weapp-vite.svg'
import AppNavigationList from './features/dashboard/components/AppNavigationList.vue'
import AppShellHeader from './features/dashboard/components/AppShellHeader.vue'
import { provideDashboardTheme } from './features/dashboard/composables/useDashboardTheme'
import { createDashboardWorkspace, provideDashboardWorkspace } from './features/dashboard/composables/useDashboardWorkspace'
import { useThemeMode } from './features/dashboard/composables/useThemeMode'
import { dashboardConnectionLabels, dashboardDevtoolsName, workspaceNavigation } from './features/dashboard/constants/shell'
import { dashboardTabs, themeOptions } from './features/dashboard/constants/view'
import { dashboardConnectionStatus } from './features/dashboard/utils/dashboardDevframe'

const route = useRoute()
const mobileNavigation = useTemplateRef<HTMLDialogElement>('mobileNavigation')
const contentRoot = ref<HTMLElement | null>(null)
const { themePreference, resolvedTheme, setThemePreference } = useThemeMode()
const workspace = createDashboardWorkspace()
const hasPayload = computed(() => Boolean(workspace.resultRef.value))
const projectName = computed(() => workspace.resultRef.value?.metadata?.projectName ?? '未命名小程序')
const isAnalyzeRoute = computed(() => route.matched.some(record => record.path === '/analyze'))
const currentAnalyzeView = computed(() => dashboardTabs.find(tab => tab.key === route.query.tab) ?? dashboardTabs[0]!)
const currentAnalyzeTab = computed(() => currentAnalyzeView.value.key)

provideDashboardTheme({
  themePreference,
  resolvedTheme,
  setThemePreference,
})
provideDashboardWorkspace(workspace)

const pageMeta = computed<DashboardTitleBlock>(() => {
  if (isAnalyzeRoute.value) {
    return {
      title: currentAnalyzeView.value.label,
      description: currentAnalyzeView.value.description,
    }
  }
  if (route.path === '/tokens') {
    return {
      title: '界面样式预览',
      description: '仅供 Dashboard 开发调试，检查主题颜色、界面样式和组件状态。',
    }
  }
  const navigationItem = workspaceNavigation.find(item => item.to === route.path) ?? workspaceNavigation[0]!
  return {
    title: navigationItem.label,
    description: navigationItem.caption,
  }
})

watch(() => isAnalyzeRoute.value ? currentAnalyzeTab.value : route.path, () => {
  if (contentRoot.value) {
    contentRoot.value.scrollTop = 0
  }
}, { flush: 'post' })

function openMobileNavigation() {
  mobileNavigation.value?.showModal()
}

function closeMobileNavigation() {
  mobileNavigation.value?.close()
}
watch(() => route.fullPath, closeMobileNavigation)

let desktopViewport: MediaQueryList | undefined
function handleViewportChange(event: MediaQueryListEvent) {
  if (event.matches) {
    closeMobileNavigation()
  }
}
onMounted(() => {
  desktopViewport = window.matchMedia('(min-width: 1024px)')
  desktopViewport.addEventListener('change', handleViewportChange)
})
onBeforeUnmount(() => desktopViewport?.removeEventListener('change', handleViewportChange))
</script>

<template>
  <div class="h-dvh overflow-hidden bg-(--dashboard-bg) text-(--dashboard-text)">
    <div class="grid h-full min-w-0 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
      <aside class="hidden min-h-0 border-r border-(--dashboard-border) bg-(--dashboard-shell) lg:flex lg:flex-col">
        <div class="flex h-16 shrink-0 items-center gap-2.5 border-b border-(--dashboard-border) px-4">
          <img :src="logoUrl" alt="" class="size-7 shrink-0" width="28" height="28">
          <span class="min-w-0">
            <strong class="block truncate text-[13px] font-semibold">{{ dashboardDevtoolsName }}</strong>
            <span class="block truncate font-mono text-[10px] text-(--dashboard-text-soft)">{{ projectName }}</span>
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
              {{ dashboardConnectionLabels[dashboardConnectionStatus] }}
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
          @menu="openMobileNavigation"
          @set-theme="setThemePreference"
        />
        <div ref="contentRoot" class="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 lg:p-4">
          <RouterView />
        </div>
      </main>
    </div>

    <dialog
      ref="mobileNavigation"
      class="mobile-navigation"
      aria-label="开发工具导航"
      @click.self="closeMobileNavigation"
    >
      <div class="flex h-16 shrink-0 items-center justify-between border-b border-(--dashboard-border) px-4">
        <span class="min-w-0">
          <strong class="block truncate text-sm">{{ dashboardDevtoolsName }}</strong>
          <span class="block truncate font-mono text-xs text-(--dashboard-text-soft)">{{ projectName }}</span>
        </span>
        <button class="size-11 shrink-0 rounded-lg border border-(--dashboard-border)" type="button" aria-label="关闭导航" @click="closeMobileNavigation">
          ×
        </button>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <AppNavigationList
          :current-analyze-tab="currentAnalyzeTab"
          :current-path="route.path"
          :items="workspaceNavigation"
          @navigate="closeMobileNavigation"
        />
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.mobile-navigation {
  width: min(18rem, 90vw);
  max-width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  padding: 0;
  margin: 0;
  color: var(--dashboard-text);
  background: var(--dashboard-shell);
  border: 0;
  border-right: 1px solid var(--dashboard-border);
}

.mobile-navigation[open] {
  display: flex;
  flex-direction: column;
}

.mobile-navigation::backdrop {
  background: rgb(0 15 8 / 55%);
}
</style>
