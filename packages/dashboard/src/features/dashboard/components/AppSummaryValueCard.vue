<script setup lang="ts">
defineProps<{
  title: string
  meta: string
  value?: string
  breakTitle?: boolean
}>()
</script>

<template>
  <article class="rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-3.5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <p
          class="font-medium text-[color:var(--dashboard-text)]"
          :class="breakTitle ? 'break-all' : undefined"
        >
          {{ title }}
        </p>
        <p class="mt-1 text-xs text-[color:var(--dashboard-text-soft)]">
          {{ meta }}
        </p>
      </div>
      <p
        v-if="value"
        class="font-medium text-[color:var(--dashboard-accent)]"
      >
        {{ value }}
      </p>
    </div>
    <slot />
  </article>
</template>
