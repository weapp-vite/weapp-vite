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
  <nav class="grid gap-2 overflow-y-auto pr-1">
    <div
      v-for="item in items"
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
        @click="emit('navigate')"
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
            <p
              class="text-xs leading-5 text-(--dashboard-text-soft)"
              :class="mobile ? 'mt-1' : 'mt-0.5 truncate'"
            >
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
          @click="emit('navigate')"
        >
          <span class="h-4 w-4 shrink-0">
            <DashboardIcon :name="child.iconName" />
          </span>
          <span class="min-w-0 truncate">{{ child.label }}</span>
        </RouterLink>
      </div>
    </div>
  </nav>
</template>
