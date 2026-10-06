<script setup lang="ts">
import type { DashboardNavItem } from '../types'
import { computed, shallowRef, useId, watch } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps<{
  currentAnalyzeTab: string
  currentPath: string
  items: DashboardNavItem[]
}>()

const emit = defineEmits<{
  navigate: []
}>()

const advancedOpen = shallowRef(false)
const advancedContentId = useId()
const navigationSections = computed(() => {
  let index = 0
  const nextNumber = () => String(++index).padStart(2, '0')
  return props.items.map((item) => {
    const number = nextNumber()
    const commonChildren = (item.children ?? [])
      .filter(child => !child.advanced)
      .map(child => ({ ...child, number: nextNumber() }))
    const advancedChildren = (item.children ?? []).filter(child => child.advanced)
    return {
      ...item,
      number,
      commonChildren,
      advancedChildren,
      advancedNumber: advancedChildren.length ? nextNumber() : null,
    }
  })
})

function isActive(targetPath: string) {
  if (targetPath === '/') {
    return props.currentPath === '/'
  }

  return props.currentPath === targetPath || props.currentPath.startsWith(`${targetPath}/`)
}

function getAnalyzeTabFromPath(targetPath: string) {
  const queryIndex = targetPath.indexOf('?')
  if (queryIndex === -1) {
    return 'diagnostics'
  }
  return new URLSearchParams(targetPath.slice(queryIndex + 1)).get('tab') ?? 'diagnostics'
}

function isNavigationItemActive(targetPath: string) {
  if (targetPath.startsWith('/analyze')) {
    return props.currentPath === '/analyze' && getAnalyzeTabFromPath(targetPath) === props.currentAnalyzeTab
  }
  return isActive(targetPath)
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
  <nav class="workbench-navigation" aria-label="开发工具导航">
    <p class="navigation-heading">开发工作台</p>
    <div v-for="item in navigationSections" :key="item.to" class="navigation-section">
      <RouterLink
        :to="item.to"
        class="navigation-link"
        :class="{ 'is-active': !item.children?.length && isNavigationItemActive(item.to) }"
        :aria-current="!item.children?.length && isNavigationItemActive(item.to) ? 'page' : 'false'"
        @click="emit('navigate')"
      >
        <span class="navigation-number" aria-hidden="true">{{ item.number }}</span>
        <span>{{ item.label }}</span>
      </RouterLink>
      <RouterLink
        v-for="child in item.commonChildren"
        :key="child.to"
        :to="child.to"
        class="navigation-link"
        :class="{ 'is-active': isNavigationItemActive(child.to) }"
        :aria-current="isNavigationItemActive(child.to) ? 'page' : 'false'"
        @click="emit('navigate')"
      >
        <span class="navigation-number" aria-hidden="true">{{ child.number }}</span>
        <span>{{ child.label }}</span>
      </RouterLink>
      <template v-if="item.advancedChildren.length">
        <button
          type="button"
          class="navigation-link navigation-disclosure"
          :aria-expanded="advancedOpen"
          :aria-controls="advancedContentId"
          @click="advancedOpen = !advancedOpen"
        >
          <span class="navigation-number" aria-hidden="true">{{ item.advancedNumber }}</span>
          <span class="min-w-0 flex-1">
            更多分析
            <span v-if="!advancedOpen && activeAdvancedItem" class="block text-xs text-(--dashboard-accent)">{{ activeAdvancedItem.label }}</span>
          </span>
          <span class="icon-[mdi--chevron-right] size-4 shrink-0" :class="{ 'rotate-90': advancedOpen }" aria-hidden="true" />
        </button>
        <div :id="advancedContentId" class="navigation-advanced" :hidden="!advancedOpen">
          <RouterLink
            v-for="(child, index) in item.advancedChildren"
            :key="child.to"
            :to="child.to"
            class="navigation-link"
            :class="{ 'is-active': isNavigationItemActive(child.to) }"
            :aria-current="isNavigationItemActive(child.to) ? 'page' : 'false'"
            @click="emit('navigate')"
          >
            <span class="navigation-number" aria-hidden="true">{{ item.advancedNumber }}.{{ index + 1 }}</span>
            <span>{{ child.label }}</span>
          </RouterLink>
        </div>
      </template>
    </div>
  </nav>
</template>

<style scoped>
.workbench-navigation {
  display: grid;
  gap: 0.5rem;
  padding: 1.5rem 0.875rem;
}

.navigation-heading {
  padding-inline: 0.75rem;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  color: var(--dashboard-text-soft);
}

.navigation-section {
  display: grid;
  gap: 0.375rem;
}

.navigation-link {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--dashboard-text-muted);
  text-align: left;
  text-decoration: none;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  transition: background-color 120ms ease, border-color 120ms ease;
}

.navigation-link:hover {
  color: var(--dashboard-text);
  background: var(--dashboard-panel-muted);
}

.navigation-link.is-active {
  font-weight: 600;
  color: var(--dashboard-text);
  background: var(--dashboard-accent-soft);
  border-color: color-mix(in srgb, var(--dashboard-accent) 24%, transparent);
  box-shadow: inset 3px 0 var(--dashboard-accent);
}

.navigation-number {
  flex: 0 0 1.5rem;
  font-family: var(--dashboard-code);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--dashboard-text-soft);
}

.is-active .navigation-number {
  color: var(--dashboard-accent);
}

.navigation-advanced:not([hidden]) {
  display: grid;
  gap: 0.375rem;
  padding-left: 0.5rem;
  margin-left: 0.75rem;
  border-left: 1px solid var(--dashboard-border);
}

.navigation-advanced .navigation-number {
  flex-basis: 2rem;
  font-size: 0.6875rem;
}

@media (prefers-reduced-motion: reduce) {
  .navigation-link {
    transition: none;
  }
}
</style>
