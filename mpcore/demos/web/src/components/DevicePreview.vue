<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

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
const DEVICE_TOOLBAR_STORAGE_KEY = 'mpcore-web-demo-device-toolbar'
const DEFAULT_STAGE_HEIGHT = 760
const DEFAULT_ZOOM_PERCENT = 100
const DEVICE_PRESETS = [
  { label: 'iPhone 14 Pro', value: 'iphone-14-pro', width: 393, height: 852 },
  { label: 'Pixel 7', value: 'pixel-7', width: 412, height: 915 },
  { label: 'iPad Mini', value: 'ipad-mini', width: 768, height: 1024 },
  { label: 'WeChat 基准', value: 'wechat-base', width: 375, height: 812 },
] as const

type DevicePresetValue = typeof DEVICE_PRESETS[number]['value'] | 'custom'
type ZoomMode = 'fit' | 'custom'
type ResizeDragState = {
  startHeight: number
  startWidth: number
  startX: number
  startY: number
} | null

interface PreviewTapEvent {
  currentTarget: { dataset: Record<string, string>, id: string }
  target: { dataset: Record<string, string>, id: string }
}

interface PreviewTapInvocation {
  event: PreviewTapEvent
  method: string
  scopeId: string
  stopAfter: boolean
}

const previewHost = ref<HTMLDivElement | null>(null)
const previewStage = ref<HTMLDivElement | null>(null)
const viewportWidthInput = ref(String(props.viewportWidth))
const viewportHeightInput = ref(String(props.viewportHeight))
const stageHeightInput = ref(String(DEFAULT_STAGE_HEIGHT))
const zoomPercentInput = ref(String(DEFAULT_ZOOM_PERCENT))
const selectedPreset = ref<DevicePresetValue>('custom')
const zoomMode = ref<ZoomMode>('fit')
const stageHeight = ref(DEFAULT_STAGE_HEIGHT)
const zoomPercent = ref(DEFAULT_ZOOM_PERCENT)
const stageSize = ref({ height: DEFAULT_STAGE_HEIGHT, width: 0 })
const showAdvancedControls = ref(false)
const showDeviceFrame = ref(true)
let previewShadowRoot: ShadowRoot | null = null
let previewStageObserver: ResizeObserver | null = null
let resizeDragState: ResizeDragState = null

const PREVIEW_SHADOW_CSS = `
  :host {
    display: block;
    width: 100%;
    height: 100%;
  }

  .sim-shadow-screen {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-height: 100%;
    overflow: auto;
    padding: 12px;
    background:
      linear-gradient(180deg, rgb(255 255 255 / 72%), rgb(242 247 252 / 98%));
  }

  .sim-shadow-screen page,
  .sim-shadow-screen view,
  .sim-shadow-screen text,
  .sim-shadow-screen button {
    display: block;
  }

  .sim-shadow-screen page {
    box-sizing: border-box;
    width: 100%;
    min-height: 100%;
    padding: 16px 14px 18px;
    margin: 0;
    color: var(--sim-preview-page-text, #18344f);
    background: linear-gradient(180deg, #ffffff 0%, #f5f7fb 100%);
    border-radius: 28px;
    box-shadow: 0 10px 28px var(--sim-preview-page-shadow, rgb(15 27 40 / 10%));
  }

  .sim-shadow-screen view {
    padding: 10px 12px;
    margin-bottom: 8px;
    background: var(--sim-preview-block-bg, rgb(14 98 207 / 5%));
    border: 1px solid var(--sim-preview-block-border, rgb(14 98 207 / 8%));
    border-radius: 12px;
  }

  .sim-shadow-screen [bindtap],
  .sim-shadow-screen [bind\\:tap],
  .sim-shadow-screen [catchtap],
  .sim-shadow-screen [catch\\:tap] {
    cursor: pointer;
    box-shadow: inset 0 0 0 1px var(--sim-preview-tap-ring, rgb(135 243 216 / 18%));
  }

  .sim-shadow-screen [bindtap]:active,
  .sim-shadow-screen [bind\\:tap]:active,
  .sim-shadow-screen [catchtap]:active,
  .sim-shadow-screen [catch\\:tap]:active {
    background: var(--sim-preview-active-bg, rgb(135 243 216 / 18%));
    transform: scale(0.99);
  }

  .sim-shadow-screen .screen {
    background: linear-gradient(180deg, #f6f8fc 0%, #ffffff 100%);
    border: none;
    padding: 0;
    margin: 0;
    box-shadow: none;
  }

  .sim-shadow-screen .status {
    margin: 16px 14px 10px;
    padding: 20px 16px 12px;
    color: #f7fbff;
    background: linear-gradient(180deg, #1a2d52 0%, #111f39 100%);
    border: none;
    border-radius: 16px;
    font-weight: 700;
    text-align: center;
  }

  .sim-shadow-screen .hero {
    margin: 0 14px 14px;
    padding: 14px 14px 16px;
    color: #f2f6ff;
    background: linear-gradient(180deg, #1f3258 0%, #263d66 100%);
    border: 1px solid rgb(45 67 107 / 70%);
    border-radius: 18px;
  }

  .sim-shadow-screen .hero-title,
  .sim-shadow-screen .hero-subtitle {
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
  }

  .sim-shadow-screen .hero-title {
    margin-bottom: 6px;
    font-size: 18px;
    font-weight: 800;
  }

  .sim-shadow-screen .hero-subtitle {
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 700;
    opacity: 0.92;
  }

  .sim-shadow-screen .hero-copy {
    padding: 0;
    margin-bottom: 12px;
    color: rgb(228 236 252 / 90%);
    background: transparent;
    border: none;
    font-size: 12px;
    line-height: 1.7;
  }

  .sim-shadow-screen .hero-actions {
    display: flex;
    gap: 10px;
    padding: 0;
    margin: 0;
    background: transparent;
    border: none;
  }

  .sim-shadow-screen .hero-actions view {
    flex: 1;
    margin: 0;
    padding: 8px 10px;
    color: #1d3260;
    background: #ffffff;
    border: none;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    text-align: center;
  }

  .sim-shadow-screen .section-title {
    margin: 0 12px 8px;
    padding: 0 4px;
    color: #313949;
    background: transparent;
    border: none;
    font-size: 13px;
    font-weight: 800;
  }

  .sim-shadow-screen .metric-card,
  .sim-shadow-screen .entry-card {
    margin: 0 12px 10px;
    padding: 14px 14px;
    color: #1d2b43;
    background: #ffffff;
    border: 1px solid rgb(216 226 239 / 95%);
    border-radius: 16px;
    box-shadow: 0 8px 20px rgb(19 42 72 / 5%);
    font-weight: 700;
  }
`

function clampPositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function clampZoomPercent(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(300, Math.max(25, parsed))
}

function syncPreset(width: number, height: number) {
  const matchedPreset = DEVICE_PRESETS.find(item => item.width === width && item.height === height)
  selectedPreset.value = matchedPreset?.value ?? 'custom'
}

function applyViewportSize(width: number, height: number) {
  viewportWidthInput.value = String(width)
  viewportHeightInput.value = String(height)
  syncPreset(width, height)
  emit('updateViewport', { height, width })
}

function applyPreset(value: DevicePresetValue) {
  if (value === 'custom') {
    selectedPreset.value = value
    return
  }
  const preset = DEVICE_PRESETS.find(item => item.value === value)
  if (!preset) {
    return
  }
  selectedPreset.value = value
  applyViewportSize(preset.width, preset.height)
}

function commitViewportWidth() {
  applyViewportSize(
    clampPositiveInt(viewportWidthInput.value, props.viewportWidth),
    clampPositiveInt(viewportHeightInput.value, props.viewportHeight),
  )
}

function commitViewportHeight() {
  applyViewportSize(
    clampPositiveInt(viewportWidthInput.value, props.viewportWidth),
    clampPositiveInt(viewportHeightInput.value, props.viewportHeight),
  )
}

function rotateViewport() {
  applyViewportSize(props.viewportHeight, props.viewportWidth)
}

function commitStageHeight() {
  const nextHeight = clampPositiveInt(stageHeightInput.value, stageHeight.value)
  stageHeight.value = Math.min(1200, Math.max(320, nextHeight))
  stageHeightInput.value = String(stageHeight.value)
}

function commitZoomPercent() {
  zoomPercent.value = clampZoomPercent(zoomPercentInput.value, zoomPercent.value)
  zoomPercentInput.value = String(zoomPercent.value)
}

function setZoomMode(mode: ZoomMode) {
  zoomMode.value = mode
}

function toggleAdvancedControls() {
  showAdvancedControls.value = !showAdvancedControls.value
}

function closeAdvancedControls() {
  showAdvancedControls.value = false
}

const fitScale = computed(() => {
  const safeWidth = Math.max(props.viewportWidth, 1)
  const safeHeight = Math.max(props.viewportHeight, 1)
  const availableWidth = Math.max(stageSize.value.width - 24, 1)
  const availableHeight = Math.max(stageSize.value.height - 24, 1)
  return Math.min(availableWidth / safeWidth, availableHeight / safeHeight)
})

const previewScale = computed(() => {
  if (zoomMode.value === 'fit') {
    return fitScale.value
  }
  return zoomPercent.value / 100
})

const scaledViewportStyle = computed(() => ({
  height: `${Math.max(1, Math.round(props.viewportHeight * previewScale.value))}px`,
  width: `${Math.max(1, Math.round(props.viewportWidth * previewScale.value))}px`,
}))

const previewViewportStyle = computed(() => ({
  height: `${props.viewportHeight}px`,
  transform: `scale(${previewScale.value})`,
  transformOrigin: 'top left',
  width: `${props.viewportWidth}px`,
}))

const stageStyle = computed(() => ({
  height: `${stageHeight.value}px`,
}))

const zoomLabel = computed(() => `${Math.round(previewScale.value * 100)}%`)
const activePresetLabel = computed(() => DEVICE_PRESETS.find(item => item.value === selectedPreset.value)?.label ?? 'Custom Device')
const viewportShellClass = computed(() => showDeviceFrame.value
  ? 'relative h-full w-full overflow-hidden rounded-[32px] border border-[#5c616d] bg-[#0f1422] shadow-[0_18px_36px_rgb(0_0_0_/_0.45)]'
  : 'relative h-full w-full overflow-hidden rounded-[14px] border border-[color:rgb(15_27_40_/_0.08)] bg-[color:var(--sim-surface-page)] shadow-[0_10px_28px_rgb(15_27_40_/_0.08)]')

function persistToolbarState() {
  localStorage.setItem(DEVICE_TOOLBAR_STORAGE_KEY, JSON.stringify({
    showDeviceFrame: showDeviceFrame.value,
    showAdvancedControls: showAdvancedControls.value,
    stageHeight: stageHeight.value,
    viewportHeight: props.viewportHeight,
    viewportWidth: props.viewportWidth,
    zoomMode: zoomMode.value,
    zoomPercent: zoomPercent.value,
  }))
}

function collectDataset(node: HTMLElement) {
  const dataset: Record<string, string> = {}
  for (const [key, value] of Object.entries(node.dataset)) {
    dataset[key] = String(value)
  }
  return dataset
}

function resolveTapChain(target: EventTarget | null) {
  const originNode = target instanceof Node ? target : null
  const origin = originNode instanceof HTMLElement
    ? originNode
    : originNode?.parentElement ?? null
  let current = origin
  let nearestScopeId = ''
  const chain: PreviewTapInvocation[] = []

  while (current) {
    const scopeId = current.getAttribute('data-sim-scope') ?? ''
    const catchTap = current.getAttribute('catchtap') || current.getAttribute('catch:tap')
    const bindTap = current.getAttribute('bindtap') || current.getAttribute('bind:tap')

    if (!nearestScopeId && scopeId) {
      nearestScopeId = scopeId
    }

    const method = catchTap || bindTap
    if (method && scopeId) {
      chain.push({
        event: {
          currentTarget: {
            dataset: collectDataset(current),
            id: current.id ?? '',
          },
          target: {
            dataset: origin ? collectDataset(origin) : {},
            id: origin?.id ?? '',
          },
        },
        method,
        scopeId,
        stopAfter: Boolean(catchTap),
      })
      if (catchTap) {
        break
      }
    }
    current = current.parentElement
  }

  if (!nearestScopeId) {
    return null
  }

  return {
    activeScopeId: nearestScopeId,
    chain,
  }
}

function handleScreenClick(event: Event) {
  const payload = resolveTapChain(event.target)
  if (!payload?.activeScopeId) {
    return
  }
  emit('selectScope', payload.activeScopeId)
  if (payload.chain.length === 0) {
    return
  }
  emit('dispatchTapChain', payload)
}

function renderPreviewMarkup(markup: string) {
  if (!previewShadowRoot) {
    return
  }

  previewShadowRoot.innerHTML = `
    <style>${PREVIEW_SHADOW_CSS}</style>
    <div class="sim-shadow-screen">${markup}</div>
  `
}

function handleResizeDragMove(event: PointerEvent) {
  if (!resizeDragState) {
    return
  }

  const widthDelta = Math.round((event.clientX - resizeDragState.startX) / Math.max(previewScale.value, 0.01))
  const heightDelta = Math.round((event.clientY - resizeDragState.startY) / Math.max(previewScale.value, 0.01))
  const nextWidth = Math.min(1600, Math.max(200, resizeDragState.startWidth + widthDelta))
  const nextHeight = Math.min(2400, Math.max(240, resizeDragState.startHeight + heightDelta))
  viewportWidthInput.value = String(nextWidth)
  viewportHeightInput.value = String(nextHeight)
}

function stopResizeDrag() {
  if (!resizeDragState) {
    return
  }
  resizeDragState = null
  window.removeEventListener('pointermove', handleResizeDragMove)
  window.removeEventListener('pointerup', stopResizeDrag)
  window.removeEventListener('pointercancel', stopResizeDrag)
  commitViewportWidth()
}

function startResizeDrag(event: PointerEvent) {
  event.preventDefault()
  closeAdvancedControls()
  resizeDragState = {
    startHeight: props.viewportHeight,
    startWidth: props.viewportWidth,
    startX: event.clientX,
    startY: event.clientY,
  }
  window.addEventListener('pointermove', handleResizeDragMove)
  window.addEventListener('pointerup', stopResizeDrag)
  window.addEventListener('pointercancel', stopResizeDrag)
}

onMounted(() => {
  if (!previewHost.value) {
    return
  }

  previewShadowRoot = previewHost.value.attachShadow({ mode: 'open' })
  previewShadowRoot.addEventListener('click', handleScreenClick)
  renderPreviewMarkup(props.markup)

  const rawStoredState = localStorage.getItem(DEVICE_TOOLBAR_STORAGE_KEY)
  if (rawStoredState) {
    try {
      const storedState = JSON.parse(rawStoredState) as Partial<{
        showDeviceFrame: boolean
        showAdvancedControls: boolean
        stageHeight: number
        viewportHeight: number
        viewportWidth: number
        zoomMode: ZoomMode
        zoomPercent: number
      }>
      if (typeof storedState.stageHeight === 'number') {
        stageHeight.value = Math.min(1200, Math.max(320, storedState.stageHeight))
        stageHeightInput.value = String(stageHeight.value)
      }
      if (typeof storedState.zoomPercent === 'number') {
        zoomPercent.value = Math.min(300, Math.max(25, storedState.zoomPercent))
        zoomPercentInput.value = String(zoomPercent.value)
      }
      if (storedState.zoomMode === 'fit' || storedState.zoomMode === 'custom') {
        zoomMode.value = storedState.zoomMode
      }
      if (typeof storedState.showAdvancedControls === 'boolean') {
        showAdvancedControls.value = storedState.showAdvancedControls
      }
      if (typeof storedState.showDeviceFrame === 'boolean') {
        showDeviceFrame.value = storedState.showDeviceFrame
      }
      const storedWidth = typeof storedState.viewportWidth === 'number' ? storedState.viewportWidth : props.viewportWidth
      const storedHeight = typeof storedState.viewportHeight === 'number' ? storedState.viewportHeight : props.viewportHeight
      applyViewportSize(storedWidth, storedHeight)
    }
    catch {
      syncPreset(props.viewportWidth, props.viewportHeight)
    }
  }
  else {
    syncPreset(props.viewportWidth, props.viewportHeight)
  }

  if (previewStage.value) {
    previewStageObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }
      stageSize.value = {
        height: entry.contentRect.height,
        width: entry.contentRect.width,
      }
    })
    previewStageObserver.observe(previewStage.value)
  }
})

watch(() => props.markup, (markup) => {
  renderPreviewMarkup(markup)
}, {
  immediate: true,
})

watch(() => [props.viewportWidth, props.viewportHeight] as const, ([width, height]) => {
  viewportWidthInput.value = String(width)
  viewportHeightInput.value = String(height)
  syncPreset(width, height)
})

watch(() => [props.viewportWidth, props.viewportHeight, zoomMode.value, zoomPercent.value, stageHeight.value] as const, () => {
  persistToolbarState()
})

onBeforeUnmount(() => {
  previewShadowRoot?.removeEventListener('click', handleScreenClick)
  previewStageObserver?.disconnect()
  stopResizeDrag()
})
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
        <button class="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:bg-[#383838]" @click="toggleAdvancedControls">
          <span class="icon-[mdi--dots-horizontal] text-[14px]" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div
      ref="previewStage"
      class="grid min-h-0 content-start justify-items-center overflow-auto bg-[#2c2c2c] px-6 py-5"
      :style="stageStyle"
    >
      <div class="relative shrink-0" :style="scaledViewportStyle">
        <div class="absolute left-0 top-0" :style="previewViewportStyle">
          <div v-if="showDeviceFrame" class="absolute left-1/2 top-[7px] z-20 h-[28px] w-[122px] -translate-x-1/2 rounded-b-[18px] border border-[#4a505d] bg-[#111827]" />
          <div class="absolute left-0 top-0 z-20 flex w-full items-center justify-between px-4 pt-3 text-[11px] font-semibold text-white">
            <span>22:08</span>
            <div class="flex items-center gap-1">
              <span class="icon-[mdi--signal] text-[12px]" aria-hidden="true" />
              <span class="icon-[mdi--wifi] text-[12px]" aria-hidden="true" />
              <span class="icon-[mdi--battery-high] text-[12px]" aria-hidden="true" />
            </div>
          </div>
          <div
            ref="previewHost"
            :class="viewportShellClass"
          />
          <button
            type="button"
            class="absolute bottom-1 right-1 z-30 h-5 w-5 cursor-se-resize rounded-full border border-[color:rgb(13_155_135_/_0.28)] bg-[color:rgb(255_255_255_/_0.94)] shadow-[0_6px_18px_rgb(15_27_40_/_0.16)] after:absolute after:bottom-[5px] after:right-[5px] after:h-2 after:w-2 after:rounded-sm after:border-b-2 after:border-r-2 after:border-[color:var(--sim-accent)]"
            title="拖拽调整视口尺寸"
            @pointerdown="startResizeDrag"
          />
        </div>
      </div>

      <div
        v-if="showAdvancedControls"
        class="mt-4 grid w-full max-w-[312px] gap-2 border border-[color:var(--sim-border)] bg-[color:var(--sim-panel)] p-3 text-[12px] text-[color:var(--sim-text)] shadow-[0_18px_44px_rgb(0_0_0_/_0.24)]"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sim-muted)]">设备控制</span>
          <button class="rounded-sm px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[color:var(--sim-muted)] hover:bg-[color:var(--sim-pill-hover)]" @click="closeAdvancedControls">
            Close
          </button>
        </div>
        <select
          :value="selectedPreset"
          class="h-8 border border-[color:var(--sim-border)] bg-[color:var(--sim-panel-soft)] px-2 text-[12px] text-[color:var(--sim-text)]"
          @change="applyPreset(($event.target as HTMLSelectElement).value as DevicePresetValue)"
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
          <input v-model="viewportWidthInput" type="number" min="1" class="h-8 border border-[color:var(--sim-border)] bg-[color:var(--sim-panel-soft)] px-2 text-[12px] text-[color:var(--sim-text)] outline-none" @change="commitViewportWidth">
          <input v-model="viewportHeightInput" type="number" min="1" class="h-8 border border-[color:var(--sim-border)] bg-[color:var(--sim-panel-soft)] px-2 text-[12px] text-[color:var(--sim-text)] outline-none" @change="commitViewportHeight">
          <button class="inline-flex h-8 w-8 items-center justify-center border border-[color:var(--sim-border)] text-[color:var(--sim-muted)] hover:bg-[color:var(--sim-pill-hover)]" @click="rotateViewport">
            <span class="icon-[mdi--phone-rotate-landscape]" aria-hidden="true" />
          </button>
        </div>
        <div class="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input v-model="zoomPercentInput" type="number" min="25" max="300" class="h-8 border border-[color:var(--sim-border)] bg-[color:var(--sim-panel-soft)] px-2 text-[12px] text-[color:var(--sim-text)] outline-none" :disabled="zoomMode !== 'custom'" @change="commitZoomPercent">
          <input v-model="stageHeightInput" type="number" min="320" max="1200" class="h-8 border border-[color:var(--sim-border)] bg-[color:var(--sim-panel-soft)] px-2 text-[12px] text-[color:var(--sim-text)] outline-none" @change="commitStageHeight">
          <button class="inline-flex h-8 w-8 items-center justify-center border text-[color:var(--sim-muted)] hover:bg-[color:var(--sim-pill-hover)]" :class="zoomMode === 'fit' ? 'border-[color:var(--sim-accent-border)] bg-[color:var(--sim-accent-soft)]' : 'border-[color:var(--sim-border)]'" @click="setZoomMode(zoomMode === 'fit' ? 'custom' : 'fit')">
            <span class="icon-[mdi--fit-to-page-outline]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-center gap-3 border-t border-[#3a3a3a] bg-[#313131] px-3 text-[11px] text-[#8e8e8e]">
      <span class="truncate">{{ activePresetLabel }}</span>
      <span>|</span>
      <span>{{ viewportWidth }} × {{ viewportHeight }}</span>
      <span>|</span>
      <span>{{ zoomLabel }}</span>
      <span class="icon-[mdi--circle-outline] text-[12px]" aria-hidden="true" />
      <span class="icon-[mdi--camera-outline] text-[12px]" aria-hidden="true" />
      <span class="icon-[mdi--crop-free] text-[12px]" aria-hidden="true" />
      <button class="inline-flex h-5 w-5 items-center justify-center rounded-sm hover:bg-[#3b3b3b]" :aria-pressed="showDeviceFrame" @click="showDeviceFrame = !showDeviceFrame">
        <span :class="showDeviceFrame ? 'icon-[mdi--tablet-cellphone]' : 'icon-[mdi--cellphone-off]'" class="text-[12px]" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>
