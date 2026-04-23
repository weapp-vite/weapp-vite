import type { ComputedRef, Ref } from 'vue'
import type { PreviewTapInvocation } from './constants'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PREVIEW_SHADOW_CSS } from './constants'
import { resolveTapChain } from './previewEvents'

export function usePreviewShadow(
  markup: Ref<string>,
  previewScale: ComputedRef<number>,
  stageSize: Ref<{ height: number, width: number }>,
  viewportHeight: Ref<number>,
  viewportWidth: Ref<number>,
  onSelectScope: (scopeId: string) => void,
  onDispatchTapChain: (payload: { activeScopeId: string, chain: PreviewTapInvocation[] }) => void,
  onViewportInput: (width: number, height: number) => void,
) {
  const previewHost = ref<HTMLDivElement | null>(null)
  const previewStage = ref<HTMLDivElement | null>(null)
  let previewShadowRoot: ShadowRoot | null = null
  let previewStageObserver: ResizeObserver | null = null
  let resizeDragState: {
    startHeight: number
    startWidth: number
    startX: number
    startY: number
  } | null = null
  let stopPointer = () => {}

  function handleScreenClick(event: Event) {
    const payload = resolveTapChain(event.target)
    if (!payload?.activeScopeId) {
      return
    }
    onSelectScope(payload.activeScopeId)
    if (payload.chain.length === 0) {
      return
    }
    onDispatchTapChain(payload)
  }

  function renderPreviewMarkup(nextMarkup: string) {
    if (!previewShadowRoot) {
      return
    }

    previewShadowRoot.innerHTML = `
      <style>${PREVIEW_SHADOW_CSS}</style>
      <div class="sim-shadow-screen">${nextMarkup}</div>
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
    onViewportInput(nextWidth, nextHeight)
  }

  function stopResizeDrag(onCommit: () => void) {
    if (!resizeDragState) {
      return
    }
    resizeDragState = null
    window.removeEventListener('pointermove', handleResizeDragMove)
    window.removeEventListener('pointerup', stopPointer)
    window.removeEventListener('pointercancel', stopPointer)
    onCommit()
  }

  function startResizeDrag(event: PointerEvent, onCloseControls: () => void, onCommit: () => void) {
    event.preventDefault()
    onCloseControls()
    resizeDragState = {
      startHeight: viewportHeight.value,
      startWidth: viewportWidth.value,
      startX: event.clientX,
      startY: event.clientY,
    }
    const stop = () => stopResizeDrag(onCommit)
    stopPointer = stop
    window.addEventListener('pointermove', handleResizeDragMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
  }

  onMounted(() => {
    if (!previewHost.value) {
      return
    }

    previewShadowRoot = previewHost.value.attachShadow({ mode: 'open' })
    previewShadowRoot.addEventListener('click', handleScreenClick)
    renderPreviewMarkup(markup.value)

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

  watch(markup, (nextMarkup) => {
    renderPreviewMarkup(nextMarkup)
  }, {
    immediate: true,
  })

  onBeforeUnmount(() => {
    previewShadowRoot?.removeEventListener('click', handleScreenClick)
    previewStageObserver?.disconnect()
    stopResizeDrag(() => {})
  })

  return {
    previewHost,
    previewStage,
    stageSize,
    startResizeDrag,
  }
}
