<script setup lang="ts">
import type { DuplicateModuleEntry, LargestFileEntry, ModuleSourceSummary } from '../useAnalyzeDashboardData'
import { formatBuildOrigin, formatBytes, formatSourceType } from '../format'

defineProps<{
  visibleDuplicateModules: DuplicateModuleEntry[]
  moduleSourceSummary: ModuleSourceSummary[]
  visibleLargestFiles: LargestFileEntry[]
}>()
</script>

<template>
  <section class="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
    <div class="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
      <h2 class="text-xl font-semibold text-white">
        重复模块
      </h2>
      <p class="mt-1 text-sm text-slate-400">
        优先看被多个包重复包含的源码与依赖。
      </p>
      <div class="mt-4 space-y-3">
        <article
          v-for="module in visibleDuplicateModules"
          :key="module.id"
          class="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="break-all font-medium text-white">
                {{ module.source }}
              </p>
              <p class="mt-1 text-xs text-slate-400">
                {{ formatSourceType(module.sourceType) }} · {{ module.packageCount }} 个包 · {{ formatBytes(module.bytes) }}
              </p>
            </div>
          </div>
          <ul class="mt-3 space-y-2 text-xs text-slate-300">
            <li v-for="pkg in module.packages" :key="`${module.id}:${pkg.packageId}`">
              <span class="font-medium text-slate-100">{{ pkg.packageLabel }}</span>
              <span class="text-slate-500"> · </span>
              <span>{{ pkg.files.join('、') }}</span>
            </li>
          </ul>
        </article>
      </div>
    </div>

    <div class="flex flex-col gap-6">
      <section class="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
        <h2 class="text-xl font-semibold text-white">
          模块来源
        </h2>
        <div class="mt-4 space-y-3">
          <article
            v-for="item in moduleSourceSummary"
            :key="item.sourceType"
            class="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
          >
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-medium text-white">
                  {{ formatSourceType(item.sourceType) }}
                </p>
                <p class="mt-1 text-xs text-slate-400">
                  {{ item.count }} 个模块
                </p>
              </div>
              <p class="text-cyan-200">
                {{ formatBytes(item.bytes) }}
              </p>
            </div>
          </article>
        </div>
      </section>

      <section class="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
        <h2 class="text-xl font-semibold text-white">
          文件样本
        </h2>
        <ul class="mt-4 space-y-3 text-sm text-slate-300">
          <li
            v-for="file in visibleLargestFiles.slice(0, 6)"
            :key="`${file.packageId}:${file.file}`"
            class="rounded-2xl border border-white/8 bg-white/[0.03] p-3"
          >
            <p class="truncate font-mono text-xs text-slate-200">
              {{ file.file }}
            </p>
            <p class="mt-1 text-xs text-slate-400">
              {{ file.packageLabel }} · {{ formatBuildOrigin(file.from) }} · {{ file.moduleCount }} 模块
            </p>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
