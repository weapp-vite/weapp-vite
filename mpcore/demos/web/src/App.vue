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
  <main class="h-screen overflow-hidden bg-(--sim-bg) text-(--sim-text)">
    <section class="grid h-full grid-rows-[28px_34px_minmax(0,1fr)] overflow-hidden max-[1180px]:grid-rows-[28px_auto_minmax(0,1fr)]">
      <AppChrome
        :current-route="workbench.currentRoute.value"
        :project-display-label="workbench.projectDisplayLabel.value"
        :theme-mode="workbench.themeMode.value"
        @set-theme-mode="workbench.setThemeMode"
      />

      <section
        v-if="workbench.errorMessage.value"
        :class="cn(alertCard(), 'absolute right-3 top-18 z-10 grid max-w-130 gap-1 rounded-md py-2')"
      >
        <strong class="text-sm font-semibold">🕛 运行时错误</strong>
        <pre class="m-0 overflow-auto whitespace-pre-wrap text-xs leading-6">
          {{ workbench.errorMessage.value }}
        </pre>
      </section>

      <section class="grid min-h-0 grid-cols-[428px_378px_minmax(0,1fr)] overflow-hidden max-[1180px]:grid-cols-1">
        <aside class="min-h-0 border-r border-(--sim-divider) bg-(--sim-panel-soft)">
          <DevicePreview
            :route="workbench.currentRoute.value"
            :markup="workbench.previewMarkup.value"
            :viewport-height="workbench.viewportSize.value.height"
            :viewport-width="workbench.viewportSize.value.width"
            @back="workbench.run(() => workbench.session.value?.navigateBack())"
            @dispatch-tap-chain="workbench.handleDispatchTapChain"
            @select-scope="workbench.handleSelectScope"
            @update-viewport="workbench.handleUpdateViewport"
          />
        </aside>

        <ExplorerPane
          :callable-methods="workbench.callableMethods.value"
          :current-page-route="workbench.currentPage.value?.route ?? ''"
          :current-scenario-id="workbench.currentScenarioId.value"
          :expanded-tree-paths="workbench.expandedTreePaths.value"
          :explorer-tab="workbench.explorerTab.value"
          :file-tree="workbench.fileTree.value"
          :loading="workbench.loading.value"
          :page-routes="workbench.pageRoutes.value"
          :page-stack="workbench.pageStack.value"
          :project-display-label="workbench.projectDisplayLabel.value"
          :scenarios="workbench.builtInScenarios"
          :selected-file-path="workbench.selectedFilePath.value"
          :viewport-size="workbench.viewportSize.value"
          @call-method="workbench.handleCallMethod"
          @open-file="workbench.openFile"
          @open-route="workbench.handleOpenRoute"
          @page-scroll="workbench.run(() => workbench.session.value?.pageScrollTo({ scrollTop: 128 }))"
          @pick-directory="workbench.handleDirectoryChange"
          @pick-scenario="workbench.handlePickScenario"
          @pull-refresh="workbench.run(() => workbench.session.value?.triggerPullDownRefresh())"
          @reach-bottom="workbench.run(() => workbench.session.value?.triggerReachBottom())"
          @resize="workbench.run(() => workbench.session.value?.triggerResize({ size: { windowWidth: workbench.viewportSize.value.width, windowHeight: workbench.viewportSize.value.height } }))"
          @route-done="workbench.run(() => workbench.session.value?.triggerRouteDone({ from: 'web-demo' }))"
          @toggle-explorer-tab="workbench.explorerTab.value = $event"
          @toggle-tree-path="workbench.toggleTreePath"
        />

        <section class="grid min-h-0 grid-rows-[minmax(0,1fr)_392px] max-[1180px]:grid-rows-[minmax(420px,1fr)_minmax(280px,auto)]">
          <SourceEditor
            :code="workbench.selectedFileContent.value"
            :file-path="workbench.selectedFilePath.value"
            :lang="workbench.selectedFileLanguage.value"
            :open-files="workbench.openFileTabs.value"
            :project-label="workbench.projectLabel.value"
            :theme="workbench.effectiveTheme.value"
          />

          <DebugPane
            :app-data="workbench.appData.value"
            :callable-methods-count="workbench.callableMethods.value.length"
            :console-lines="workbench.consoleLines.value"
            :console-summary="workbench.consoleSummary.value"
            :current-route="workbench.currentRoute.value"
            :debug-tab="workbench.debugTab.value"
            :effective-theme="workbench.effectiveTheme.value"
            :page-data="workbench.pageData.value"
            :request-log-data="workbench.requestLogData.value"
            :runtime-metrics="workbench.runtimeMetrics.value"
            :selected-file-content="workbench.selectedFileContent.value"
            :selected-file-language="workbench.selectedFileLanguage.value"
            :selected-scope="workbench.selectedScope.value"
            :stringify="stringify"
            :toast-data="workbench.toastData.value"
            :wxml-preview-code="workbench.wxmlPreviewCode.value"
            @toggle-debug-tab="workbench.debugTab.value = $event"
          />
        </section>
      </section>
    </section>
  </main>
</template>
