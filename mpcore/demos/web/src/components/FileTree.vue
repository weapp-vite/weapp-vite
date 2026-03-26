<script setup lang="ts">
import type { WorkbenchFileNode } from '../types/workbench'
import { cn } from '../lib/cn'

const props = defineProps<{
  expandedPaths: string[]
  nodes: WorkbenchFileNode[]
  selectedPath: string
}>()

const emit = defineEmits<{
  select: [path: string]
  toggle: [path: string]
}>()

function isExpanded(path: string) {
  return props.expandedPaths.includes(path)
}
</script>

<template>
  <div class="grid gap-1">
    <template v-for="node in nodes" :key="node.path">
      <button
        :class="cn(
          'flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[12px] transition-colors',
          node.type === 'file' && selectedPath === node.path
            ? 'bg-[color:var(--sim-accent-soft)] text-[color:var(--sim-text)]'
            : 'text-[color:var(--sim-muted)] hover:bg-[color:var(--sim-pill-hover)] hover:text-[color:var(--sim-text)]',
        )"
        :style="{ paddingLeft: `${10 + node.depth * 14}px` }"
        @click="node.type === 'directory' ? emit('toggle', node.path) : emit('select', node.path)"
      >
        <span
          :class="cn(
            node.type === 'directory'
              ? isExpanded(node.path)
                ? 'icon-[mdi--chevron-down]'
                : 'icon-[mdi--chevron-right]'
              : 'icon-[mdi--file-document-outline]',
            'text-sm',
          )"
          aria-hidden="true"
        />
        <span
          :class="cn(
            node.type === 'directory' ? 'icon-[mdi--folder-outline]' : 'icon-[mdi--language-javascript]',
            'text-sm',
          )"
          aria-hidden="true"
        />
        <span class="truncate">{{ node.name }}</span>
      </button>

      <FileTree
        v-if="node.type === 'directory' && isExpanded(node.path) && node.children?.length"
        :expanded-paths="expandedPaths"
        :nodes="node.children"
        :selected-path="selectedPath"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
      />
    </template>
  </div>
</template>
