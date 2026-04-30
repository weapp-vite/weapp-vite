<script setup lang="ts">
import type { DashboardTitleBlock } from './features/dashboard/types'
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppShellHeader from './features/dashboard/components/AppShellHeader.vue'
import AppSurfaceCard from './features/dashboard/components/AppSurfaceCard.vue'
import DashboardIcon from './features/dashboard/components/DashboardIcon.vue'
import { provideDashboardTheme } from './features/dashboard/composables/useDashboardTheme'
import { createDashboardWorkspace, provideDashboardWorkspace } from './features/dashboard/composables/useDashboardWorkspace'
import { useThemeMode } from './features/dashboard/composables/useThemeMode'
import { workspaceNavigation } from './features/dashboard/constants/shell'
import { themeOptions } from './features/dashboard/constants/view'
import { cn } from './lib/cn'

const route = useRoute()
const mobileNavOpen = ref(false)
const { themePreference, resolvedTheme, setThemePreference } = useThemeMode()
const workspace = createDashboardWorkspace()
const hasPayload = computed(() => Boolean(workspace.resultRef.value))

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

function isActive(currentPath: string, targetPath: string) {
  if (targetPath === '/') {
    return currentPath === '/'
  }

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
}

function getAnalyzeTabFromPath(targetPath: string) {
  const queryIndex = targetPath.indexOf('?')
  if (queryIndex === -1) {
    return 'overview'
  }
  return new URLSearchParams(targetPath.slice(queryIndex + 1)).get('tab') ?? 'overview'
}

function isNavigationItemActive(targetPath: string) {
  if (targetPath.startsWith('/analyze')) {
    if (route.path !== '/analyze') {
      return false
    }
    const currentTab = typeof route.query.tab === 'string' ? route.query.tab : 'overview'
    return getAnalyzeTabFromPath(targetPath) === currentTab
  }
  return isActive(route.path, targetPath)
}

function isNavigationSectionActive(item: { to: string, children?: Array<{ to: string }> }) {
  return isActive(route.path, item.to) || Boolean(item.children?.some(child => isNavigationItemActive(child.to)))
}
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
            <nav class="grid gap-2 overflow-y-auto pr-1">
              <div
                v-for="item in workspaceNavigation"
                :key="item.to"
                class="grid gap-1"
              >
                <RouterLink
                  :to="item.to"
                  :class="cn(
                    'group rounded-md border px-3 py-3 transition',
                    isNavigationSectionActive(item)
                      ? 'border-(--dashboard-border-strong) bg-(--dashboard-panel-strong) shadow-(--dashboard-shadow)'
                      : 'border-(--dashboard-border) bg-(--dashboard-panel-muted) hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)',
                  )"
                >
                  <div class="flex items-start gap-3">
                    <span
                      :class="cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                        isNavigationSectionActive(item)
                          ? 'bg-(--dashboard-accent-soft) text-(--dashboard-accent)'
                          : 'bg-(--dashboard-panel) text-(--dashboard-text-soft) group-hover:text-(--dashboard-accent)',
                      )"
                    >
                      <span class="h-5 w-5">
                        <DashboardIcon :name="item.iconName" />
                      </span>
                    </span>
                    <div class="min-w-0">
                      <p class="font-medium text-(--dashboard-text)">
                        {{ item.label }}
                      </p>
                      <p class="mt-0.5 truncate text-xs leading-5 text-(--dashboard-text-soft)">
                        {{ item.caption }}
                      </p>
                    </div>
                  </div>
                </RouterLink>
                <div
                  v-if="item.children?.length && isNavigationSectionActive(item)"
                  class="ml-5 grid gap-1 border-l border-(--dashboard-border) pl-3"
                >
                  <RouterLink
                    v-for="child in item.children"
                    :key="child.to"
                    :to="child.to"
                    :class="cn(
                      'group flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-sm transition',
                      isNavigationItemActive(child.to)
                        ? 'bg-(--dashboard-accent-soft) text-(--dashboard-accent)'
                        : 'text-(--dashboard-text-soft) hover:bg-(--dashboard-panel-muted) hover:text-(--dashboard-text)',
                    )"
                  >
                    <span class="h-4 w-4 shrink-0">
                      <DashboardIcon :name="child.iconName" />
                    </span>
                    <span class="min-w-0 truncate">{{ child.label }}</span>
                  </RouterLink>
                </div>
              </div>
            </nav>
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
          <nav class="grid gap-2 overflow-y-auto pr-1">
            <div
              v-for="item in workspaceNavigation"
              :key="item.to"
              class="grid gap-1"
            >
              <RouterLink
                :to="item.to"
                :class="cn(
                  'group rounded-md border px-3 py-3 transition',
                  isNavigationSectionActive(item)
                    ? 'border-(--dashboard-border-strong) bg-(--dashboard-panel-strong) shadow-(--dashboard-shadow)'
                    : 'border-(--dashboard-border) bg-(--dashboard-panel-muted) hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)',
                )"
                @click="mobileNavOpen = false"
              >
                <div class="flex items-start gap-3">
                  <span
                    :class="cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                      isNavigationSectionActive(item)
                        ? 'bg-(--dashboard-accent-soft) text-(--dashboard-accent)'
                        : 'bg-(--dashboard-panel) text-(--dashboard-text-soft) group-hover:text-(--dashboard-accent)',
                    )"
                  >
                    <span class="h-5 w-5">
                      <DashboardIcon :name="item.iconName" />
                    </span>
                  </span>
                  <div class="min-w-0">
                    <p class="font-medium text-(--dashboard-text)">
                      {{ item.label }}
                    </p>
                    <p class="mt-1 text-xs leading-5 text-(--dashboard-text-soft)">
                      {{ item.caption }}
                    </p>
                  </div>
                </div>
              </RouterLink>
              <div
                v-if="item.children?.length && isNavigationSectionActive(item)"
                class="ml-5 grid gap-1 border-l border-(--dashboard-border) pl-3"
              >
                <RouterLink
                  v-for="child in item.children"
                  :key="child.to"
                  :to="child.to"
                  :class="cn(
                    'group flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-sm transition',
                    isNavigationItemActive(child.to)
                      ? 'bg-(--dashboard-accent-soft) text-(--dashboard-accent)'
                      : 'text-(--dashboard-text-soft) hover:bg-(--dashboard-panel-muted) hover:text-(--dashboard-text)',
                  )"
                  @click="mobileNavOpen = false"
                >
                  <span class="h-4 w-4 shrink-0">
                    <DashboardIcon :name="child.iconName" />
                  </span>
                  <span class="min-w-0 truncate">{{ child.label }}</span>
                </RouterLink>
              </div>
            </div>
          </nav>
        </AppSurfaceCard>
      </aside>
    </transition>
  </div>
</template>
