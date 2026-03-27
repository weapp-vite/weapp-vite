<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppShellHeader from './features/dashboard/components/AppShellHeader.vue'
import AppShellNav from './features/dashboard/components/AppShellNav.vue'
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

provideDashboardTheme({
  themePreference,
  resolvedTheme,
  setThemePreference,
})
provideDashboardWorkspace(workspace)

const pageMeta = computed(() => {
  if (route.path.startsWith('/analyze')) {
    return {
      title: 'Analyze Workspace',
      description: '保留现有构建分析能力，并把包、模块与分包视图收敛进可持续扩展的应用框架。',
    }
  }

  if (route.path.startsWith('/activity')) {
    return {
      title: 'Activity Stream',
      description: '用统一的事件、诊断和下一步动作承载未来的 dev/build/ui 运行轨迹。',
    }
  }

  if (route.path.startsWith('/tokens')) {
    return {
      title: 'Design Tokens',
      description: '集中验证 dashboard 的色彩、表面和排版语义，避免后续页面各自漂移。',
    }
  }

  return {
    title: 'Workspace Console',
    description: '这是 dashboard 的新入口页，用来承载基础壳子、命令面板和后续不断增强的调试模块。',
  }
})

watch(() => route.fullPath, () => {
  mobileNavOpen.value = false
})
</script>

<template>
  <div class="min-h-screen px-3 py-3 text-[color:var(--dashboard-text)] md:px-4 md:py-4 lg:px-5">
    <div class="mx-auto grid max-w-[1600px] gap-3 lg:grid-cols-[18.5rem_minmax(0,1fr)]">
      <aside class="hidden lg:block">
        <div class="sticky top-4 space-y-3">
          <AppSurfaceCard
            eyebrow="Shell"
            title="weapp-vite dashboard"
            description="先搭好稳定壳子，再把 analyze、诊断、日志、MCP 等能力持续挂接进来。"
            icon-name="hero-system"
            tone="strong"
          >
            <AppShellNav :items="workspaceNavigation" :active-path="route.path" />
          </AppSurfaceCard>
          <AppSurfaceCard
            eyebrow="Theme"
            :title="workspace.statusLabel.value"
            :description="workspace.statusSummary.value"
            :icon-name="hasPayload ? 'status-live' : (resolvedTheme === 'dark' ? 'theme-dark' : 'theme-light')"
            padding="sm"
          />
        </div>
      </aside>

      <div class="min-w-0 space-y-3">
        <AppShellHeader
          :title="pageMeta.title"
          :description="pageMeta.description"
          :theme-options="themeOptions"
          :theme-preference="themePreference"
          @menu="mobileNavOpen = true"
          @set-theme="setThemePreference"
        />

        <RouterView />
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
          description="路由已经是第一层扩展边界，后续增强优先新增页面，不再继续堆叠单页。"
          icon-name="nav-menu"
          tone="strong"
          content-class="h-full"
        >
          <AppShellNav :items="workspaceNavigation" :active-path="route.path" @navigate="mobileNavOpen = false" />
        </AppSurfaceCard>
      </aside>
    </transition>
  </div>
</template>
