<script setup lang="ts">
import type { CheckboxGroupContext, CheckboxValue } from './selection-context'
import { useCheckboxRoot } from '@varo-ui/headless'
import { computed, inject } from 'wevu'
import { varoReactiveRuntime } from '../../lib/varo-primitives'
import { checkboxGroupKey } from './selection-context'
import VIcon from './v-icon.vue'

const props = withDefaults(
  defineProps<{
    ariaLabel?: string
    checked?: boolean
    disabled?: boolean
    indeterminate?: boolean
    invalid?: boolean
    label?: string
    readonly?: boolean
    required?: boolean
    value?: CheckboxValue
  }>(),
  {
    ariaLabel: '',
    checked: false,
    disabled: false,
    indeterminate: false,
    invalid: false,
    label: '',
    readonly: false,
    required: false,
    value: true,
  },
)

const emit = defineEmits<{
  'change': [value: boolean]
  'update:checked': [value: boolean]
}>()

const group = inject<CheckboxGroupContext>(checkboxGroupKey)
const selected = computed(() => group?.isChecked(props.value) ?? props.checked)
const inactive = computed(() => props.disabled || Boolean(group?.disabled()))
const controlled = computed(() => true)
const checkbox = useCheckboxRoot({
  runtime: varoReactiveRuntime,
  checked: selected,
  checkedControlled: controlled,
  disabled: inactive,
  indeterminate: computed(() => props.indeterminate),
  readonly: computed(() => props.readonly),
  // eslint-disable-next-line ts/no-use-before-define
  onCheckedChange: update,
})
const checked = computed(() => checkbox.state.checked.value)
const checkboxDisabled = computed(() => checkbox.state.disabled.value)
const indeterminate = computed(() => checkbox.state.indeterminate.value)
const readonly = computed(() => checkbox.state.readonly.value)
const ariaChecked = computed(() => indeterminate.value ? 'mixed' : checked.value ? 'true' : 'false')
const ariaDisabled = computed(() => checkboxDisabled.value ? 'true' : undefined)
const ariaInvalid = computed(() => props.invalid ? 'true' : undefined)
const ariaReadonly = computed(() => readonly.value ? 'true' : undefined)
const ariaRequired = computed(() => props.required ? 'true' : undefined)
const checkboxState = computed(() => indeterminate.value ? 'indeterminate' : checked.value ? 'checked' : 'unchecked')
const indicatorName = computed(() => indeterminate.value ? 'minus' : 'check')

function update(checked: boolean) {
  if (readonly.value) {
    return
  }

  if (group) {
    group.toggle(props.value)
    return
  }
  emit('update:checked', checked)
  emit('change', checked)
}

function toggle() {
  checkbox.events.toggle()
}
</script>

<template>
  <button
    class="varo-checkbox"
    :aria-label="props.ariaLabel"
    hover-class="varo-checkbox--pressed"
    :hover-start-time="20"
    :hover-stay-time="70"
    role="checkbox"
    :disabled="checkboxDisabled"
    :aria-checked="ariaChecked"
    :aria-disabled="ariaDisabled"
    :aria-invalid="ariaInvalid"
    :aria-readonly="ariaReadonly"
    :aria-required="ariaRequired"
    :data-checked="String(checked)"
    :data-disabled="String(checkboxDisabled)"
    :data-indeterminate="String(indeterminate)"
    :data-invalid="String(props.invalid)"
    :data-readonly="String(readonly)"
    :data-required="String(props.required)"
    :data-state="checkboxState"
    @click="toggle"
  >
    <view class="varo-checkbox__icon" aria-hidden="true">
      <VIcon v-if="checked || indeterminate" :name="indicatorName" :size="14" />
    </view>
    <view v-if="props.label || $slots.default" class="varo-checkbox__label">
      <slot>{{ props.label }}</slot>
    </view>
  </button>
</template>

<json lang="jsonc">
{
  "component": true,
  "styleIsolation": "apply-shared"
}
</json>
