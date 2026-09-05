import type { AppSelectOption } from './options'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useId, watch } from 'vue'
import { resolveAppSelectActiveValue } from './options'
import { resolveAppSelectMenuPosition } from './position'

interface AppSelectProps<TValue extends string> {
  disabled: boolean
  modelValue: TValue
  options: readonly AppSelectOption<TValue>[]
}
export function useAppSelect<TValue extends string>(
  props: AppSelectProps<TValue>,
  onSelect: (value: TValue) => void,
) {
  const triggerRef = shallowRef<HTMLButtonElement | null>(null)
  const menuRef = shallowRef<HTMLElement | null>(null)
  const isOpen = ref(false)
  const activeValue = shallowRef<TValue | null>(null)
  const placement = ref<'top' | 'bottom'>('bottom')
  const menuStyle = ref<Record<string, string>>({})
  const componentId = `dashboard-select-${useId()}`
  const labelId = `${componentId}-label`
  const listboxId = `${componentId}-listbox`
  const valueId = `${componentId}-value`

  const selectedIndex = computed(() => props.options.findIndex(option => option.value === props.modelValue))
  const selectedOption = computed(() => props.options[selectedIndex.value])
  const activeIndex = computed(() => activeValue.value === null
    ? -1
    : props.options.findIndex(option => option.value === activeValue.value))
  const activeDescendant = computed(() => isOpen.value && activeIndex.value >= 0
    ? `${listboxId}-option-${activeIndex.value}`
    : undefined)

  function findEnabledIndex(startIndex: number, direction: 1 | -1) {
    if (!props.options.length) {
      return -1
    }
    for (let offset = 0; offset < props.options.length; offset++) {
      const index = (startIndex + direction * offset + props.options.length) % props.options.length
      if (!props.options[index]?.disabled) {
        return index
      }
    }
    return -1
  }

  function setActiveIndex(index: number) {
    activeValue.value = props.options[index]?.value ?? null
  }

  function scrollActiveOptionIntoView() {
    menuRef.value
      ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex.value}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }

  function updateMenuPosition() {
    if (!isOpen.value || !triggerRef.value || !menuRef.value) {
      return
    }
    const resolved = resolveAppSelectMenuPosition(triggerRef.value, menuRef.value)
    placement.value = resolved.placement
    menuStyle.value = resolved.style
  }

  async function openMenu(direction: 1 | -1 = 1) {
    if (props.disabled || !props.options.length) {
      return
    }
    const startIndex = selectedIndex.value >= 0
      ? selectedIndex.value
      : direction === 1 ? 0 : props.options.length - 1
    const initialIndex = findEnabledIndex(startIndex, direction)
    if (initialIndex < 0) {
      return
    }
    setActiveIndex(initialIndex)
    isOpen.value = true
    await nextTick()
    updateMenuPosition()
    scrollActiveOptionIntoView()
  }

  function closeMenu() {
    isOpen.value = false
  }

  function toggleMenu() {
    if (isOpen.value) {
      closeMenu()
      return
    }
    void openMenu()
  }

  function selectOption(option: AppSelectOption<TValue>) {
    if (option.disabled) {
      return
    }
    onSelect(option.value)
    closeMenu()
    void nextTick(() => triggerRef.value?.focus({ preventScroll: true }))
  }

  function moveActive(direction: 1 | -1) {
    const startIndex = activeIndex.value >= 0
      ? activeIndex.value + direction
      : direction === 1 ? 0 : props.options.length - 1
    setActiveIndex(findEnabledIndex(startIndex, direction))
    void nextTick(scrollActiveOptionIntoView)
  }

  function handleTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      if (!isOpen.value) {
        void openMenu(direction)
        return
      }
      moveActive(direction)
      return
    }
    if (event.key === 'Home' && isOpen.value) {
      event.preventDefault()
      setActiveIndex(findEnabledIndex(0, 1))
      void nextTick(scrollActiveOptionIntoView)
      return
    }
    if (event.key === 'End' && isOpen.value) {
      event.preventDefault()
      setActiveIndex(findEnabledIndex(props.options.length - 1, -1))
      void nextTick(scrollActiveOptionIntoView)
      return
    }
    if ((event.key === 'Enter' || event.key === ' ') && isOpen.value) {
      event.preventDefault()
      const option = props.options[activeIndex.value]
      if (option) {
        selectOption(option)
      }
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      void openMenu()
      return
    }
    if (event.key === 'Escape' && isOpen.value) {
      event.preventDefault()
      closeMenu()
      return
    }
    if (event.key === 'Tab') {
      closeMenu()
    }
  }

  function handleDocumentPointerDown(event: PointerEvent) {
    const target = event.target
    if (!(target instanceof Node)) {
      return
    }
    if (triggerRef.value?.contains(target) || menuRef.value?.contains(target)) {
      return
    }
    closeMenu()
  }

  function handleViewportChange(event?: Event) {
    if (event?.type === 'scroll' && event.target === menuRef.value) {
      return
    }
    updateMenuPosition()
  }

  async function syncOpenOptions() {
    if (!isOpen.value) {
      return
    }
    if (props.disabled || !props.options.length) {
      closeMenu()
      return
    }

    const nextActiveValue = resolveAppSelectActiveValue(
      props.options,
      activeValue.value,
      props.modelValue,
    )
    if (nextActiveValue === null) {
      closeMenu()
      return
    }
    activeValue.value = nextActiveValue
    await nextTick()
    if (!isOpen.value) {
      return
    }
    updateMenuPosition()
    scrollActiveOptionIntoView()
  }

  function addOpenListeners() {
    document.addEventListener('pointerdown', handleDocumentPointerDown, true)
    document.addEventListener('scroll', handleViewportChange, true)
    window.addEventListener('resize', handleViewportChange)
    window.visualViewport?.addEventListener('resize', handleViewportChange)
    window.visualViewport?.addEventListener('scroll', handleViewportChange)
  }

  function removeOpenListeners() {
    document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
    document.removeEventListener('scroll', handleViewportChange, true)
    window.removeEventListener('resize', handleViewportChange)
    window.visualViewport?.removeEventListener('resize', handleViewportChange)
    window.visualViewport?.removeEventListener('scroll', handleViewportChange)
  }

  watch(() => props.modelValue, (value) => {
    if (!isOpen.value) {
      return
    }
    const nextActiveValue = resolveAppSelectActiveValue(props.options, null, value)
    if (nextActiveValue === null) {
      closeMenu()
      return
    }
    activeValue.value = nextActiveValue
    void nextTick(scrollActiveOptionIntoView)
  })

  watch(() => props.options, () => {
    void syncOpenOptions()
  }, { deep: true })

  watch(() => props.disabled, (disabled) => {
    if (disabled) {
      closeMenu()
    }
  })

  watch(isOpen, (open) => {
    if (open) {
      addOpenListeners()
      return
    }
    removeOpenListeners()
  })

  onBeforeUnmount(removeOpenListeners)

  return {
    activeDescendant,
    activeValue,
    closeMenu,
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
    triggerRef,
    toggleMenu,
    valueId,
  }
}
