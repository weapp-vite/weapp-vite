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

function getFileIcon(path: string) {
  if (path.endsWith('.json')) {
    return 'icon-[mdi--code-json]'
  }
  if (path.endsWith('.wxml')) {
    return 'icon-[mdi--language-html5]'
  }
  if (path.endsWith('.wxss')) {
    return 'icon-[mdi--language-css3]'
  }
  return 'icon-[mdi--language-javascript]'
}
</script>

<template>
  <div class="grid gap-0.5">
    <template v-for="node in nodes" :key="node.path">
      <button
        :class="cn(
          'flex h-6 w-full items-center gap-1.5 px-1.5 text-left text-[11px] transition-colors',
          node.type === 'file' && selectedPath === node.path
            ? 'bg-(--sim-selection-bg) text-(--sim-text)'
            : 'text-(--sim-muted) hover:bg-(--sim-hover-strong) hover:text-(--sim-text)',
        )"
        :style="{ paddingLeft: `${6 + node.depth * 14}px` }"
        @click="node.type === 'directory' ? emit('toggle', node.path) : emit('select', node.path)"
      >
        <span
          :class="cn(
            node.type === 'directory'
              ? isExpanded(node.path)
                ? 'icon-[mdi--chevron-down]'
                : 'icon-[mdi--chevron-right]'
              : 'icon-[mdi--file-document-outline]',
            'text-[13px]',
          )"
          aria-hidden="true"
        />
        <span
          :class="cn(
            node.type === 'directory' ? 'icon-[mdi--folder-outline] text-[#b8a16d]' : getFileIcon(node.path),
            'text-[13px]',
          )"
          aria-hidden="true"
        />
        <span
          :class="cn(
            'truncate',
            node.type === 'file' && node.name.endsWith('.js') && 'text-[#e2c06d]',
            node.type === 'file' && node.name.endsWith('.wxml') && 'text-[#7ec6ff]',
            node.type === 'file' && node.name.endsWith('.json') && 'text-[#9ad17b]',
          )"
        >
          {{ node.name }}
        </span>
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
