<script setup lang="ts">
import type {
  DuplicateModuleEntry,
  LargestFileEntry,
  ModuleSourceSummary,
} from '../composables/useAnalyzeDashboardData'
import { formatBuildOrigin, formatBytes, formatSourceType } from '../utils/format'
import { iconFrameStyles, surfaceStyles } from '../utils/styles'
import DashboardIcon from './DashboardIcon.vue'

defineProps<{
  visibleDuplicateModules: DuplicateModuleEntry[]
  moduleSourceSummary: ModuleSourceSummary[]
  visibleLargestFiles: LargestFileEntry[]
}>()
</script>

<template>
  <section class="grid gap-3 xl:grid-cols-[minmax(0,1.24fr)_minmax(0,0.76fr)]">
    <div :class="surfaceStyles({ padding: 'md' })">
      <div class="flex items-center gap-2">
        <span :class="iconFrameStyles()">
          <span class="h-5 w-5">
            <DashboardIcon name="duplicate-modules" />
          </span>
        </span>
        <div>
          <h2 class="text-lg font-semibold text-[color:var(--dashboard-text)]">
            重复模块
          </h2>
          <p class="mt-0.5 text-sm text-[color:var(--dashboard-text-soft)]">
            优先看被多个包重复包含的源码与依赖。
          </p>
        </div>
      </div>
      <p class="mt-3 text-sm text-[color:var(--dashboard-text-soft)]">
        优先看被多个包重复包含的源码与依赖。
      </p>
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
      <div
        v-else
        class="mt-4 rounded-xl border border-dashed border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-5 text-sm text-[color:var(--dashboard-text-soft)]"
      >
        当前构建未检测到跨包重复模块。
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <section :class="surfaceStyles({ padding: 'md' })">
        <div class="flex items-center gap-2">
          <span :class="iconFrameStyles()">
            <span class="h-5 w-5">
              <DashboardIcon name="module-sources" />
            </span>
          </span>
          <h2 class="text-lg font-semibold text-[color:var(--dashboard-text)]">
            模块来源
          </h2>
        </div>
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
        <div class="flex items-center gap-2">
          <span :class="iconFrameStyles()">
            <span class="h-5 w-5">
              <DashboardIcon name="file-samples" />
            </span>
          </span>
          <h2 class="text-lg font-semibold text-[color:var(--dashboard-text)]">
            文件样本
          </h2>
        </div>
        <ul class="mt-4 space-y-2.5 text-sm text-[color:var(--dashboard-text-muted)]">
          <li
            v-for="file in visibleLargestFiles.slice(0, 6)"
            :key="`${file.packageId}:${file.file}`"
            class="rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-3"
          >
            <p class="truncate font-mono text-xs text-[color:var(--dashboard-text)]">
              {{ file.file }}
            </p>
            <p class="mt-1 text-xs text-[color:var(--dashboard-text-soft)]">
              {{ file.packageLabel }} · {{ formatBuildOrigin(file.from) }} · {{ file.moduleCount }} 模块
            </p>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
