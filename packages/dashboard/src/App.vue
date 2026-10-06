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
import { dashboardConnectionLabels, dashboardDevtoolsName, workspaceNavigation } from './features/dashboard/constants/shell'
import { dashboardTabs, themeOptions } from './features/dashboard/constants/view'
import { dashboardAnalyzeRevision, dashboardConnectionStatus } from './features/dashboard/utils/dashboardDevframe'

const route = useRoute()
const mobileNavOpen = ref(false)
const contentRoot = ref<HTMLElement | null>(null)
const { themePreference, resolvedTheme, setThemePreference } = useThemeMode()
const workspace = createDashboardWorkspace()
const hasPayload = computed(() => Boolean(workspace.resultRef.value))
const projectName = computed(() => workspace.resultRef.value?.metadata?.projectName ?? '未命名小程序')
const isAnalyzeRoute = computed(() => route.matched.some(record => record.path === '/analyze'))
const currentAnalyzeView = computed(() => dashboardTabs.find(tab => tab.key === route.query.tab) ?? dashboardTabs[0]!)
const currentAnalyzeTab = computed(() => currentAnalyzeView.value.key)
const isDiagnosticsWorkspace = computed(() => isAnalyzeRoute.value && currentAnalyzeTab.value === 'diagnostics')

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

watch(() => route.fullPath, () => {
  mobileNavOpen.value = false
})

watch(() => isAnalyzeRoute.value ? currentAnalyzeTab.value : route.path, () => {
  if (contentRoot.value) {
    contentRoot.value.scrollTop = 0
  }
}, { flush: 'post' })

function closeMobileNavigation(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    mobileNavOpen.value = false
  }
}

onMounted(() => window.addEventListener('keydown', closeMobileNavigation))
onBeforeUnmount(() => window.removeEventListener('keydown', closeMobileNavigation))
</script>

<template>
  <div class="h-dvh overflow-hidden bg-(--dashboard-bg) text-(--dashboard-text)" :class="{ 'diagnostics-workbench': isDiagnosticsWorkspace }">
    <div class="grid h-full min-w-0" :class="{ 'lg:grid-cols-[15rem_minmax(0,1fr)]': !isDiagnosticsWorkspace }">
      <aside v-if="!isDiagnosticsWorkspace" class="hidden min-h-0 border-r border-(--dashboard-border) bg-(--dashboard-panel) lg:flex lg:flex-col">
        <div class="flex h-13 shrink-0 items-center gap-2.5 border-b border-(--dashboard-border) px-3">
          <span class="flex h-7 w-7 items-center justify-center rounded bg-(--dashboard-accent-soft) text-(--dashboard-accent)">
            <span class="h-4 w-4">
              <DashboardIcon name="hero-system" />
            </span>
          </span>
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

      <main class="flex min-h-0 min-w-0 flex-col" :class="{ 'diagnostics-shell': isDiagnosticsWorkspace }">
        <AppShellHeader
          :workbench="isDiagnosticsWorkspace"
          :project-name="projectName"
          :revision="dashboardAnalyzeRevision"
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
        <div ref="contentRoot" class="min-h-0 min-w-0 flex-1 overflow-y-auto" :class="isDiagnosticsWorkspace ? 'pb-10' : 'p-3 lg:p-4'">
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
          <span class="min-w-0">
            <strong class="block truncate text-sm">{{ dashboardDevtoolsName }}</strong>
            <span class="block truncate font-mono text-[10px] text-(--dashboard-text-soft)">{{ projectName }}</span>
          </span>
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

<style scoped>
.diagnostics-shell {
  width: 100%;
  max-width: 1500px;
  padding-inline: clamp(18px, 3.33vw, 48px);
  margin-inline: auto;
}

:global([data-theme='dark']) .diagnostics-workbench {
  --dashboard-bg: #11171d;
  --dashboard-panel: #182129;
  --dashboard-panel-strong: #202b34;
  --dashboard-panel-muted: #182129;
  --dashboard-border: #35424d;
  --dashboard-border-strong: #637985;
  --dashboard-text: #e6edf1;
  --dashboard-text-muted: #a4b4c1;
  --dashboard-text-soft: #a4b4c1;
  --dashboard-accent: #72d7ed;
  --dashboard-accent-soft: #203b45;
}
</style>
