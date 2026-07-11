<script setup lang="ts">
import { Icon } from '@iconify/vue'

withDefaults(defineProps<{
  apiCount: number
  defaultOpen?: boolean
  summary: string
  title: string
}>(), {
  defaultOpen: false,
})
</script>

<template>
  <details class="wevu-api-doc-group" data-wevu-api-group :open="defaultOpen">
    <summary>
      <span class="wevu-api-doc-group__visually-hidden">{{ title }}</span>
      <span class="wevu-api-doc-group__summary">{{ summary }}</span>
      <span class="wevu-api-doc-group__count">{{ apiCount }} APIs</span>
      <Icon class="wevu-api-doc-group__chevron" icon="mdi:chevron-down" aria-hidden="true" />
    </summary>
    <div class="wevu-api-doc-group__body">
      <slot />
    </div>
  </details>
</template>

<style scoped>
.wevu-api-doc-group {
  margin: 0 0 12px;
  overflow: clip;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.wevu-api-doc-group[open] {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 28%, var(--vp-c-divider));
}

.wevu-api-doc-group > summary {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 12px;
  align-items: center;
  min-height: 58px;
  padding: 12px 46px 12px 16px;
  cursor: pointer;
  list-style: none;
  background: var(--vp-c-bg-soft);
}

.wevu-api-doc-group > summary::-webkit-details-marker {
  display: none;
}

.wevu-api-doc-group > summary:hover {
  background: var(--vp-c-bg-alt);
}

.wevu-api-doc-group > summary:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
}

.wevu-api-doc-group__summary {
  grid-column: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
  white-space: nowrap;
}

.wevu-api-doc-group__count {
  grid-column: 2;
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}

.wevu-api-doc-group__chevron {
  position: absolute;
  top: 50%;
  right: 16px;
  width: 18px;
  height: 18px;
  color: var(--vp-c-text-3);
  transform: translateY(-50%);
  transition: transform 160ms ease;
}

.wevu-api-doc-group__visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  white-space: nowrap;
  border: 0;
  clip-path: inset(50%);
}

.wevu-api-doc-group[open] .wevu-api-doc-group__chevron {
  color: var(--vp-c-brand-1);
  transform: translateY(-50%) rotate(180deg);
}

.wevu-api-doc-group__body {
  padding: 8px 18px 22px;
}

.wevu-api-doc-group__body :deep(h3) {
  scroll-margin-top: calc(var(--vp-nav-height) + 20px);
}

@media (max-width: 640px) {
  .wevu-api-doc-group > summary {
    padding-left: 13px;
  }

  .wevu-api-doc-group__summary {
    white-space: normal;
  }

  .wevu-api-doc-group__body {
    padding: 4px 13px 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wevu-api-doc-group__chevron {
    transition: none;
  }
}
</style>
