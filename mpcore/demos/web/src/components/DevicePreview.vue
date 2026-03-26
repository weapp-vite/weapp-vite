<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import SectionCard from './SectionCard.vue'

const props = defineProps<{
  markup: string
  route: string
}>()

const emit = defineEmits<{
  back: []
  dispatchTapChain: [payload: { activeScopeId: string, chain: PreviewTapInvocation[] }]
  selectScope: [scopeId: string]
}>()

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
let previewShadowRoot: ShadowRoot | null = null

const PREVIEW_SHADOW_CSS = `
  :host {
    display: block;
  }

  .sim-shadow-screen {
    min-height: 700px;
    padding: 12px;
  }

  .sim-shadow-screen page,
  .sim-shadow-screen view,
  .sim-shadow-screen text,
  .sim-shadow-screen button {
    display: block;
  }

  .sim-shadow-screen page {
    width: min(100%, 360px);
    padding: 14px;
    margin: 0 auto;
    color: var(--sim-preview-page-text, #18344f);
    background: var(--sim-preview-page-bg, #fff);
    border-radius: 18px;
    box-shadow: 0 10px 28px rgb(15 27 40 / 10%);
  }

  .sim-shadow-screen view {
    padding: 10px 12px;
    margin-bottom: 8px;
    background: rgb(14 98 207 / 5%);
    border: 1px solid rgb(14 98 207 / 8%);
    border-radius: 12px;
  }

  .sim-shadow-screen [bindtap],
  .sim-shadow-screen [bind\\:tap],
  .sim-shadow-screen [catchtap],
  .sim-shadow-screen [catch\\:tap] {
    cursor: pointer;
    box-shadow: inset 0 0 0 1px rgb(135 243 216 / 18%);
  }

  .sim-shadow-screen [bindtap]:active,
  .sim-shadow-screen [bind\\:tap]:active,
  .sim-shadow-screen [catchtap]:active,
  .sim-shadow-screen [catch\\:tap]:active {
    background: rgb(135 243 216 / 18%);
    transform: scale(0.99);
  }
`

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

function handleScreenClick(event: MouseEvent) {
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

onMounted(() => {
  if (!previewHost.value) {
    return
  }

  previewShadowRoot = previewHost.value.attachShadow({ mode: 'open' })
  previewShadowRoot.addEventListener('click', handleScreenClick)
  renderPreviewMarkup(props.markup)
})

watch(() => props.markup, (markup) => {
  renderPreviewMarkup(markup)
}, {
  immediate: true,
})

onBeforeUnmount(() => {
  previewShadowRoot?.removeEventListener('click', handleScreenClick)
})
</script>

<template>
  <SectionCard title="🕛 模拟器" subtitle="左侧固定预览区，始终显示当前页面。">
    <div class="sim-device">
      <div class="sim-device__bar">
        <span>{{ props.route }}</span>
        <button class="sim-mini-btn" @click="emit('back')">
          返回
        </button>
      </div>
      <div ref="previewHost" class="sim-device__screen" />
    </div>
  </SectionCard>
</template>
