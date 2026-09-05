<script setup lang="ts" generic="T extends string">
import type { AppSelectOption } from './appSelect/options'
import { useAppSelect } from './appSelect/useAppSelect'

const props = withDefaults(defineProps<{
  label: string
  disabled?: boolean
  modelValue: T
  options: readonly AppSelectOption<T>[]
  size?: 'md' | 'sm'
}>(), {
  disabled: false,
  size: 'md',
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
    <span :id="labelId" class="sr-only">{{ label }}</span>
    <button
      ref="triggerRef"
      type="button"
      role="combobox"
      class="group flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) text-left text-(--dashboard-text) outline-none transition-colors hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel) focus-visible:border-(--dashboard-accent) focus-visible:ring-2 focus-visible:ring-(--dashboard-accent-soft) disabled:cursor-not-allowed disabled:opacity-55"
      :class="size === 'sm' ? 'h-8 px-2 text-xs' : 'h-9 px-2.5 text-sm'"
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
      <span :id="valueId" class="min-w-0 truncate">{{ selectedOption?.label ?? '请选择' }}</span>
      <span
        aria-hidden="true"
        class="mr-0.5 h-1.5 w-1.5 shrink-0 rotate-45 border-b border-r border-current text-(--dashboard-text-soft) transition-transform duration-150 group-hover:text-(--dashboard-text)"
        :class="isOpen ? '-translate-y-px rotate-225 text-(--dashboard-accent)' : undefined"
      />
    </button>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="opacity-0 scale-[0.98]"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-[0.98]"
      >
        <div
          v-if="isOpen"
          :id="listboxId"
          ref="menuRef"
          role="listbox"
          class="fixed z-[120] overflow-y-auto rounded-lg border border-(--dashboard-border-strong) bg-(--dashboard-panel) p-1 shadow-2xl shadow-black/20 outline-none"
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
            class="flex min-h-8 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-45"
            :class="[
              size === 'sm' ? 'text-xs' : 'text-sm',
              option.value === modelValue
                ? 'bg-(--dashboard-accent-soft) text-(--dashboard-accent)'
                : activeValue === option.value
                  ? 'bg-(--dashboard-panel-muted) text-(--dashboard-text)'
                  : 'text-(--dashboard-text-muted)',
            ]"
            :aria-selected="option.value === modelValue"
            :data-option-index="index"
            :disabled="option.disabled"
            :title="option.label"
            @click="selectOption(option)"
            @mouseenter="setActiveIndex(index)"
            @mousedown.prevent
          >
            <span class="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
              <span v-if="option.value === modelValue" class="h-1.5 w-1.5 rounded-full bg-(--dashboard-accent)" />
            </span>
            <span data-option-label class="min-w-0 break-all">{{ option.label }}</span>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
