<script setup lang="ts">
import type { ClassValue } from '../../lib/cn'
import { createVariantClass, useFieldRoot } from '@varo-ui/headless'
import { computed, getCurrentInstance, inject, onUnmounted, shallowRef, toRef, useSlots, watch } from 'wevu'
import { cn } from '../../lib/cn'
import { varoReactiveRuntime } from '../../lib/varo-primitives'
import VIcon from './v-icon.vue'

type InputAlign = 'left' | 'center' | 'right'
type InputClearTrigger = 'focus' | 'always'
type InputFormatTrigger = 'onInput' | 'onBlur'
type InputAutosize = boolean | { minRows?: number, maxRows?: number }
type InputConfirmType = 'send' | 'search' | 'next' | 'go' | 'done'

interface NativeValueEvent {
  detail?: {
    value?: unknown
  }
  target?: {
    value?: unknown
  }
}

interface PublicRef<T> {
  value: T
}

interface FormItemControlContext {
  controlId: PublicRef<string>
  defaultControlId: string
  disabled: PublicRef<boolean>
  descriptionId: string
  descriptionVisible: PublicRef<boolean>
  errorId: string
  errorVisible: PublicRef<boolean>
  invalid: PublicRef<boolean>
  labelId: string
  labelVisible: PublicRef<boolean>
}

// Keep absent values distinct from a controlled empty string at the native boundary.
defineOptions({
  properties: {
    value: { type: null, value: null },
  },
})

const props = withDefaults(
  defineProps<{
    adjustPosition?: boolean
    align?: InputAlign
    alwaysEmbed?: boolean
    ariaControls?: string
    ariaDescribedby?: string
    ariaLabel?: string
    ariaLabelledby?: string
    autoBlur?: boolean
    autoFocus?: boolean
    autosize?: InputAutosize
    className?: ClassValue
    clearable?: boolean
    clearTrigger?: InputClearTrigger
    confirmHold?: boolean
    confirmType?: InputConfirmType
    controlled?: boolean
    cursor?: number
    cursorSpacing?: number
    customStyle?: string
    defaultValue?: string
    disableDefaultPadding?: boolean
    disabled?: boolean
    errorMessage?: string
    fixed?: boolean
    focus?: boolean
    form?: string
    formatTrigger?: InputFormatTrigger
    formatter?: (value: string) => string
    hidden?: boolean
    holdKeyboard?: boolean
    ignoreCompositionEvent?: boolean
    inputId?: string
    invalid?: boolean
    label?: string
    labelWidth?: number | string
    maxLength?: number | string
    name?: string
    nickNameReview?: boolean
    placeholder?: string
    placeholderClass?: string
    placeholderStyle?: string
    prefixIcon?: string
    randomNumber?: boolean
    readonly?: boolean
    role?: string
    rows?: number | string
    safePasswordCertPath?: string
    safePasswordCustomHash?: string
    safePasswordLength?: number
    safePasswordNonce?: string
    safePasswordSalt?: string
    safePasswordTimeStamp?: number
    selectionEnd?: number
    selectionStart?: number
    showConfirmBar?: boolean
    showWordLimit?: boolean
    size?: 'sm' | 'md' | 'lg'
    suffixIcon?: string
    tabindex?: number | string
    type?: string
    value?: string
  }>(),
  {
    adjustPosition: true,
    align: 'left',
    alwaysEmbed: false,
    autoBlur: false,
    autoFocus: false,
    autosize: false,
    clearable: false,
    clearTrigger: 'focus',
    confirmHold: false,
    controlled: false,
    cursor: -1,
    cursorSpacing: 0,
    customStyle: '',
    defaultValue: '',
    disableDefaultPadding: false,
    disabled: false,
    fixed: false,
    focus: false,
    formatTrigger: 'onInput',
    hidden: false,
    holdKeyboard: false,
    ignoreCompositionEvent: true,
    invalid: false,
    labelWidth: '',
    maxLength: -1,
    nickNameReview: false,
    randomNumber: false,
    readonly: false,
    safePasswordLength: undefined,
    safePasswordTimeStamp: undefined,
    selectionEnd: -1,
    selectionStart: -1,
    showConfirmBar: true,
    showWordLimit: false,
    size: 'md',
    type: 'text',
    value: undefined,
  },
)

const emit = defineEmits<{
  'blur': [event: unknown]
  'clear': [event: unknown]
  'confirm': [event: unknown]
  'focus': [event: unknown]
  'input': [event: unknown]
  'click': [event: unknown]
  'keyboardheightchange': [event: unknown]
  'linechange': [event: unknown]
  'longpress': [event: unknown]
  'touchcancel': [event: unknown]
  'touchend': [event: unknown]
  'touchmove': [event: unknown]
  'touchstart': [event: unknown]
  'update:value': [value: string]
  'valueChange': [value: string]
}>()

const formItemControlContextKey = 'varo-form-item-control'

function mergeAriaTokens(...values: Array<string | undefined>) {
  const tokens = values.flatMap(value => value?.split(/\s+/).filter(Boolean) ?? [])
  return tokens.length > 0 ? [...new Set(tokens)].join(' ') : undefined
}

const slots = useSlots()
const focused = shallowRef(false)
const focusRequested = shallowRef(false)
const clearPressed = shallowRef(false)
let clearReleaseTimer: ReturnType<typeof setTimeout> | undefined
const value = computed(() => props.value ?? '')
const valueControlled = computed(() => props.value != null)
const formItemControl = inject<FormItemControlContext | null>(formItemControlContextKey, null)
const disabled = computed(() => props.disabled || formItemControl?.disabled.value || false)
const instance = getCurrentInstance()
const inputId = `varo-input-${instance?.uid ?? 'control'}`
const ownControlId = `${inputId}-control`
const ownErrorId = `${inputId}-error`
const ownLabelId = `${inputId}-label`
const labelVisible = computed(() => Boolean(props.label || slots.label))
const invalid = computed(() => props.invalid || formItemControl?.invalid.value || false)
const controlId = computed(() => props.inputId || ownControlId)
const describedBy = computed(() => mergeAriaTokens(
  props.ariaDescribedby,
  formItemControl?.descriptionVisible.value ? formItemControl.descriptionId : undefined,
  formItemControl?.errorVisible.value ? formItemControl.errorId : undefined,
  props.errorMessage ? ownErrorId : undefined,
))
const labelledBy = computed(() => mergeAriaTokens(
  props.ariaLabelledby,
  formItemControl?.labelVisible.value ? formItemControl.labelId : undefined,
  labelVisible.value ? ownLabelId : undefined,
))

watch(
  () => props.inputId,
  (nextInputId) => {
    if (formItemControl) {
      formItemControl.controlId.value = nextInputId || ownControlId
    }
  },
  { immediate: true },
)
const field = useFieldRoot({
  runtime: varoReactiveRuntime,
  defaultValue: props.defaultValue,
  value,
  valueControlled,
  disabled,
  readonly: toRef(props, 'readonly'),
  invalid,
  onValueChange(value) {
    emit('update:value', value)
    emit('valueChange', value)
  },
})
const currentValue = computed(() => field.state.value.value)
const normalizedMaxLength = computed(() => {
  if (props.maxLength === undefined || props.maxLength === '') {
    return undefined
  }

  const value = Number(props.maxLength)
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : undefined
})
const nativeMaxLength = computed(() => {
  const maxLength = normalizedMaxLength.value
  return maxLength === undefined ? -1 : maxLength
})
const isTextarea = computed(() => props.type === 'textarea')
const isPassword = computed(() => props.type === 'password')
const nativeType = computed(() => {
  if (props.type === 'tel') {
    return 'number'
  }

  if (
    props.type === 'number'
    || props.type === 'digit'
    || props.type === 'idcard'
    || props.type === 'safe-password'
    || props.type === 'nickname'
  ) {
    return props.type
  }

  return 'text'
})

function normalizeRows(value: number | string | undefined) {
  if (value === undefined || value === '') {
    return undefined
  }

  const rows = Number(value)
  return Number.isFinite(rows) && rows > 0 ? Math.trunc(rows) : undefined
}
const autosizeEnabled = computed(() => Boolean(props.autosize))
const controlStyle = computed(() => {
  const declarations = [`text-align:${props.align}`]

  if (!isTextarea.value) {
    return declarations.join(';')
  }

  if (props.autosize != null && typeof props.autosize === 'object') {
    const minRows = normalizeRows(props.autosize.minRows)
    const maxRows = normalizeRows(props.autosize.maxRows)

    if (minRows !== undefined) {
      declarations.push(`min-height:${minRows * 22}px`)
    }
    if (maxRows !== undefined) {
      declarations.push(`max-height:${maxRows * 22}px`)
    }
  }
  else if (!props.autosize) {
    const rows = normalizeRows(props.rows)
    if (rows !== undefined) {
      declarations.push(`height:${rows * 22}px`, `min-height:${rows * 22}px`)
    }
  }

  return declarations.join(';')
})
const labelStyle = computed(() => {
  if (props.labelWidth === undefined || props.labelWidth === '') {
    return ''
  }

  const width = typeof props.labelWidth === 'number' ? `${props.labelWidth}px` : props.labelWidth
  return `width:${width};flex-basis:${width}`
})
const rootClass = computed(() =>
  cn(
    createVariantClass('varo-input', {
      radius: '12px',
      size: props.size,
      align: props.align,
      disabled: disabled.value,
      invalid: props.invalid,
      readonly: props.readonly,
      clearable: props.clearable,
    }),
    props.className,
  ),
)
const showClear = computed(
  () =>
    props.clearable
    && currentValue.value.length > 0
    && field.state.interactive.value
    && !props.readonly
    && (props.clearTrigger === 'always' || focused.value || clearPressed.value),
)
const wordLimit = computed(() => {
  const length = currentValue.value.length
  const maxLength = normalizedMaxLength.value
  return maxLength === undefined ? String(length) : `${length}/${maxLength}`
})
const ariaInvalid = computed(() => (field.state.invalid.value ? 'true' : undefined))
const dataAutosize = computed(() => String(autosizeEnabled.value))
const dataClearable = computed(() => String(props.clearable))
const dataDisabled = computed(() => String(field.state.disabled.value))
const dataFocused = computed(() => String(focused.value))
const dataInvalid = computed(() => String(field.state.invalid.value))
const dataReadonly = computed(() => String(props.readonly))
const resolvedFocus = computed(() => focusRequested.value || props.focus)

function eventValue(event: unknown, fallback: string) {
  if (typeof event !== 'object' || event === null) {
    return fallback
  }

  const nativeEvent = event as NativeValueEvent
  if (typeof nativeEvent.detail?.value === 'string') {
    return nativeEvent.detail.value
  }
  if (typeof nativeEvent.target?.value === 'string') {
    return nativeEvent.target.value
  }

  return fallback
}

function formatValue(value: string, trigger: InputFormatTrigger) {
  let nextValue = value

  if (props.formatter && props.formatTrigger === trigger) {
    nextValue = props.formatter(nextValue)
  }

  const maxLength = normalizedMaxLength.value
  if (maxLength !== undefined && nextValue.length > maxLength) {
    nextValue = nextValue.slice(0, maxLength)
  }

  return nextValue
}

function updateCurrentValue(value: string) {
  return field.events.input(value)
}

function input(event: unknown) {
  if (!field.state.interactive.value) {
    return currentValue.value
  }

  const nextValue = formatValue(eventValue(event, ''), 'onInput')
  if (!updateCurrentValue(nextValue)) {
    return currentValue.value
  }

  emit('input', event)
  return nextValue
}

function handleFocus(event: unknown) {
  focused.value = true
  focusRequested.value = false
  emit('focus', event)
}

function blur(event: unknown) {
  focused.value = false
  focusRequested.value = false

  if (field.state.interactive.value && props.formatTrigger === 'onBlur') {
    updateCurrentValue(formatValue(eventValue(event, currentValue.value), 'onBlur'))
  }

  emit('blur', event)
}

function releaseClearPress() {
  if (clearReleaseTimer !== undefined) {
    clearTimeout(clearReleaseTimer)
  }
  clearReleaseTimer = undefined
  clearPressed.value = false
}

function pressClear() {
  releaseClearPress()
  clearPressed.value = true
}

function finishClearPress() {
  // A native tap follows touchend; retain its target if the input has blurred.
  clearReleaseTimer = setTimeout(releaseClearPress, 0)
}

onUnmounted(releaseClearPress)

function clear(event: unknown) {
  releaseClearPress()
  if (!field.state.interactive.value) {
    return
  }

  if (!field.events.clear()) {
    return
  }
  emit('clear', event)
  focusRequested.value = true
}

function confirm(event: unknown) {
  emit('confirm', event)
}

function click(event: unknown) {
  emit('click', event)
}

function keyboardHeightChange(event: unknown) {
  emit('keyboardheightchange', event)
}

function lineChange(event: unknown) {
  emit('linechange', event)
}

function longpress(event: unknown) {
  emit('longpress', event)
}

function touchcancel(event: unknown) {
  emit('touchcancel', event)
}

function touchend(event: unknown) {
  emit('touchend', event)
}

function touchmove(event: unknown) {
  emit('touchmove', event)
}

function touchstart(event: unknown) {
  emit('touchstart', event)
}
</script>

<template>
  <view
    :class="rootClass"
    :style="props.customStyle"
    :data-align="props.align"
    :data-clearable="dataClearable"
    :data-disabled="dataDisabled"
    :data-focused="dataFocused"
    :data-invalid="dataInvalid"
    :data-readonly="dataReadonly"
    :data-size="props.size"
    :data-type="props.type"
  >
    <label
      v-if="labelVisible"
      :id="ownLabelId"
      class="varo-input__label"
      :for="controlId"
      :style="labelStyle"
    >
      <slot name="label">
        {{ props.label }}
      </slot>
    </label>
    <view class="varo-input__body">
      <view
        v-if="$slots.prefix || props.prefixIcon"
        class="varo-input__prefix"
      >
        <slot name="prefix">
          <text aria-hidden="true">
            {{ props.prefixIcon }}
          </text>
        </slot>
      </view>
      <textarea
        v-if="isTextarea"
        :id="controlId"
        class="varo-input__control"
        :aria-label="props.ariaLabel"
        :aria-invalid="ariaInvalid"
        :aria-controls="props.ariaControls"
        :aria-describedby="describedBy"
        :aria-labelledby="labelledBy"
        :role="props.role"
        :name="props.name"
        :form="props.form"
        :hidden="props.hidden"
        :tabindex="props.tabindex"
        :auto-height="autosizeEnabled"
        :confirm-type="props.confirmType"
        :confirm-hold="props.confirmHold"
        :placeholder-class="props.placeholderClass"
        :placeholder-style="props.placeholderStyle"
        :cursor-spacing="props.cursorSpacing"
        :auto-focus="props.autoFocus"
        :cursor="props.cursor"
        :selection-start="props.selectionStart"
        :selection-end="props.selectionEnd"
        :adjust-position="props.adjustPosition"
        :hold-keyboard="props.holdKeyboard"
        :controlled="props.controlled"
        :auto-blur="props.autoBlur"
        :ignore-composition-event="props.ignoreCompositionEvent"
        :fixed="props.fixed"
        :show-confirm-bar="props.showConfirmBar"
        :disable-default-padding="props.disableDefaultPadding"
        :data-autosize="dataAutosize"
        :data-disabled="dataDisabled"
        :data-invalid="dataInvalid"
        :data-readonly="dataReadonly"
        :disabled="disabled"
        :focus="resolvedFocus"
        :maxlength="nativeMaxLength"
        :placeholder="props.placeholder"
        :style="controlStyle"
        :value="currentValue"
        @input="input"
        @focus="handleFocus"
        @blur="blur"
        @confirm="confirm"
        @keyboardheightchange="keyboardHeightChange"
        @linechange="lineChange"
        @click="click"
        @touchstart="touchstart"
        @touchmove="touchmove"
        @touchend="touchend"
        @touchcancel="touchcancel"
        @longpress="longpress"
      />
      <input
        v-else
        :id="controlId"
        class="varo-input__control"
        :aria-label="props.ariaLabel"
        :aria-invalid="ariaInvalid"
        :aria-controls="props.ariaControls"
        :aria-describedby="describedBy"
        :aria-labelledby="labelledBy"
        :role="props.role"
        :name="props.name"
        :form="props.form"
        :hidden="props.hidden"
        :tabindex="props.tabindex"
        :confirm-type="props.confirmType"
        :confirm-hold="props.confirmHold"
        :placeholder-class="props.placeholderClass"
        :placeholder-style="props.placeholderStyle"
        :cursor-spacing="props.cursorSpacing"
        :auto-focus="props.autoFocus"
        :cursor="props.cursor"
        :selection-start="props.selectionStart"
        :selection-end="props.selectionEnd"
        :adjust-position="props.adjustPosition"
        :hold-keyboard="props.holdKeyboard"
        :controlled="props.controlled"
        :auto-blur="props.autoBlur"
        :ignore-composition-event="props.ignoreCompositionEvent"
        :always-embed="props.alwaysEmbed"
        :random-number="props.randomNumber"
        :safe-password-cert-path="props.safePasswordCertPath"
        :safe-password-length="props.safePasswordLength"
        :safe-password-time-stamp="props.safePasswordTimeStamp"
        :safe-password-nonce="props.safePasswordNonce"
        :safe-password-salt="props.safePasswordSalt"
        :safe-password-custom-hash="props.safePasswordCustomHash"
        :nick-name-review="props.nickNameReview"
        :data-autosize="dataAutosize"
        :data-disabled="dataDisabled"
        :data-invalid="dataInvalid"
        :data-readonly="dataReadonly"
        :disabled="disabled"
        :focus="resolvedFocus"
        :maxlength="nativeMaxLength"
        :password="isPassword"
        :placeholder="props.placeholder"
        :style="controlStyle"
        :type="nativeType"
        :value="currentValue"
        @input="input"
        @focus="handleFocus"
        @blur="blur"
        @confirm="confirm"
        @keyboardheightchange="keyboardHeightChange"
        @click="click"
        @touchstart="touchstart"
        @touchmove="touchmove"
        @touchend="touchend"
        @touchcancel="touchcancel"
        @longpress="longpress"
      >
      <button
        v-if="showClear"
        class="varo-input__clear"
        aria-label="Clear input"
        @click="clear"
        @touchstart="pressClear"
        @touchend="finishClearPress"
        @touchcancel="releaseClearPress"
      >
        <VIcon name="danger" :size="16" />
      </button>
      <text v-if="props.showWordLimit" class="varo-input__word-limit">
        {{ wordLimit }}
      </text>
      <view
        v-if="$slots.suffix || props.suffixIcon"
        class="varo-input__suffix"
      >
        <slot name="suffix">
          <text aria-hidden="true">
            {{ props.suffixIcon }}
          </text>
        </slot>
      </view>
    </view>
    <view v-if="props.errorMessage" :id="ownErrorId" class="varo-input__error">
      {{ props.errorMessage }}
    </view>
  </view>
</template>

<json lang="jsonc">
{
  "component": true,
  "styleIsolation": "apply-shared"
}
</json>
