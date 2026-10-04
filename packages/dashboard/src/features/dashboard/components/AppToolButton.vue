<script setup lang="ts">
import type { DashboardIconName } from '../types'
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import DashboardIcon from './DashboardIcon.vue'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  label: string
  iconName: DashboardIconName
  touchLabel: string
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const tooltipId = useId()
const triggerRef = ref<HTMLButtonElement | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const position = ref<{ left: string, top: string } | null>(null)
let showTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined

function clearTimers() {
  clearTimeout(showTimer)
  clearTimeout(hideTimer)
  showTimer = undefined
  hideTimer = undefined
}

function hideTooltip() {
  clearTimers()
  isOpen.value = false
}

function showTooltip() {
  clearTimers()
  if (!props.disabled) {
    isOpen.value = true
  }
}

function handlePointerEnter(event: PointerEvent) {
  if (event.pointerType === 'touch' || props.disabled) {
    return
  }
  clearTimers()
  if (!isOpen.value) {
    showTimer = setTimeout(showTooltip, 200)
  }
}

function deferHide() {
  clearTimers()
  hideTimer = setTimeout(() => {
    if (!triggerRef.value?.matches(':focus-visible, :hover') && !tooltipRef.value?.matches(':hover')) {
      hideTooltip()
    }
  }, 100)
}

function handleFocus() {
  if (triggerRef.value?.matches(':focus-visible')) {
    showTooltip()
  }
}

function handleClick(event: MouseEvent) {
  hideTooltip()
  emit('click', event)
}

function handleEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    event.stopPropagation()
    hideTooltip()
  }
}

async function updatePosition() {
  position.value = null
  await nextTick()
  if (!isOpen.value || !triggerRef.value || !tooltipRef.value) {
    return
  }
  const trigger = triggerRef.value.getBoundingClientRect()
  const tooltip = tooltipRef.value.getBoundingClientRect()
  const left = Math.max(8, Math.min(
    trigger.left + (trigger.width - tooltip.width) / 2,
    window.innerWidth - tooltip.width - 8,
  ))
  const above = trigger.top - tooltip.height
  const top = above >= 8 ? above : Math.min(trigger.bottom, window.innerHeight - tooltip.height - 8)
  position.value = { left: `${left}px`, top: `${Math.max(8, top)}px` }
}

function removeListeners() {
  document.removeEventListener('keydown', handleEscape, true)
  window.removeEventListener('scroll', hideTooltip, true)
  window.removeEventListener('resize', hideTooltip)
  window.removeEventListener('blur', hideTooltip)
}

watch(isOpen, (open) => {
  if (open) {
    document.addEventListener('keydown', handleEscape, true)
    window.addEventListener('scroll', hideTooltip, true)
    window.addEventListener('resize', hideTooltip)
    window.addEventListener('blur', hideTooltip)
    void updatePosition()
  }
  else {
    removeListeners()
  }
})

watch(() => props.label, () => {
  if (isOpen.value) {
    void updatePosition()
  }
})
watch(() => props.disabled, hideTooltip)

onBeforeUnmount(() => {
  clearTimers()
  removeListeners()
})
</script>

<template>
  <button
    v-bind="$attrs"
    ref="triggerRef"
    type="button"
    class="inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) text-sm text-(--dashboard-text-soft) transition-colors hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none pointer-coarse:w-auto pointer-coarse:min-w-11 pointer-coarse:px-2.5"
    :aria-label="label"
    :aria-describedby="isOpen ? tooltipId : undefined"
    :disabled="disabled"
    @pointerenter="handlePointerEnter"
    @pointerleave="deferHide"
    @focus="handleFocus"
    @blur="deferHide"
    @click="handleClick"
  >
    <span class="size-4.5 shrink-0" aria-hidden="true">
      <DashboardIcon :name="iconName" />
    </span>
    <span class="hidden whitespace-nowrap pointer-coarse:inline" aria-hidden="true">{{ touchLabel }}</span>
  </button>

  <Teleport to="body">
    <div
      v-if="isOpen"
      :id="tooltipId"
      ref="tooltipRef"
      role="tooltip"
      class="fixed z-[130] w-max max-w-[min(20rem,calc(100vw-1rem))] p-1"
      :style="position ?? { visibility: 'hidden' }"
      @pointerenter="clearTimers"
      @pointerleave="deferHide"
    >
      <span class="block rounded-md border border-(--dashboard-border-strong) bg-(--dashboard-panel-strong) px-2.5 py-1.5 text-xs leading-5 text-(--dashboard-text) shadow-lg [overflow-wrap:anywhere]">{{ label }}</span>
    </div>
  </Teleport>
</template>
