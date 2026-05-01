<script setup lang="ts">
import type { DashboardTitleBlock } from './features/dashboard/types'
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppNavigationList from './features/dashboard/components/AppNavigationList.vue'
import AppShellHeader from './features/dashboard/components/AppShellHeader.vue'
import AppSurfaceCard from './features/dashboard/components/AppSurfaceCard.vue'
import { provideDashboardTheme } from './features/dashboard/composables/useDashboardTheme'
import { createDashboardWorkspace, provideDashboardWorkspace } from './features/dashboard/composables/useDashboardWorkspace'
import { useThemeMode } from './features/dashboard/composables/useThemeMode'
import { workspaceNavigation } from './features/dashboard/constants/shell'
import { themeOptions } from './features/dashboard/constants/view'

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
      title: 'Analyze Workspace',
    }
  }

  if (route.path.startsWith('/activity')) {
    return {
      title: 'Activity Stream',
    }
  }

  if (route.path.startsWith('/tokens')) {
    return {
      title: 'Design Tokens',
    }
  }

  return {
    title: 'Workspace Console',
  }
})

watch(() => route.fullPath, () => {
  mobileNavOpen.value = false
})
</script>

<template>
  <div class="h-dvh overflow-hidden px-3 py-3 text-(--dashboard-text) md:px-4 md:py-4 lg:px-5">
    <div class="mx-auto grid h-full max-w-400 gap-3 overflow-hidden lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside class="hidden min-h-0 overflow-hidden lg:block">
        <div class="grid h-full grid-rows-[minmax(0,1fr)_auto] gap-3">
          <AppSurfaceCard
            eyebrow="Shell"
            title="weapp-vite dashboard"
            icon-name="hero-system"
            tone="strong"
            content-class="min-h-0 overflow-hidden"
          >
            <AppNavigationList
              :current-analyze-tab="currentAnalyzeTab"
              :current-path="route.path"
              :items="workspaceNavigation"
            />
          </AppSurfaceCard>
          <AppSurfaceCard
            eyebrow="Status"
            :title="workspace.statusLabel.value"
            :description="workspace.statusSummary.value"
            :icon-name="hasPayload ? 'status-live' : (resolvedTheme === 'dark' ? 'theme-dark' : 'theme-light')"
            padding="sm"
          />
        </div>
      </aside>

      <div class="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
        <AppShellHeader
          :title="pageMeta.title"
          :description="pageMeta.description"
          :theme-options="themeOptions"
          :theme-preference="themePreference"
          @menu="mobileNavOpen = true"
          @set-theme="setThemePreference"
        />

        <div class="min-h-0 overflow-hidden">
          <RouterView />
        </div>
      </div>
    </div>

    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="mobileNavOpen"
        class="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm lg:hidden"
        @click="mobileNavOpen = false"
      />
    </transition>

    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-x-6 opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="-translate-x-6 opacity-0"
    >
      <aside
        v-if="mobileNavOpen"
        class="fixed inset-y-3 left-3 z-50 w-[min(22rem,calc(100vw-1.5rem))] lg:hidden"
      >
        <AppSurfaceCard
          eyebrow="Navigation"
          title="Workspace Modules"
          description="选择要查看的工作区。"
          icon-name="nav-menu"
          tone="strong"
          content-class="h-full"
        >
          <AppNavigationList
            mobile
            :current-analyze-tab="currentAnalyzeTab"
            :current-path="route.path"
            :items="workspaceNavigation"
            @navigate="mobileNavOpen = false"
          />
        </AppSurfaceCard>
      </aside>
    </transition>
  </div>
</template>
