<script setup lang="ts">
import DevicePreview from './components/DevicePreview.vue'
import SourceEditor from './components/SourceEditor.vue'
import AppChrome from './components/workbench/AppChrome.vue'
import DebugPane from './components/workbench/DebugPane.vue'
import ExplorerPane from './components/workbench/ExplorerPane.vue'
import { useWorkbench } from './composables/useWorkbench'
import { cn } from './lib/cn'
import { alertCard } from './lib/ui'
import { stringify } from './lib/workbench'

const workbench = useWorkbench()
</script>

<template>
  <main class="h-screen overflow-hidden bg-[color:var(--sim-bg)] text-[color:var(--sim-text)]">
    <section class="grid h-full grid-rows-[28px_34px_minmax(0,1fr)] overflow-hidden max-[1180px]:grid-rows-[28px_auto_minmax(0,1fr)]">
      <AppChrome
        :current-route="workbench.currentRoute"
        :project-display-label="workbench.projectDisplayLabel"
        :theme-mode="workbench.themeMode"
        @set-theme-mode="workbench.setThemeMode"
      />

      <section
        v-if="workbench.errorMessage"
        :class="cn(alertCard(), 'absolute right-3 top-18 z-10 grid max-w-[520px] gap-1 rounded-md py-2')"
      >
        <strong class="text-sm font-semibold">🕛 运行时错误</strong>
        <pre class="m-0 overflow-auto whitespace-pre-wrap text-xs leading-6">{{ workbench.errorMessage }}</pre>
      </section>

      <section class="grid min-h-0 [grid-template-columns:428px_378px_minmax(0,1fr)] overflow-hidden max-[1180px]:grid-cols-1">
        <aside class="min-h-0 border-r border-[color:var(--sim-divider)] bg-[color:var(--sim-panel-soft)]">
          <DevicePreview
            :route="workbench.currentRoute"
            :markup="workbench.previewMarkup"
            :viewport-height="workbench.viewportSize.height"
            :viewport-width="workbench.viewportSize.width"
            @back="workbench.run(() => workbench.session?.navigateBack())"
            @dispatch-tap-chain="workbench.handleDispatchTapChain"
            @select-scope="workbench.handleSelectScope"
            @update-viewport="workbench.handleUpdateViewport"
          />
        </aside>

        <ExplorerPane
          :callable-methods="workbench.callableMethods"
          :current-page-route="workbench.currentPage?.route ?? ''"
          :current-scenario-id="workbench.currentScenarioId"
          :expanded-tree-paths="workbench.expandedTreePaths"
          :explorer-tab="workbench.explorerTab"
          :file-tree="workbench.fileTree"
          :loading="workbench.loading"
          :page-routes="workbench.pageRoutes"
          :page-stack="workbench.pageStack"
          :project-display-label="workbench.projectDisplayLabel"
          :scenarios="workbench.builtInScenarios"
          :selected-file-path="workbench.selectedFilePath"
          :viewport-size="workbench.viewportSize"
          @call-method="workbench.handleCallMethod"
          @open-file="workbench.openFile"
          @open-route="workbench.handleOpenRoute"
          @page-scroll="workbench.run(() => workbench.session?.pageScrollTo({ scrollTop: 128 }))"
          @pick-directory="workbench.handleDirectoryChange"
          @pick-scenario="workbench.handlePickScenario"
          @pull-refresh="workbench.run(() => workbench.session?.triggerPullDownRefresh())"
          @reach-bottom="workbench.run(() => workbench.session?.triggerReachBottom())"
          @resize="workbench.run(() => workbench.session?.triggerResize({ size: { windowWidth: workbench.viewportSize.width, windowHeight: workbench.viewportSize.height } }))"
          @route-done="workbench.run(() => workbench.session?.triggerRouteDone({ from: 'web-demo' }))"
          @toggle-explorer-tab="workbench.explorerTab = $event"
          @toggle-tree-path="workbench.toggleTreePath"
        />

        <section class="grid min-h-0 [grid-template-rows:minmax(0,1fr)_392px] max-[1180px]:[grid-template-rows:minmax(420px,1fr)_minmax(280px,auto)]">
          <SourceEditor
            :code="workbench.selectedFileContent"
            :file-path="workbench.selectedFilePath"
            :lang="workbench.selectedFileLanguage"
            :open-files="workbench.openFileTabs"
            :project-label="workbench.projectLabel"
            :theme="workbench.effectiveTheme"
          />

          <DebugPane
            :app-data="workbench.appData"
            :callable-methods-count="workbench.callableMethods.length"
            :console-lines="workbench.consoleLines"
            :console-summary="workbench.consoleSummary"
            :current-route="workbench.currentRoute"
            :debug-tab="workbench.debugTab"
            :effective-theme="workbench.effectiveTheme"
            :page-data="workbench.pageData"
            :request-log-data="workbench.requestLogData"
            :runtime-metrics="workbench.runtimeMetrics"
            :selected-file-content="workbench.selectedFileContent"
            :selected-file-language="workbench.selectedFileLanguage"
            :selected-scope="workbench.selectedScope"
            :stringify="stringify"
            :toast-data="workbench.toastData"
            :wxml-preview-code="workbench.wxmlPreviewCode"
            @toggle-debug-tab="workbench.debugTab = $event"
          />
        </section>
      </section>
    </section>
  </main>
</template>
