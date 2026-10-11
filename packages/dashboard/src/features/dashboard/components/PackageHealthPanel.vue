<script setup lang="ts">
import type { PackageHealthItem, PackageHealthSummary } from '../utils/packageHealth'
import AppPanelHeader from './AppPanelHeader.vue'

defineProps<{
  health: PackageHealthSummary
}>()

const emit = defineEmits<{
  inspectDuplicates: [packageId: string]
}>()

function getStatusClassName(status: PackageHealthItem['status']) {
  if (status === 'risk') {
    return 'text-rose-700 dark:text-rose-300'
  }
  if (status === 'watch') {
    return 'text-amber-700 dark:text-amber-300'
  }
  return 'text-(--dashboard-accent)'
}
</script>

<template>
  <section class="package-health rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) shadow-(--dashboard-shadow)" aria-label="包体健康">
    <header class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-(--dashboard-border) px-4 py-3">
      <AppPanelHeader icon-name="metric-health" title="包体健康" />
      <dl class="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-[13px] tabular-nums">
        <div class="flex items-baseline gap-2">
          <dt class="text-(--dashboard-text-soft)">
            平均分
          </dt>
          <dd class="text-base font-semibold text-(--dashboard-text)">
            {{ health.averageScore }}
          </dd>
        </div>
        <div class="flex items-baseline gap-2">
          <dt class="text-(--dashboard-text-soft)">
            高风险
          </dt>
          <dd class="text-base font-semibold" :class="health.riskCount > 0 ? getStatusClassName('risk') : 'text-(--dashboard-text-muted)'">
            {{ health.riskCount }}
          </dd>
        </div>
        <div class="flex items-baseline gap-2">
          <dt class="text-(--dashboard-text-soft)">
            需关注
          </dt>
          <dd class="text-base font-semibold" :class="health.watchCount > 0 ? getStatusClassName('watch') : 'text-(--dashboard-text-muted)'">
            {{ health.watchCount }}
          </dd>
        </div>
      </dl>
    </header>

    <p v-if="health.items.length === 0" class="px-4 py-3 text-sm text-(--dashboard-text-soft)">
      当前没有包体样本
    </p>
    <div v-else class="package-health-items">
      <article
        v-for="item in health.items.slice(0, 3)"
        :key="item.id"
        class="package-health-item"
      >
        <p v-if="item.path || item.typeLabel !== item.label" class="package-health-kind text-[13px] text-(--dashboard-text-soft)">
          {{ item.typeLabel }}
        </p>
        <p class="package-health-status text-xs" :class="getStatusClassName(item.status)">
          <span class="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
          {{ item.statusLabel }}
        </p>
        <h3 class="package-health-name text-sm font-medium text-(--dashboard-text)" :class="{ 'font-mono': item.path }">
          {{ item.path ?? item.label }}
        </h3>
        <p class="package-health-detail text-[13px] leading-5 text-(--dashboard-text-soft)">
          {{ item.detail }}
        </p>
        <p
          class="package-health-score font-semibold tabular-nums"
          :class="item.status === 'good' ? 'text-(--dashboard-text)' : getStatusClassName(item.status)"
          :aria-label="`健康评分 ${item.score} 分，满分 100 分`"
        >
          {{ item.score }}<small class="ml-1 text-xs font-normal text-(--dashboard-text-soft)">/ 100</small>
        </p>
        <p class="package-health-risk text-[13px] leading-5 text-(--dashboard-text-muted)">
          <button
            v-if="item.primaryRiskKind === 'duplicates'"
            type="button"
            class="inline-flex min-h-8 max-w-full items-center gap-1 rounded-sm text-left text-(--dashboard-accent) hover:text-(--dashboard-text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) pointer-coarse:min-h-11"
            :aria-label="`查看${item.label}的${item.primaryRisk}`"
            @click="emit('inspectDuplicates', item.id)"
          >
            <span class="min-w-0 underline underline-offset-4 [overflow-wrap:anywhere]">{{ item.primaryRisk }}</span>
            <span class="icon-[mdi--arrow-right] size-3.5 shrink-0" aria-hidden="true" />
          </button>
          <template v-else>
            {{ item.primaryRisk }}
          </template>
        </p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.package-health {
  container: package-health / inline-size;
}

.package-health-item {
  display: grid;
  grid-template:
    'kind status' auto
    'name name' auto
    'detail detail' auto
    'risk score' auto / minmax(0, 1fr) auto;
  gap: 0 0.75rem;
  align-items: baseline;
  min-width: 0;
  padding: 1rem;
}

.package-health-item + .package-health-item {
  border-top: 1px solid var(--dashboard-border);
}

.package-health-kind {
  grid-area: kind;
}

.package-health-status {
  display: inline-flex;
  grid-area: status;
  gap: 0.375rem;
  align-items: center;
  justify-self: end;
}

.package-health-name {
  grid-area: name;
  min-width: 0;
  margin-top: 0.25rem;
  overflow-wrap: anywhere;
}

.package-health-detail {
  grid-area: detail;
  margin-top: 0.375rem;
}

.package-health-score {
  grid-area: score;
  align-self: center;
  margin-top: 0.75rem;
  font-size: 1.625rem;
  line-height: 1.15;
  white-space: nowrap;
}

.package-health-risk {
  grid-area: risk;
  align-self: center;
  min-width: 0;
  margin-top: 0.75rem;
  overflow-wrap: anywhere;
}

@container package-health (min-width: 22.5rem) {
  .package-health-item {
    grid-template-areas:
      'kind status'
      'name score'
      'detail score'
      'risk risk';
  }

  .package-health-score {
    margin-top: 0.25rem;
  }

  .package-health-risk {
    margin-top: 0.375rem;
  }
}

@container package-health (min-width: 45rem) {
  .package-health-items {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    padding-block: 1rem;
  }

  .package-health-item {
    grid-template:
      'kind status' auto
      'name name' auto
      'detail detail' 1fr
      'score risk' auto / auto minmax(0, 1fr);
    padding-block: 0;
  }

  .package-health-item + .package-health-item {
    border-top: 0;
    border-left: 1px solid var(--dashboard-border);
  }

  .package-health-score {
    margin-top: 0.875rem;
    font-size: 1.75rem;
  }

  .package-health-risk {
    align-self: end;
    margin-top: 0.875rem;
    text-align: right;
  }
}
</style>
