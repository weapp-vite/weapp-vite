<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  groupCount: number
  initialExpandedCount?: number
}>(), {
  initialExpandedCount: 1,
})

const toolbar = ref<HTMLElement>()
const page = ref<HTMLElement>()
const expandedCount = ref(props.initialExpandedCount)

function groups() {
  return [...(page.value?.querySelectorAll<HTMLDetailsElement>('details[data-wevu-api-group]') || [])]
}

function syncCounts() {
  const items = groups()
  expandedCount.value = items.filter(item => item.open).length
}

function setAllGroups(open: boolean) {
  for (const group of groups()) {
    group.open = open
  }
  syncCounts()
}

function groupForTarget(target: HTMLElement) {
  const parentGroup = target.closest<HTMLDetailsElement>('details[data-wevu-api-group]')
  if (parentGroup) {
    return parentGroup
  }

  const sibling = target.nextElementSibling
  return sibling?.matches('details[data-wevu-api-group]') ? sibling as HTMLDetailsElement : null
}

async function openHashTarget() {
  if (typeof window === 'undefined' || !window.location.hash) {
    return
  }

  await nextTick()
  const id = decodeURIComponent(window.location.hash.slice(1))
  const target = document.getElementById(id)
  if (!target) {
    return
  }
  const group = groupForTarget(target)
  if (!group) {
    return
  }

  group.open = true
  syncCounts()
  requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }))
}

function handleToggle(event: Event) {
  if ((event.target as Element | null)?.matches('details[data-wevu-api-group]')) {
    syncCounts()
  }
}

onMounted(async () => {
  page.value = toolbar.value?.closest<HTMLElement>('.vp-doc')
  page.value?.addEventListener('toggle', handleToggle, true)
  syncCounts()
  await openHashTarget()
  window.addEventListener('hashchange', openHashTarget)
})

onBeforeUnmount(() => {
  page.value?.removeEventListener('toggle', handleToggle, true)
  window.removeEventListener('hashchange', openHashTarget)
})
</script>

<template>
  <section ref="toolbar" class="wevu-api-doc-page">
    <div class="wevu-api-doc-page__toolbar" aria-label="API 分组显示控制">
      <span aria-live="polite"><strong>{{ expandedCount }}</strong> / {{ groupCount }} 个分组已展开</span>
      <div>
        <button type="button" :disabled="expandedCount === groupCount" @click="setAllGroups(true)">
          <Icon icon="mdi:unfold-more-horizontal" aria-hidden="true" />
          展开全部
        </button>
        <button type="button" :disabled="expandedCount === 0" @click="setAllGroups(false)">
          <Icon icon="mdi:unfold-less-horizontal" aria-hidden="true" />
          收起全部
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.wevu-api-doc-page {
  margin-top: 24px;
}

.wevu-api-doc-page__toolbar {
  position: sticky;
  top: calc(var(--vp-nav-height) + 8px);
  z-index: 3;
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 8px 10px 8px 14px;
  margin-bottom: 14px;
  font-size: 12px;
  color: var(--vp-c-text-2);
  background: color-mix(in srgb, var(--vp-c-bg) 92%, transparent);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  backdrop-filter: blur(10px);
}

.wevu-api-doc-page__toolbar strong {
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-1);
}

.wevu-api-doc-page__toolbar > div {
  display: flex;
  gap: 4px;
}

.wevu-api-doc-page__toolbar button {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  min-height: 32px;
  padding: 5px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  cursor: pointer;
  border-radius: 6px;
}

.wevu-api-doc-page__toolbar button:hover:not(:disabled) {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.wevu-api-doc-page__toolbar button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.wevu-api-doc-page__toolbar button:disabled {
  cursor: default;
  opacity: 0.42;
}

.wevu-api-doc-page__toolbar svg {
  width: 16px;
  height: 16px;
}

@media (max-width: 640px) {
  .wevu-api-doc-page__toolbar {
    position: static;
    align-items: flex-start;
  }

  .wevu-api-doc-page__toolbar > div {
    flex-direction: column;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .wevu-api-doc-page__toolbar {
    background: var(--vp-c-bg);
    backdrop-filter: none;
  }
}
</style>
