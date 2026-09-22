<script setup lang="ts">
import { RouterLink } from 'vue-router'

interface DevtoolsPackageRow {
  fileCount: number
  id: string
  label: string
  size: string
  type: string
}

defineProps<{
  rows: DevtoolsPackageRow[]
}>()
</script>

<template>
  <section class="min-w-0 overflow-hidden rounded-md border border-(--dashboard-border) bg-(--dashboard-panel)">
    <header class="flex min-h-11 min-w-0 items-center justify-between gap-2 border-b border-(--dashboard-border) px-3.5 py-2">
      <div class="min-w-0">
        <h2 class="text-sm font-semibold text-(--dashboard-text)">
          Packages
        </h2>
        <p class="truncate text-[11px] text-(--dashboard-text-soft)">
          当前构建产物按体积排序
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-3">
        <RouterLink class="text-xs font-medium text-(--dashboard-accent) hover:underline" to="/analyze?tab=graph">
          依赖图
        </RouterLink>
        <RouterLink class="text-xs font-medium text-(--dashboard-accent) hover:underline" to="/analyze?tab=packages">
          查看全部
        </RouterLink>
      </div>
    </header>

    <div v-if="rows.length" class="divide-y divide-(--dashboard-border)">
      <RouterLink
        v-for="row in rows"
        :key="row.id"
        class="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 px-3.5 py-2.5 text-sm transition hover:bg-(--dashboard-panel-muted) sm:grid-cols-[minmax(0,1fr)_5.5rem_4rem] sm:gap-3"
        to="/analyze?tab=packages"
      >
        <span class="min-w-0">
          <span class="block truncate font-medium text-(--dashboard-text)">{{ row.label }}</span>
          <span class="mt-0.5 block truncate font-mono text-[11px] text-(--dashboard-text-soft)">{{ row.id }} · {{ row.type }}</span>
        </span>
        <span class="text-right font-mono text-xs text-(--dashboard-text)">{{ row.size }}</span>
        <span class="hidden text-right text-xs text-(--dashboard-text-soft) sm:block">{{ row.fileCount }} files</span>
      </RouterLink>
    </div>

    <div v-else class="px-4 py-10 text-center">
      <p class="text-sm font-medium text-(--dashboard-text)">
        等待构建数据
      </p>
      <p class="mt-1 text-xs text-(--dashboard-text-soft)">
        Devframe 连接后将在这里显示主包和分包。
      </p>
    </div>
  </section>
</template>
