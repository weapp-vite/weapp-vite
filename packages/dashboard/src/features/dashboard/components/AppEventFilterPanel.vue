<script setup lang="ts">
import AppFilterGroup from './AppFilterGroup.vue'
import AppFilterPresetGroup from './AppFilterPresetGroup.vue'
import AppInsetPanel from './AppInsetPanel.vue'
import AppSearchField from './AppSearchField.vue'

defineProps<{
  searchQuery: string
  presetDescription: string
  filterPresets: Array<{ key: string, label: string }>
  eventKindOptions: Array<{ value: string, label: string }>
  eventLevelOptions: Array<{ value: string, label: string }>
  eventSourceOptions: Array<{ value: string, label: string }>
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
</script>

<template>
  <AppInsetPanel>
    <div class="grid gap-3">
      <AppSearchField
        input-id="dashboard-event-search"
        label="搜索事件"
        placeholder="搜索标题、详情、来源或标签"
        :model-value="searchQuery"
        @update:model-value="emit('update:searchQuery', $event)"
      />

      <div class="grid gap-3">
        <AppFilterPresetGroup
          title="快速预设"
          :description="presetDescription"
          :presets="filterPresets"
          @apply="emit('applyPreset', $event)"
        />

        <AppFilterGroup
          title="类型过滤"
          :options="eventKindOptions"
          :selected-value="eventKindFilter"
          @select="emit('update:eventKindFilter', $event)"
        />

        <AppFilterGroup
          title="等级过滤"
          :options="eventLevelOptions"
          :selected-value="eventLevelFilter"
          @select="emit('update:eventLevelFilter', $event)"
        />

        <AppFilterGroup
          title="来源过滤"
          :options="eventSourceOptions"
          :selected-value="eventSourceFilter"
          @select="emit('update:eventSourceFilter', $event)"
        />
      </div>
    </div>
  </AppInsetPanel>
</template>
