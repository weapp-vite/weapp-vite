<script setup lang="ts">
import type { BuiltInScenario } from '../../scenarios'
import type { WorkbenchFileNode } from '../../types/workbench'
import { cn } from '../../lib/cn'
import { panelSurface, tabButton } from '../../lib/ui'
import { explorerTabs, explorerToolbarIcons } from '../../lib/workbench'
import ActionPanel from '../ActionPanel.vue'
import FileTree from '../FileTree.vue'
import RoutePanel from '../RoutePanel.vue'
import ScenarioSelector from '../ScenarioSelector.vue'
import StackPanel from '../StackPanel.vue'

defineProps<{
  callableMethods: string[]
  currentPageRoute: string
  currentScenarioId: string
  expandedTreePaths: string[]
  explorerTab: 'resources' | 'scenarios' | 'runtime'
  fileTree: WorkbenchFileNode[]
  loading: boolean
  pageRoutes: string[]
  pageStack: string[]
  projectDisplayLabel: string
  selectedFilePath: string
  scenarios: BuiltInScenario[]
  viewportSize: { height: number, width: number }
}>()

const emit = defineEmits<{
  callMethod: [method: string]
  openFile: [path: string]
  openRoute: [route: string]
  pageScroll: []
  pickDirectory: [event: Event]
  pickScenario: [scenarioId: string]
  pullRefresh: []
  reachBottom: []
  resize: []
  routeDone: []
  toggleExplorerTab: [tab: 'resources' | 'scenarios' | 'runtime']
  toggleTreePath: [path: string]
}>()

const tabPanelStyles = panelSurface()
</script>

<template>
  <section class="min-h-0 border-r border-[color:var(--sim-divider)] bg-[color:var(--sim-panel-soft)]">
    <section :class="cn(tabPanelStyles.base(), 'h-full rounded-none border-0 shadow-none [grid-template-rows:32px_32px_minmax(0,1fr)]')">
      <div class="flex items-center justify-between border-b border-[color:var(--sim-divider)] bg-[color:var(--sim-panel-strong)] px-2">
        <div class="flex items-center gap-0.5 text-[color:var(--sim-muted)]">
          <button
            v-for="icon in explorerToolbarIcons"
            :key="icon"
            class="inline-flex h-7 w-7 items-center justify-center rounded-sm hover:bg-[color:var(--sim-pill-hover)]"
          >
            <span :class="cn(icon, 'text-[14px]')" aria-hidden="true" />
          </button>
        </div>
        <button class="inline-flex h-7 w-7 items-center justify-center rounded-sm text-[color:var(--sim-muted)] hover:bg-[color:var(--sim-pill-hover)]">
          <span class="icon-[mdi--dots-horizontal]" aria-hidden="true" />
        </button>
      </div>
      <div :class="cn(tabPanelStyles.bar(), 'px-0')" role="tablist" aria-label="资源区">
        <button
          v-for="tab in explorerTabs"
          :key="tab.value"
          :aria-selected="explorerTab === tab.value"
          :class="cn(tabButton({ active: explorerTab === tab.value }), 'px-3 py-1.5 text-[11px]')"
          @click="emit('toggleExplorerTab', tab.value)"
        >
          <span :class="cn(tab.icon, 'text-[13px]')" aria-hidden="true" />
          {{ tab.label }}
        </button>
      </div>
      <div :class="cn(tabPanelStyles.body(), 'min-h-0 gap-0 p-0')">
        <section
          v-if="explorerTab === 'resources'"
          class="grid h-full min-h-0 grid-rows-[30px_minmax(0,1fr)]"
        >
          <div class="flex items-center border-b border-[color:var(--sim-divider)] bg-[color:var(--sim-panel)] px-3 text-[11px]">
            <span class="truncate font-semibold uppercase tracking-[0.08em] text-[color:var(--sim-muted)]">{{ projectDisplayLabel }}</span>
          </div>
          <div class="min-h-0 overflow-auto bg-[color:var(--sim-panel)] p-2">
            <FileTree
              :expanded-paths="expandedTreePaths"
              :nodes="fileTree"
              :selected-path="selectedFilePath"
              @select="emit('openFile', $event)"
              @toggle="emit('toggleTreePath', $event)"
            />
          </div>
        </section>

        <ScenarioSelector
          v-else-if="explorerTab === 'scenarios'"
          :active-id="currentScenarioId"
          :loading="loading"
          :scenarios="scenarios"
          @pick="emit('pickScenario', $event)"
          @pick-directory="emit('pickDirectory', $event)"
        />

        <div v-else class="grid gap-2 p-2">
          <RoutePanel
            :current-route="currentPageRoute"
            :routes="pageRoutes"
            @open="emit('openRoute', $event)"
          />
          <ActionPanel
            :methods="callableMethods"
            @call-method="emit('callMethod', $event)"
            @page-scroll="emit('pageScroll')"
            @pull-refresh="emit('pullRefresh')"
            @reach-bottom="emit('reachBottom')"
            @route-done="emit('routeDone')"
            @resize="emit('resize')"
          />
          <StackPanel :routes="pageStack" />
        </div>
      </div>
    </section>
  </section>
</template>
