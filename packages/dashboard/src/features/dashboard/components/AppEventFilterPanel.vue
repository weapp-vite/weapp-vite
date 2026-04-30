<script setup lang="ts">
import type { DashboardKeyOption, DashboardValueOption } from '../types'
import { pillButtonStyles } from '../utils/styles'
import AppInsetPanel from './AppInsetPanel.vue'
import AppMetaLabel from './AppMetaLabel.vue'

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

function getPresetClassName(): string {
  return pillButtonStyles({ kind: 'theme', active: false })
}

function getOptionClassName(activeValue: string, optionValue: string): string {
  return pillButtonStyles({ kind: 'theme', active: activeValue === optionValue })
}
</script>

<template>
  <AppInsetPanel>
    <div class="grid gap-3">
      <div>
        <label for="dashboard-event-search">
          <AppMetaLabel>
            搜索事件
          </AppMetaLabel>
        </label>
        <input
          id="dashboard-event-search"
          :value="searchQuery"
          type="text"
          placeholder="搜索标题、详情、来源或标签"
          class="mt-2 w-full rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 py-2 text-sm text-(--dashboard-text) outline-none transition focus:border-(--dashboard-border-strong)"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        >
      </div>

      <div class="grid gap-3">
        <div>
          <AppMetaLabel>
            快速预设
          </AppMetaLabel>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="preset in filterPresets"
              :key="preset.key"
              :class="getPresetClassName()"
              @click="emit('applyPreset', preset.key)"
            >
              {{ preset.label }}
            </button>
          </div>
          <p v-if="presetDescription" class="mt-2 text-xs leading-5 text-(--dashboard-text-soft)">
            {{ presetDescription }}
          </p>
        </div>

        <div>
          <AppMetaLabel>
            类型过滤
          </AppMetaLabel>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="option in eventKindOptions"
              :key="option.value"
              :class="getOptionClassName(props.eventKindFilter, option.value)"
              @click="emit('update:eventKindFilter', option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div>
          <AppMetaLabel>
            等级过滤
          </AppMetaLabel>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="option in eventLevelOptions"
              :key="option.value"
              :class="getOptionClassName(props.eventLevelFilter, option.value)"
              @click="emit('update:eventLevelFilter', option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div>
          <AppMetaLabel>
            来源过滤
          </AppMetaLabel>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="option in eventSourceOptions"
              :key="option.value"
              :class="getOptionClassName(props.eventSourceFilter, option.value)"
              @click="emit('update:eventSourceFilter', option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppInsetPanel>
</template>
