<script setup lang="ts">
import type { ClassValue } from '../../lib/cn'
import { computed } from 'wevu'
import { cn } from '../../lib/cn'

type IconTone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted'

interface IconPath {
  readonly d: string
  readonly filled?: true
}

type IconPaths = readonly IconPath[]

// WeChat validates union props and initial String bindings before Wevu
// applies setup defaults. Empty native strings avoid `null` type warnings.
defineOptions({
  properties: {
    color: { type: null, value: '' },
    label: { type: null, value: '' },
    name: { type: null, value: '' },
    size: { type: null, value: 16 },
  },
})
const props = withDefaults(
  defineProps<{
    className?: ClassValue
    color?: string | null
    label?: string | null
    name?: string | null
    size?: number | string
    spin?: boolean
    tone?: IconTone
  }>(),
  {
    color: '',
    label: '',
    name: '',
    size: 16,
    spin: false,
    tone: 'default',
  },
)
const CHEVRON_DOWN = [{ d: 'm6 9 6 6 6-6' }] as const satisfies IconPaths
const CHEVRON_LEFT = [{ d: 'm15 18-6-6 6-6' }] as const satisfies IconPaths
const CHEVRON_RIGHT = [{ d: 'm9 18 6-6-6-6' }] as const satisfies IconPaths
const CHEVRON_UP = [{ d: 'm18 15-6-6-6 6' }] as const satisfies IconPaths

const ICON_PATHS_BY_NAME = {
  'back': CHEVRON_LEFT,
  'check': [{ d: 'm5 12 4 4 10-9' }],
  'chevron-down': CHEVRON_DOWN,
  'chevron-left': CHEVRON_LEFT,
  'chevron-right': CHEVRON_RIGHT,
  'chevron-up': CHEVRON_UP,
  'chevronDown': CHEVRON_DOWN,
  'chevronLeft': CHEVRON_LEFT,
  'chevronRight': CHEVRON_RIGHT,
  'chevronsLeft': [{ d: 'm13 17-5-5 5-5M19 17l-5-5 5-5' }],
  'chevronsRight': [{ d: 'm5 7 5 5-5 5M11 7l5 5-5 5' }],
  'chevronUp': CHEVRON_UP,
  'close': [{ d: 'M18 6 6 18M6 6l12 12' }],
  'danger': [
    { d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { d: 'm15 9-6 6m0-6 6 6' },
  ],
  'dot': [{ d: 'M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10Z', filled: true }],
  'info': [
    { d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { d: 'M12 11v5m0-8h.01' },
  ],
  'location': [
    { d: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z' },
    { d: 'M14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z' },
  ],
  'menu': [{ d: 'M4 6h16M4 12h16M4 18h16' }],
  'minus': [{ d: 'M5 12h14' }],
  'more': [{
    d: 'M5 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3Z',
    filled: true,
  }],
  'plus': [{ d: 'M12 5v14M5 12h14' }],
  'search': [
    { d: 'M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z' },
    { d: 'm20 20-4-4' },
  ],
  'success': [
    { d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { d: 'm8 12 2.5 2.5L16 9' },
  ],
  'warning': [
    { d: 'M10.3 4.2 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z' },
    { d: 'M12 9v4m0 4h.01' },
  ],
} as const satisfies Record<string, IconPaths>

type IconName = keyof typeof ICON_PATHS_BY_NAME

const accessibleLabel = computed(() => props.label || undefined)
const ariaHidden = computed(() => (props.label ? undefined : 'true'))
const classes = computed(() => cn('varo-icon', props.className))
const dimension = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
const iconRole = computed(() => (props.label ? 'img' : undefined))
const iconSource = computed(() => {
  const paths = ICON_PATHS_BY_NAME[(props.name || '') as IconName]
  if (!paths) {
    return undefined
  }

  const color = '#000000'
  const body = paths
    .map(path => `<path d="${path.d}"${'filled' in path ? ` fill="${color}" stroke="none"` : ''}/>`)
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
})
const assetStyle = computed(() => {
  if (!iconSource.value) {
    return {}
  }
  const mask = `url("${iconSource.value}")`
  return {
    'backgroundColor': 'currentColor',
    'display': 'block',
    'height': '100%',
    'maskImage': mask,
    'maskPosition': 'center',
    'maskRepeat': 'no-repeat',
    'maskSize': 'contain',
    '-webkit-mask-image': mask,
    '-webkit-mask-position': 'center',
    '-webkit-mask-repeat': 'no-repeat',
    '-webkit-mask-size': 'contain',
    'width': '100%',
  }
})
const rootStyle = computed(() => ({
  color: props.color || undefined,
  fontSize: dimension.value,
  height: dimension.value,
  width: dimension.value,
}))
const spinData = computed(() => String(props.spin))
</script>

<template>
  <view
    :class="classes"
    :role="iconRole"
    :style="rootStyle"
    :aria-hidden="ariaHidden"
    :aria-label="accessibleLabel"
    :data-name="props.name || ''"
    :data-spin="spinData"
    :data-tone="props.tone"
  >
    <slot>
      <view
        v-if="iconSource"
        class="varo-icon__asset"
        :style="assetStyle"
        aria-hidden="true"
      />
    </slot>
  </view>
</template>

<json lang="jsonc">
{
  "component": true,
  "styleIsolation": "apply-shared"
}
</json>
