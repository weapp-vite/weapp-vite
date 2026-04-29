<script setup lang="ts">
import DevicePreview from '../components/DevicePreview.vue'
import { useWorkbench } from '../composables/useWorkbench'

const workbench = useWorkbench()
</script>

<template>
  <main class="grid min-h-screen place-items-center overflow-hidden bg-(--sim-bg) px-6 py-8 text-(--sim-text)">
    <section class="w-full max-w-120 overflow-hidden rounded-5.5 border border-(--sim-border-strong) bg-(--sim-panel-soft) shadow-[0_18px_52px_rgb(0_0_0/0.22)]">
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
    </section>
  </main>
</template>
