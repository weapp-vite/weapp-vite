<script setup lang="ts">
import type { DashboardNavItem } from '../types'
import { RouterLink } from 'vue-router'
import { cn } from '../../../lib/cn'
import DashboardIcon from './DashboardIcon.vue'

const props = withDefaults(defineProps<{
  currentAnalyzeTab: string
  currentPath: string
  items: DashboardNavItem[]
  mobile?: boolean
}>(), {
  mobile: false,
})

const emit = defineEmits<{
  navigate: []
}>()

function isActive(targetPath: string) {
  if (targetPath === '/') {
    return props.currentPath === '/'
  }

  return props.currentPath === targetPath || props.currentPath.startsWith(`${targetPath}/`)
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
    return props.currentPath === '/analyze' && getAnalyzeTabFromPath(targetPath) === props.currentAnalyzeTab
  }
  return isActive(targetPath)
}

function isNavigationSectionActive(item: DashboardNavItem) {
  return isActive(item.to) || Boolean(item.children?.some(child => isNavigationItemActive(child.to)))
}
</script>

<template>
  <nav class="grid gap-0.5 overflow-y-auto px-2 py-2" aria-label="DevTools modules">
    <div
      v-for="item in items"
      :key="item.to"
      class="grid gap-0.5"
    >
      <RouterLink
        :to="item.to"
        :class="cn(
          'group relative flex min-h-9 items-center gap-2 rounded px-2.5 py-2 text-[13px] transition-colors',
          isNavigationSectionActive(item)
            ? 'bg-(--dashboard-accent-soft) font-medium text-(--dashboard-text)'
            : 'text-(--dashboard-text-muted) hover:bg-(--dashboard-panel-muted) hover:text-(--dashboard-text)',
        )"
        @click="emit('navigate')"
      >
        <span
          v-if="isNavigationSectionActive(item)"
          class="absolute inset-y-1 left-0 w-0.5 rounded-full bg-(--dashboard-accent)"
        />
        <span
          :class="cn(
            'h-4 w-4 shrink-0',
            isNavigationSectionActive(item) ? 'text-(--dashboard-accent)' : 'text-(--dashboard-text-soft)',
          )"
        >
          <DashboardIcon :name="item.iconName" />
        </span>
        <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
      </RouterLink>

      <p
        v-if="mobile || isNavigationSectionActive(item)"
        class="px-8 pb-1 text-[10px] leading-4 text-(--dashboard-text-soft)"
      >
        {{ item.caption }}
      </p>

      <div
        v-if="item.children?.length && isNavigationSectionActive(item)"
        class="ml-4 grid gap-0.5 border-l border-(--dashboard-border) pl-2"
      >
        <RouterLink
          v-for="child in item.children"
          :key="child.to"
          :to="child.to"
          :class="cn(
            'flex min-h-8 min-w-0 items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors',
            isNavigationItemActive(child.to)
              ? 'bg-(--dashboard-panel-muted) font-medium text-(--dashboard-accent)'
              : 'text-(--dashboard-text-soft) hover:bg-(--dashboard-panel-muted) hover:text-(--dashboard-text)',
          )"
          @click="emit('navigate')"
        >
          <span class="h-3.5 w-3.5 shrink-0">
            <DashboardIcon :name="child.iconName" />
          </span>
          <span class="min-w-0 truncate">{{ child.label }}</span>
        </RouterLink>
      </div>
    </div>
  </nav>
</template>
