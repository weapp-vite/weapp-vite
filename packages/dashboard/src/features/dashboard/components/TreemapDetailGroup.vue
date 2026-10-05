<script setup lang="ts">
import type { TreemapNodeMeta } from '../types'
import type { TreemapDetailSection } from '../utils/treemapDetails/context'
import { useId, useTemplateRef } from 'vue'

const props = defineProps<{
  section: TreemapDetailSection
  open: boolean
  unread: boolean
  searching: boolean
}>()
const emit = defineEmits<{
  toggle: [id: string, element: HTMLElement]
  selectNode: [meta: TreemapNodeMeta]
}>()
const contentId = useId()
const group = useTemplateRef<HTMLElement>('group')

function toggle() {
  if (group.value) {
    emit('toggle', props.section.id, group.value)
  }
}
</script>

<template>
  <section ref="group" :aria-label="section.title" class="mt-4 min-w-0">
    <h4>
      <button
        type="button"
        class="flex min-h-11 w-full items-center gap-2 rounded-sm px-1 text-left text-xs font-semibold hover:bg-(--dashboard-panel-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent)"
        :aria-expanded="open"
        :aria-controls="contentId"
        @click="toggle"
      >
        <span class="icon-[mdi--chevron-right] size-4 shrink-0" :class="{ 'rotate-90': open }" aria-hidden="true" />
        <span class="min-w-0 flex-1 [overflow-wrap:anywhere]">{{ section.title }}</span>
        <span v-if="unread" role="status" class="shrink-0 text-[11px] font-medium text-(--dashboard-accent)">有更新</span>
        <span class="shrink-0 font-normal text-(--dashboard-text-soft) tabular-nums">{{ section.rows.length }}</span>
      </button>
    </h4>
    <div :id="contentId" :hidden="!open">
      <ul v-if="section.rows.length" class="min-w-0 divide-y divide-(--dashboard-border)">
        <li v-for="row in section.rows" :key="row.id" class="min-w-0">
          <button
            v-if="row.meta"
            type="button"
            :title="row.path"
            class="block min-h-11 w-full min-w-0 rounded-sm px-1 py-2 text-left hover:bg-(--dashboard-accent-soft) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--dashboard-accent)"
            @click="emit('selectNode', row.meta)"
          >
            <span class="block font-mono text-xs leading-5 [overflow-wrap:anywhere]">{{ row.path }}</span>
            <span class="mt-1 block text-[11px] leading-4 text-(--dashboard-text-soft) [overflow-wrap:anywhere]">{{ row.description }}</span>
            <span class="mt-1 block text-xs text-(--dashboard-text-soft) tabular-nums">{{ row.size }}</span>
          </button>
          <div v-else class="px-1 py-2">
            <p class="font-mono text-xs leading-5 [overflow-wrap:anywhere]">
              {{ row.path }}
            </p>
            <p class="mt-1 text-[11px] leading-5 text-(--dashboard-text-soft) [overflow-wrap:anywhere]">
              {{ row.description }} · {{ row.size }}
            </p>
          </div>
        </li>
      </ul>
      <p v-else class="mt-2 text-xs leading-5 text-(--dashboard-text-soft)">
        {{ searching ? '此分组没有匹配结果。' : section.empty }}
      </p>
    </div>
  </section>
</template>
