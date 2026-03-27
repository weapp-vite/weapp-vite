<script setup lang="ts">
import DevicePreview from '../components/DevicePreview.vue'
import { useWorkbench } from '../composables/useWorkbench'

const workbench = useWorkbench()
</script>

<template>
  <main class="grid min-h-screen place-items-center overflow-hidden bg-[color:var(--sim-bg)] px-6 py-8 text-[color:var(--sim-text)]">
    <section class="w-full max-w-[480px] overflow-hidden rounded-[22px] border border-[color:var(--sim-border-strong)] bg-[color:var(--sim-panel-soft)] shadow-[0_18px_52px_rgb(0_0_0_/_0.22)]">
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
