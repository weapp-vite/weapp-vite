<script setup lang="ts">
import type { DashboardNavItem } from '../types'
import { computed, shallowRef, useId, watch } from 'vue'
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

const advancedOpen = shallowRef(false)
const advancedContentId = useId()
const navigationSections = computed(() => props.items.map(item => ({
  ...item,
  commonChildren: item.children?.filter(child => !child.advanced) ?? [],
  advancedChildren: item.children?.filter(child => child.advanced) ?? [],
})))

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

const activeAdvancedItem = computed(() => navigationSections.value
  .find(item => item.to === '/analyze')
  ?.advancedChildren
  .find(child => isNavigationItemActive(child.to)))

watch([() => props.currentPath, () => props.currentAnalyzeTab], () => {
  if (activeAdvancedItem.value) {
    advancedOpen.value = true
  }
}, { immediate: true })
</script>

<template>
  <nav class="grid gap-0.5 overflow-y-auto px-2 py-2" aria-label="开发工具导航">
    <div
      v-for="item in navigationSections"
      :key="item.to"
      class="grid gap-0.5"
    >
      <RouterLink
        :to="item.to"
        :class="cn(
          'group relative flex items-center gap-2 rounded px-2.5 py-2 text-sm transition-colors',
          mobile ? 'min-h-11' : 'min-h-9',
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
        <span class="min-w-0 flex-1">{{ item.label }}</span>
      </RouterLink>

      <div
        v-if="item.children?.length && isNavigationSectionActive(item)"
        class="ml-4 grid gap-0.5 pl-2"
      >
        <RouterLink
          v-for="child in item.commonChildren"
          :key="child.to"
          :to="child.to"
          :aria-current="isNavigationItemActive(child.to) ? 'page' : undefined"
          :class="cn(
            'flex min-w-0 items-center gap-2 rounded px-2 py-1.5 text-[13px] transition-colors',
            mobile ? 'min-h-11' : 'min-h-9',
            isNavigationItemActive(child.to)
              ? 'bg-(--dashboard-panel-muted) font-medium text-(--dashboard-accent)'
              : 'text-(--dashboard-text-soft) hover:bg-(--dashboard-panel-muted) hover:text-(--dashboard-text)',
          )"
          @click="emit('navigate')"
        >
          <span class="h-3.5 w-3.5 shrink-0">
            <DashboardIcon :name="child.iconName" />
          </span>
          <span class="min-w-0">{{ child.label }}</span>
        </RouterLink>
        <template v-if="item.advancedChildren.length">
          <button
            type="button"
            class="flex min-h-11 w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-(--dashboard-text-muted) hover:bg-(--dashboard-panel-muted) hover:text-(--dashboard-text)"
            :aria-expanded="advancedOpen"
            :aria-controls="advancedContentId"
            @click="advancedOpen = !advancedOpen"
          >
            <span class="icon-[mdi--chevron-right] size-3.5 shrink-0" :class="{ 'rotate-90': advancedOpen }" aria-hidden="true" />
            <span class="min-w-0">
              更多分析
              <span v-if="!advancedOpen && activeAdvancedItem" class="block text-(--dashboard-accent)">{{ activeAdvancedItem.label }}</span>
            </span>
          </button>
          <div :id="advancedContentId" :hidden="!advancedOpen">
            <div class="grid gap-0.5">
              <RouterLink
                v-for="child in item.advancedChildren"
                :key="child.to"
                :to="child.to"
                :aria-current="isNavigationItemActive(child.to) ? 'page' : undefined"
                :class="cn(
                  'flex min-w-0 items-center gap-2 rounded px-2 py-1.5 text-[13px] transition-colors',
                  mobile ? 'min-h-11' : 'min-h-9',
                  isNavigationItemActive(child.to)
                    ? 'bg-(--dashboard-panel-muted) font-medium text-(--dashboard-accent)'
                    : 'text-(--dashboard-text-soft) hover:bg-(--dashboard-panel-muted) hover:text-(--dashboard-text)',
                )"
                @click="emit('navigate')"
              >
                <span class="h-3.5 w-3.5 shrink-0">
                  <DashboardIcon :name="child.iconName" />
                </span>
                <span class="min-w-0">{{ child.label }}</span>
              </RouterLink>
            </div>
          </div>
        </template>
      </div>
    </div>
  </nav>
</template>
