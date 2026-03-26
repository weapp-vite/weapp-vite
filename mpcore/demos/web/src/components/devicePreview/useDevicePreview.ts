import type { DevicePresetValue, PreviewTapInvocation, ZoomMode } from './constants'
import { computed, onMounted, ref, toRef, watch } from 'vue'
import {
  DEFAULT_STAGE_HEIGHT,
  DEFAULT_ZOOM_PERCENT,
  DEVICE_PRESETS,
  DEVICE_TOOLBAR_STORAGE_KEY,

} from './constants'
import { usePreviewShadow } from './usePreviewShadow'

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

export function useDevicePreview(
  props: {
    markup: string
    viewportHeight: number
    viewportWidth: number
  },
  emit: (event: 'dispatchTapChain', payload: { activeScopeId: string, chain: PreviewTapInvocation[] }) => void
    & ((event: 'selectScope', scopeId: string) => void)
    & ((event: 'updateViewport', payload: { height: number, width: number }) => void),
) {
  const viewportWidthInput = ref(String(props.viewportWidth))
  const viewportHeightInput = ref(String(props.viewportHeight))
  const stageHeightInput = ref(String(DEFAULT_STAGE_HEIGHT))
  const zoomPercentInput = ref(String(DEFAULT_ZOOM_PERCENT))
  const selectedPreset = ref<DevicePresetValue>('custom')
  const zoomMode = ref<ZoomMode>('fit')
  const stageHeight = ref(DEFAULT_STAGE_HEIGHT)
  const zoomPercent = ref(DEFAULT_ZOOM_PERCENT)
  const showAdvancedControls = ref(false)
  const showDeviceFrame = ref(true)

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

  function commitViewportSize() {
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

  const previewScale = computed(() => zoomMode.value === 'fit' ? fitScale.value : zoomPercent.value / 100)

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

  const { previewHost, previewStage, stageSize, startResizeDrag: startShadowResizeDrag } = usePreviewShadow(
    toRef(props, 'markup'),
    previewScale,
    toRef(props, 'viewportHeight'),
    toRef(props, 'viewportWidth'),
    scopeId => emit('selectScope', scopeId),
    payload => emit('dispatchTapChain', payload),
    (width, height) => {
      viewportWidthInput.value = String(width)
      viewportHeightInput.value = String(height)
    },
  )

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

  function startResizeDrag(event: PointerEvent) {
    startShadowResizeDrag(event, closeAdvancedControls, commitViewportSize)
  }

  function restoreToolbarState() {
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
  }

  onMounted(() => {
    restoreToolbarState()
  })

  watch(() => [props.viewportWidth, props.viewportHeight] as const, ([width, height]) => {
    viewportWidthInput.value = String(width)
    viewportHeightInput.value = String(height)
    syncPreset(width, height)
  })

  watch(() => [props.viewportWidth, props.viewportHeight, zoomMode.value, zoomPercent.value, stageHeight.value] as const, () => {
    persistToolbarState()
  })

  return {
    activePresetLabel,
    applyPreset,
    closeAdvancedControls,
    commitStageHeight,
    commitViewportSize,
    commitZoomPercent,
    previewHost,
    previewStage,
    previewViewportStyle,
    rotateViewport,
    scaledViewportStyle,
    selectedPreset,
    setZoomMode,
    showAdvancedControls,
    showDeviceFrame,
    stageHeightInput,
    stageStyle,
    startResizeDrag,
    toggleAdvancedControls,
    viewportHeightInput,
    viewportShellClass,
    viewportWidthInput,
    zoomLabel,
    zoomMode,
    zoomPercentInput,
  }
}
