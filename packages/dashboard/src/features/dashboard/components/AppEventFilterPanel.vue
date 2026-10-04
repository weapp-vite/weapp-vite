<script setup lang="ts">
import type { DashboardKeyOption, DashboardValueOption } from '../types'
import { computed } from 'vue'
import { pillButtonStyles } from '../utils/styles'
import AppSelect from './AppSelect.vue'

const props = defineProps<{
  searchQuery: string
  presetDescription: string
  filterPresets: DashboardKeyOption[]
  eventKindOptions: DashboardValueOption[]
  eventLevelOptions: DashboardValueOption[]
  eventSourceOptions: DashboardValueOption[]
  eventKindFilter: string
  eventLevelFilter: string
  eventSourceFilter: string
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:eventKindFilter': [value: string]
  'update:eventLevelFilter': [value: string]
  'update:eventSourceFilter': [value: string]
  'applyPreset': [key: string]
}>()

const presetClassName = pillButtonStyles({ kind: 'theme', active: false })
const activeFilterSummary = computed(() => [
  props.eventKindFilter !== 'all' ? props.eventKindOptions.find(option => option.value === props.eventKindFilter)?.label : '',
  props.eventLevelFilter !== 'all' ? props.eventLevelOptions.find(option => option.value === props.eventLevelFilter)?.label : '',
  props.eventSourceFilter !== 'all' ? props.eventSourceOptions.find(option => option.value === props.eventSourceFilter)?.label : '',
].filter(Boolean).join(' · '))
</script>

<template>
  <div class="grid min-w-0 gap-3">
    <div>
      <label for="dashboard-event-search" class="block text-sm font-medium text-(--dashboard-text)">
        搜索事件
      </label>
      <input
        id="dashboard-event-search"
        :value="searchQuery"
        type="search"
        placeholder="搜索标题、详情或来源"
        class="mt-2 w-full rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 py-2 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-accent)"
        @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      >
    </div>

    <div class="flex flex-wrap gap-2" role="group" aria-label="常用事件筛选">
      <button
        v-for="preset in filterPresets"
        :key="preset.key"
        type="button"
        :class="presetClassName"
        @click="emit('applyPreset', preset.key)"
      >
        {{ preset.label }}
      </button>
    </div>
    <p v-if="presetDescription" class="sr-only" role="status">
      {{ presetDescription }}
    </p>

    <details class="group" :open="Boolean(activeFilterSummary)">
      <summary class="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 rounded-md px-1 text-sm text-(--dashboard-text-muted) hover:text-(--dashboard-text) focus-visible:outline-2 focus-visible:outline-(--dashboard-accent)">
        <span class="iconify mdi--chevron-right size-4 shrink-0 group-open:rotate-90" aria-hidden="true" />
        更多筛选
        <span v-if="activeFilterSummary" class="text-(--dashboard-accent)">{{ activeFilterSummary }}</span>
      </summary>
      <div class="grid gap-3 pb-2 md:grid-cols-3">
        <AppSelect
          :model-value="eventKindFilter"
          :options="eventKindOptions"
          label="事件类型"
          @update:model-value="emit('update:eventKindFilter', $event)"
        />
        <AppSelect
          :model-value="eventLevelFilter"
          :options="eventLevelOptions"
          label="事件等级"
          @update:model-value="emit('update:eventLevelFilter', $event)"
        />
        <AppSelect
          :model-value="eventSourceFilter"
          :options="eventSourceOptions"
          label="事件来源"
          @update:model-value="emit('update:eventSourceFilter', $event)"
        />
      </div>
    </details>
  </div>
</template>
