<script setup lang="ts">
import type { DashboardNavItem } from '../types'
import { RouterLink } from 'vue-router'
import { cn } from '../../../lib/cn'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  items: DashboardNavItem[]
  activePath: string
}>()

const emit = defineEmits<{
  navigate: []
}>()

function isActive(currentPath: string, targetPath: string) {
  if (targetPath === '/') {
    return currentPath === '/'
  }

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
}
</script>

<template>
  <nav class="grid gap-2">
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      :class="cn(
        'group rounded-[18px] border px-3 py-3 transition',
        isActive(activePath, item.to)
          ? 'border-[color:var(--dashboard-border-strong)] bg-[color:var(--dashboard-panel-strong)] shadow-[var(--dashboard-shadow)]'
          : 'border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] hover:border-[color:var(--dashboard-border-strong)] hover:bg-[color:var(--dashboard-panel)]',
      )"
      @click="emit('navigate')"
    >
      <div class="flex items-start gap-3">
        <span
          :class="cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
            isActive(activePath, item.to)
              ? 'bg-[color:var(--dashboard-accent-soft)] text-[color:var(--dashboard-accent)]'
              : 'bg-[color:var(--dashboard-panel)] text-[color:var(--dashboard-text-soft)] group-hover:text-[color:var(--dashboard-accent)]',
          )"
        >
          <span class="h-5 w-5">
            <DashboardIcon :name="item.iconName" />
          </span>
        </span>
        <div class="min-w-0">
          <p class="font-medium text-[color:var(--dashboard-text)]">
            {{ item.label }}
          </p>
          <p class="mt-1 text-xs leading-5 text-[color:var(--dashboard-text-soft)]">
            {{ item.caption }}
          </p>
        </div>
      </div>
    </RouterLink>
  </nav>
</template>
