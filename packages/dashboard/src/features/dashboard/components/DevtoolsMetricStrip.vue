<script setup lang="ts">
interface DevtoolsMetricItem {
  detail: string
  label: string
  value: string
}

defineProps<{
  items: DevtoolsMetricItem[]
}>()
</script>

<template>
  <dl class="grid overflow-hidden rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) sm:grid-cols-2 xl:grid-cols-4">
    <div
      v-for="(item, index) in items"
      :key="item.label"
      class="min-w-0 px-4 py-3"
      :class="index > 0 ? 'border-t border-(--dashboard-border) sm:border-t-0 sm:border-l' : ''"
    >
      <dt class="text-[11px] font-medium uppercase tracking-[0.12em] text-(--dashboard-text-soft)">
        {{ item.label }}
      </dt>
      <dd class="mt-1 truncate font-mono text-lg font-semibold tracking-tight text-(--dashboard-text)">
        {{ item.value }}
      </dd>
      <p class="mt-0.5 truncate text-xs text-(--dashboard-text-muted)">
        {{ item.detail }}
      </p>
    </div>
  </dl>
</template>
