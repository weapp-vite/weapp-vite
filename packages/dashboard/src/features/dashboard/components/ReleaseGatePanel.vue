<script setup lang="ts">
import type { ReleaseGateSummary } from '../utils/releaseGate'
import { computed } from 'vue'
import { surfaceStyles } from '../utils/styles'
import AppToolButton from './AppToolButton.vue'

const props = defineProps<{
  gate: ReleaseGateSummary
  copyStatus: string
}>()

const emit = defineEmits<{
  copy: []
}>()

const nextStep = computed(() => {
  if (props.gate.status === 'blocked') {
    return '先处理下方阻断项，再重新构建确认。'
  }
  if (props.gate.status === 'review') {
    return '先复核建议与预算状态，再判断是否需要调整。'
  }
  return '可继续检查体积明细与运行时表现。'
})

const statusLabel = computed(() => {
  if (props.gate.status === 'blocked') {
    return '存在阻断'
  }
  if (props.gate.status === 'review') {
    return '需要复核'
  }
  return '未发现阻断'
})

function getStatusClassName(status: ReleaseGateSummary['status']) {
  if (status === 'blocked') {
    return 'border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-300'
  }
  if (status === 'review') {
    return 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-300'
  }
  return 'border-(--dashboard-border) bg-(--dashboard-panel-muted) text-(--dashboard-text-muted)'
}
</script>

<template>
  <section :class="surfaceStyles({ padding: 'md' })" class="min-w-0">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-base font-semibold text-(--dashboard-text)">
        构建结论
      </h2>
      <div class="flex flex-wrap items-center gap-2">
        <span role="status" class="text-sm text-(--dashboard-accent)">
          {{ copyStatus }}
        </span>
        <AppToolButton
          label="复制构建结论"
          icon-name="metric-copy"
          touch-label="复制"
          @click="emit('copy')"
        />
      </div>
    </div>

    <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span class="inline-flex rounded-full border px-2.5 py-1 text-sm font-medium" :class="getStatusClassName(gate.status)">
        {{ statusLabel }}
      </span>
      <p class="text-lg font-semibold leading-7 text-(--dashboard-text)">
        {{ gate.headline }}
      </p>
    </div>
    <p class="mt-3 text-sm leading-6 text-(--dashboard-text)">
      下一步：{{ nextStep }}
    </p>
    <p class="mt-1 text-sm leading-6 text-(--dashboard-text-soft)">
      仅基于当前分析，不代表发布审批。
    </p>

    <details class="mt-3 border-t border-(--dashboard-border)">
      <summary class="min-h-11 cursor-pointer rounded-sm py-3 text-sm font-medium text-(--dashboard-text-muted) hover:text-(--dashboard-text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)">
        评分与分析依据
      </summary>
      <div class="min-w-0 pb-1">
        <p class="text-sm leading-6 text-(--dashboard-text-soft)">
          {{ gate.description }}
        </p>
        <dl class="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <div>
            <dt class="text-sm text-(--dashboard-text-soft)">
              分析评分
            </dt>
            <dd class="mt-1 text-lg font-semibold tabular-nums text-(--dashboard-text)">
              {{ gate.score }}
            </dd>
          </div>
          <div v-for="metric in gate.metrics" :key="metric.label" class="min-w-0">
            <dt class="text-sm text-(--dashboard-text-soft)">
              {{ metric.label }}
            </dt>
            <dd class="mt-1 break-words text-lg font-semibold tabular-nums text-(--dashboard-text)">
              {{ metric.value }}
            </dd>
          </div>
        </dl>
        <h3 class="mt-5 text-sm font-semibold text-(--dashboard-text)">
          分析建议
        </h3>
        <ol v-if="gate.recommendations.length > 0" class="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-(--dashboard-text-muted)">
          <li v-for="item in gate.recommendations" :key="item" class="[overflow-wrap:anywhere]">
            {{ item }}
          </li>
        </ol>
        <p v-else class="mt-2 text-sm leading-6 text-(--dashboard-text-soft)">
          当前没有需要立即处理的事项。
        </p>
      </div>
    </details>
  </section>
</template>
