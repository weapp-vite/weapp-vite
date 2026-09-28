<script setup lang="ts" generic="T extends string">
import type { AppSelectOption } from './appSelect/options'
import { useAppSelect } from './appSelect/useAppSelect'

const props = withDefaults(defineProps<{
  label: string
  disabled?: boolean
  modelValue: T
  options: readonly AppSelectOption<T>[]
  size?: 'md' | 'sm'
  variant?: 'default' | 'toolbar'
}>(), {
  disabled: false,
  size: 'md',
  variant: 'default',
})

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()

const {
  activeDescendant,
  activeValue,
  handleTriggerKeydown,
  isOpen,
  labelId,
  listboxId,
  menuRef,
  menuStyle,
  placement,
  selectedOption,
  selectOption,
  setActiveIndex,
  toggleMenu,
  triggerRef,
  valueId,
} = useAppSelect(props, value => emit('update:modelValue', value))
</script>

<template>
  <div class="min-w-0">
    <button
      ref="triggerRef"
      type="button"
      role="combobox"
      class="group flex w-full min-w-0 items-center justify-between gap-2 rounded-md border text-left text-(--dashboard-text) outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dashboard-accent) disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none pointer-coarse:min-h-11"
      :class="[
        size === 'sm' ? 'h-8 px-2 text-xs' : 'h-9 px-2.5 text-sm',
        variant === 'toolbar'
          ? 'border-transparent bg-transparent hover:bg-(--dashboard-panel-muted) aria-expanded:bg-(--dashboard-panel-muted)'
          : 'border-(--dashboard-border) bg-(--dashboard-panel-muted) hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)',
      ]"
      :aria-activedescendant="activeDescendant"
      :aria-controls="isOpen ? listboxId : undefined"
      :aria-labelledby="`${labelId} ${valueId}`"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :disabled="disabled"
      :title="selectedOption?.label"
      @click="toggleMenu"
      @keydown="handleTriggerKeydown"
    >
      <span :id="labelId" :class="variant === 'toolbar' ? 'shrink-0 text-(--dashboard-text-muted)' : 'sr-only'">{{ label }}</span>
      <span :id="valueId" class="min-w-0 flex-1 truncate" :class="variant === 'toolbar' ? 'font-medium' : undefined">{{ selectedOption?.label ?? '请选择' }}</span>
      <span
        aria-hidden="true"
        class="icon-[mdi--chevron-down] size-3.5 shrink-0 text-(--dashboard-text-soft) transition-transform duration-150 group-hover:text-(--dashboard-text) motion-reduce:transition-none"
        :class="isOpen ? 'rotate-180 text-(--dashboard-text)' : undefined"
      />
    </button>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-100 ease-out motion-reduce:transition-none motion-reduce:duration-0"
        enter-from-class="opacity-0 scale-[0.98]"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-75 ease-in motion-reduce:transition-none motion-reduce:duration-0"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-[0.98]"
      >
        <div
          v-if="isOpen"
          :id="listboxId"
          ref="menuRef"
          role="listbox"
          class="fixed z-[120] overflow-y-auto rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-strong) p-1 shadow-lg shadow-black/15 outline-none motion-reduce:scale-100 motion-reduce:opacity-100"
          :class="placement === 'top' ? 'origin-bottom' : 'origin-top'"
          :style="menuStyle"
          :aria-labelledby="labelId"
        >
          <button
            v-for="(option, index) in options"
            :id="`${listboxId}-option-${index}`"
            :key="option.value"
            type="button"
            role="option"
            tabindex="-1"
            class="flex min-h-8 w-full items-center justify-start gap-3 rounded-sm px-2.5 py-1.5 text-left outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-45 pointer-coarse:min-h-11 motion-reduce:transition-none"
            :class="[
              size === 'sm' ? 'text-xs' : 'text-sm',
              option.value === modelValue ? 'font-medium text-(--dashboard-accent)' : 'text-(--dashboard-text)',
              activeValue === option.value ? 'bg-(--dashboard-panel-muted)' : undefined,
            ]"
            :aria-selected="option.value === modelValue"
            :data-option-index="index"
            :disabled="option.disabled"
            :title="option.label"
            @click="selectOption(option)"
            @mouseenter="setActiveIndex(index)"
            @mousedown.prevent
          >
            <span data-option-label class="min-w-0 flex-1 [overflow-wrap:anywhere]">{{ option.label }}</span>
            <span class="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
              <span v-if="option.value === modelValue" class="icon-[mdi--check] size-3.5" />
            </span>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
