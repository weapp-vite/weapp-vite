<script setup lang="ts">
import type {
  DuplicateModuleEntry,
  LargestFileEntry,
  ModuleSourceSummary,
} from '../composables/useAnalyzeDashboardData'
import { formatBuildOrigin, formatBytes, formatSourceType } from '../utils/format'
import { surfaceStyles } from '../utils/styles'
import AppCompactListItem from './AppCompactListItem.vue'
import AppEmptyState from './AppEmptyState.vue'
import AppPanelHeader from './AppPanelHeader.vue'

defineProps<{
  visibleDuplicateModules: DuplicateModuleEntry[]
  moduleSourceSummary: ModuleSourceSummary[]
  visibleLargestFiles: LargestFileEntry[]
}>()
</script>

<template>
  <section class="grid gap-3 xl:grid-cols-[minmax(0,1.24fr)_minmax(0,0.76fr)]">
    <div :class="surfaceStyles({ padding: 'md' })">
      <AppPanelHeader
        icon-name="duplicate-modules"
        title="重复模块"
        description="优先看被多个包重复包含的源码与依赖。"
      />
      <div v-if="visibleDuplicateModules.length" class="mt-4 space-y-2.5">
        <article
          v-for="module in visibleDuplicateModules"
          :key="module.id"
          class="rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-3.5"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="break-all font-medium text-[color:var(--dashboard-text)]">
                {{ module.source }}
              </p>
              <p class="mt-1 text-xs text-[color:var(--dashboard-text-soft)]">
                {{ formatSourceType(module.sourceType) }} · {{ module.packageCount }} 个包 · {{ formatBytes(module.bytes) }}
              </p>
            </div>
          </div>
          <ul class="mt-3 space-y-1.5 text-xs text-[color:var(--dashboard-text-muted)]">
            <li v-for="pkg in module.packages" :key="`${module.id}:${pkg.packageId}`">
              <span class="font-medium text-[color:var(--dashboard-text)]">{{ pkg.packageLabel }}</span>
              <span class="text-[color:var(--dashboard-text-soft)]"> · </span>
              <span>{{ pkg.files.join('、') }}</span>
            </li>
          </ul>
        </article>
      </div>
      <AppEmptyState v-else class="mt-4">
        当前构建未检测到跨包重复模块。
      </AppEmptyState>
    </div>

    <div class="flex flex-col gap-3">
      <section :class="surfaceStyles({ padding: 'md' })">
        <AppPanelHeader icon-name="module-sources" title="模块来源" />
        <div class="mt-4 space-y-2.5">
          <article
            v-for="item in moduleSourceSummary"
            :key="item.sourceType"
            class="rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-3.5"
          >
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-medium text-[color:var(--dashboard-text)]">
                  {{ formatSourceType(item.sourceType) }}
                </p>
                <p class="mt-1 text-xs text-[color:var(--dashboard-text-soft)]">
                  {{ item.count }} 个模块
                </p>
              </div>
              <p class="font-medium text-[color:var(--dashboard-accent)]">
                {{ formatBytes(item.bytes) }}
              </p>
            </div>
          </article>
        </div>
      </section>

      <section :class="surfaceStyles({ padding: 'md' })">
        <AppPanelHeader icon-name="file-samples" title="文件样本" />
        <ul class="mt-4 space-y-2.5 text-sm text-[color:var(--dashboard-text-muted)]">
          <AppCompactListItem
            v-for="file in visibleLargestFiles.slice(0, 6)"
            :key="`${file.packageId}:${file.file}`"
            :title="file.file"
            :meta="`${file.packageLabel} · ${formatBuildOrigin(file.from)} · ${file.moduleCount} 模块`"
            mono-title
          />
        </ul>
      </section>
    </div>
  </section>
</template>
