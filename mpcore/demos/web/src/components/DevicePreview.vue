<script setup lang="ts">
import type { DevicePresetValue, PreviewTapInvocation } from './devicePreview/constants'
import { reactive } from 'vue'
import { DEVICE_PRESETS } from './devicePreview/constants'
import { useDevicePreview } from './devicePreview/useDevicePreview'

const props = defineProps<{
  markup: string
  route: string
  viewportHeight: number
  viewportWidth: number
}>()

const emit = defineEmits<{
  back: []
  dispatchTapChain: [payload: { activeScopeId: string, chain: PreviewTapInvocation[] }]
  selectScope: [scopeId: string]
  updateViewport: [payload: { height: number, width: number }]
}>()

const preview = reactive(useDevicePreview(props, emit))
const previewHost = preview.previewHost
const previewStage = preview.previewStage
</script>

<template>
  <section class="grid h-full min-h-0 grid-rows-[36px_minmax(0,1fr)_34px] overflow-hidden bg-[#2c2c2c]">
    <div class="flex items-center justify-between border-b border-[#3a3a3a] px-3 text-[11px] text-[#a7a7a7]">
      <div class="flex items-center gap-2">
        <span class="font-medium text-[#c6c6c6]">普通编译</span>
        <span class="icon-[mdi--chevron-down] text-[12px]" aria-hidden="true" />
        <span class="icon-[mdi--reload] text-[13px]" aria-hidden="true" />
        <span class="icon-[mdi--cellphone] text-[13px]" aria-hidden="true" />
      </div>
      <div class="flex items-center gap-2">
        <button class="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:bg-[#383838]" @click="emit('back')">
          <span class="icon-[mdi--arrow-left] text-[13px]" aria-hidden="true" />
        </button>
        <button class="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:bg-[#383838]" @click="preview.toggleAdvancedControls">
          <span class="icon-[mdi--dots-horizontal] text-[14px]" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div
      ref="previewStage"
      class="grid min-h-0 content-start justify-items-center overflow-auto bg-[#2c2c2c] px-6 py-5"
      :style="preview.stageStyle"
    >
      <div class="relative shrink-0" :style="preview.scaledViewportStyle">
        <div class="absolute left-0 top-0" :style="preview.previewViewportStyle">
          <div v-if="preview.showDeviceFrame" class="absolute left-1/2 top-1.75 z-20 h-7 w-30.5 -translate-x-1/2 rounded-b-4.5 border border-[#4a505d] bg-[#111827]" />
          <div class="absolute left-0 top-0 z-20 flex w-full items-center justify-between px-4 pt-3 text-[11px] font-semibold text-white">
            <span>22:08</span>
            <div class="flex items-center gap-1">
              <span class="icon-[mdi--signal] text-[12px]" aria-hidden="true" />
              <span class="icon-[mdi--wifi] text-[12px]" aria-hidden="true" />
              <span class="icon-[mdi--battery-high] text-[12px]" aria-hidden="true" />
            </div>
          </div>
          <div ref="previewHost" :class="preview.viewportShellClass" />
          <button
            type="button"
            class="absolute bottom-1 right-1 z-30 h-5 w-5 cursor-se-resize rounded-full border border-[rgb(13_155_135/0.28)] bg-[rgb(255_255_255/0.94)] shadow-[0_6px_18px_rgb(15_27_40/0.16)] after:absolute after:bottom-1.25 after:right-1.25 after:h-2 after:w-2 after:rounded-sm after:border-b-2 after:border-r-2 after:border-(--sim-accent)"
            title="拖拽调整视口尺寸"
            @pointerdown="preview.startResizeDrag"
          />
        </div>
      </div>

      <div
        v-if="preview.showAdvancedControls"
        class="mt-4 grid w-full max-w-78 gap-2 border border-(--sim-border) bg-(--sim-panel) p-3 text-[12px] text-(--sim-text) shadow-[0_18px_44px_rgb(0_0_0/0.24)]"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] font-semibold uppercase tracking-[0.16em] text-(--sim-muted)">设备控制</span>
          <button class="rounded-sm px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-(--sim-muted) hover:bg-(--sim-pill-hover)" @click="preview.closeAdvancedControls">
            Close
          </button>
        </div>
        <select
          :value="preview.selectedPreset"
          class="h-8 border border-(--sim-border) bg-(--sim-panel-soft) px-2 text-[12px] text-(--sim-text)"
          @change="preview.applyPreset(($event.target as HTMLSelectElement).value as DevicePresetValue)"
        >
          <option
            v-for="preset in DEVICE_PRESETS"
            :key="preset.value"
            :value="preset.value"
          >
            {{ preset.label }}
          </option>
          <option value="custom">
            自定义
          </option>
        </select>
        <div class="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input v-model="preview.viewportWidthInput" type="number" min="1" class="h-8 border border-(--sim-border) bg-(--sim-panel-soft) px-2 text-[12px] text-(--sim-text) outline-none" @change="preview.commitViewportSize">
          <input v-model="preview.viewportHeightInput" type="number" min="1" class="h-8 border border-(--sim-border) bg-(--sim-panel-soft) px-2 text-[12px] text-(--sim-text) outline-none" @change="preview.commitViewportSize">
          <button class="inline-flex h-8 w-8 items-center justify-center border border-(--sim-border) text-(--sim-muted) hover:bg-(--sim-pill-hover)" @click="preview.rotateViewport">
            <span class="icon-[mdi--phone-rotate-landscape]" aria-hidden="true" />
          </button>
        </div>
        <div class="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input v-model="preview.zoomPercentInput" type="number" min="25" max="300" class="h-8 border border-(--sim-border) bg-(--sim-panel-soft) px-2 text-[12px] text-(--sim-text) outline-none" :disabled="preview.zoomMode !== 'custom'" @change="preview.commitZoomPercent">
          <input v-model="preview.stageHeightInput" type="number" min="320" max="1200" class="h-8 border border-(--sim-border) bg-(--sim-panel-soft) px-2 text-[12px] text-(--sim-text) outline-none" @change="preview.commitStageHeight">
          <button class="inline-flex h-8 w-8 items-center justify-center border text-(--sim-muted) hover:bg-(--sim-pill-hover)" :class="preview.zoomMode === 'fit' ? 'border-(--sim-accent-border) bg-(--sim-accent-soft)' : 'border-(--sim-border)'" @click="preview.setZoomMode(preview.zoomMode === 'fit' ? 'custom' : 'fit')">
            <span class="icon-[mdi--fit-to-page-outline]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-center gap-3 border-t border-[#3a3a3a] bg-[#313131] px-3 text-[11px] text-[#8e8e8e]">
      <span class="truncate">{{ preview.activePresetLabel }}</span>
      <span>|</span>
      <span>{{ viewportWidth }} × {{ viewportHeight }}</span>
      <span>|</span>
      <span>{{ preview.zoomLabel }}</span>
      <span class="icon-[mdi--circle-outline] text-[12px]" aria-hidden="true" />
      <span class="icon-[mdi--camera-outline] text-[12px]" aria-hidden="true" />
      <span class="icon-[mdi--crop-free] text-[12px]" aria-hidden="true" />
      <button class="inline-flex h-5 w-5 items-center justify-center rounded-sm hover:bg-[#3b3b3b]" :aria-pressed="preview.showDeviceFrame" @click="preview.showDeviceFrame = !preview.showDeviceFrame">
        <span :class="preview.showDeviceFrame ? 'icon-[mdi--tablet-cellphone]' : 'icon-[mdi--cellphone-off]'" class="text-[12px]" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>
