export interface NativeComponentDescriptor {
  name: string
  webTag: string
  attributes: readonly string[]
  propertyAttributes?: readonly string[]
  defaultStyle: string
}

export const NATIVE_COMPONENT_DESCRIPTORS = Object.freeze([
  {
    name: 'view',
    webTag: 'weapp-view',
    attributes: [],
    defaultStyle: 'display: block; box-sizing: border-box;',
  },
  {
    name: 'text',
    webTag: 'weapp-text',
    attributes: ['selectable', 'user-select', 'space', 'decode'],
    defaultStyle: 'display: inline; box-sizing: border-box; white-space: pre-wrap;',
  },
  {
    name: 'image',
    webTag: 'weapp-image',
    attributes: ['src', 'mode', 'lazy-load', 'alt'],
    defaultStyle: 'display: inline-block; box-sizing: border-box; width: 320px; height: 240px; overflow: hidden; vertical-align: middle;',
  },
  {
    name: 'button',
    webTag: 'weapp-button',
    attributes: ['type', 'size', 'plain', 'disabled', 'loading', 'form-type', 'open-type'],
    defaultStyle: 'display: block; box-sizing: border-box;',
  },
  {
    name: 'input',
    webTag: 'weapp-input',
    attributes: ['name', 'value', 'type', 'password', 'placeholder', 'disabled', 'maxlength', 'confirm-type', 'focus'],
    defaultStyle: 'display: block; box-sizing: border-box; min-height: 1.4em;',
  },
  {
    name: 'textarea',
    webTag: 'weapp-textarea',
    attributes: ['name', 'value', 'placeholder', 'disabled', 'maxlength', 'confirm-type', 'auto-focus', 'focus', 'auto-height'],
    defaultStyle: 'display: block; box-sizing: border-box; width: 300px; height: 150px;',
  },
  {
    name: 'form',
    webTag: 'weapp-form',
    attributes: [],
    defaultStyle: 'display: inline; box-sizing: border-box;',
  },
  {
    name: 'label',
    webTag: 'weapp-label',
    attributes: ['for'],
    defaultStyle: 'display: inline; box-sizing: border-box; cursor: pointer;',
  },
  {
    name: 'checkbox-group',
    webTag: 'weapp-checkbox-group',
    attributes: ['name'],
    defaultStyle: 'display: block; box-sizing: border-box;',
  },
  {
    name: 'checkbox',
    webTag: 'weapp-checkbox',
    attributes: ['value', 'checked', 'disabled', 'color'],
    defaultStyle: 'display: inline-flex; box-sizing: border-box; align-items: center; vertical-align: middle;',
  },
  {
    name: 'radio-group',
    webTag: 'weapp-radio-group',
    attributes: ['name'],
    defaultStyle: 'display: block; box-sizing: border-box;',
  },
  {
    name: 'radio',
    webTag: 'weapp-radio',
    attributes: ['value', 'checked', 'disabled', 'color'],
    defaultStyle: 'display: inline-flex; box-sizing: border-box; align-items: center; vertical-align: middle;',
  },
  {
    name: 'switch',
    webTag: 'weapp-switch',
    attributes: ['name', 'checked', 'disabled', 'type', 'color'],
    defaultStyle: 'display: inline-flex; box-sizing: border-box; align-items: center; vertical-align: middle;',
  },
  {
    name: 'picker',
    webTag: 'weapp-picker',
    attributes: ['name', 'header-text', 'mode', 'range', 'range-key', 'value', 'start', 'end', 'fields', 'custom-item', 'level', 'disabled'],
    propertyAttributes: ['range', 'value'],
    defaultStyle: 'display: block; box-sizing: border-box;',
  },
  {
    name: 'picker-view',
    webTag: 'weapp-picker-view',
    attributes: ['value', 'mask-class', 'indicator-style', 'indicator-class', 'mask-style', 'immediate-change'],
    propertyAttributes: ['value'],
    defaultStyle: 'position: relative; display: flex; box-sizing: border-box; height: 225px; overflow: hidden;',
  },
  {
    name: 'picker-view-column',
    webTag: 'weapp-picker-view-column',
    attributes: ['indicator-style'],
    defaultStyle: 'display: block; box-sizing: border-box; min-width: 0; height: 100%; flex: 1;',
  },
  {
    name: 'slider',
    webTag: 'weapp-slider',
    attributes: ['name', 'min', 'max', 'step', 'disabled', 'value', 'color', 'selected-color', 'active-color', 'background-color', 'block-size', 'block-color', 'show-value'],
    defaultStyle: 'display: block; box-sizing: border-box; margin: 10px 18px;',
  },
  {
    name: 'scroll-view',
    webTag: 'weapp-scroll-view',
    attributes: ['scroll-x', 'scroll-y', 'scroll-top', 'scroll-left'],
    defaultStyle: 'display: block; box-sizing: border-box;',
  },
  {
    name: 'navigator',
    webTag: 'weapp-navigator',
    attributes: [
      'url',
      'open-type',
      'delta',
      'target',
      'app-id',
      'path',
      'extra-data',
      'version',
      'short-link',
      'hover-class',
      'hover-start-time',
      'hover-stay-time',
      'hover-stop-propagation',
    ],
    propertyAttributes: ['extra-data'],
    defaultStyle: 'display: block; box-sizing: border-box;',
  },
  {
    name: 'swiper',
    webTag: 'weapp-swiper',
    attributes: [
      'current',
      'current-item-id',
      'autoplay',
      'interval',
      'duration',
      'circular',
      'vertical',
      'indicator-dots',
      'indicator-color',
      'indicator-active-color',
      'display-multiple-items',
      'previous-margin',
      'next-margin',
      'disable-touch',
      'easing-function',
    ],
    defaultStyle: 'display: block; box-sizing: border-box; height: 150px; overflow: hidden;',
  },
  {
    name: 'swiper-item',
    webTag: 'weapp-swiper-item',
    attributes: ['item-id'],
    defaultStyle: 'display: block; box-sizing: border-box; width: 100%; height: 100%; overflow: hidden;',
  },
] as const satisfies readonly NativeComponentDescriptor[])

export type SupportedNativeComponentName = typeof NATIVE_COMPONENT_DESCRIPTORS[number]['name']
export type NativeComponentWebTag = typeof NATIVE_COMPONENT_DESCRIPTORS[number]['webTag']

const descriptorMap = new Map<string, NativeComponentDescriptor>(
  NATIVE_COMPONENT_DESCRIPTORS.map(descriptor => [descriptor.name, descriptor]),
)

const KNOWN_UNSUPPORTED_NATIVE_COMPONENTS = new Set([
  'cover-view',
  'cover-image',
  'movable-area',
  'movable-view',
  'icon',
  'progress',
  'rich-text',
  'editor',
  'keyboard-accessory',
  'match-media',
  'root-portal',
  'page-container',
  'share-element',
  'audio',
  'video',
  'camera',
  'live-player',
  'live-pusher',
  'map',
  'canvas',
  'web-view',
  'ad',
  'official-account',
  'open-data',
])

export function getNativeComponentDescriptor(name: string) {
  return descriptorMap.get(name.toLowerCase())
}

export function resolveNativeComponentWebTag(name: string) {
  return getNativeComponentDescriptor(name)?.webTag
}

export function resolveNativeComponentPropertyAttributes(name: string) {
  return getNativeComponentDescriptor(name)?.propertyAttributes ?? []
}

export function isKnownUnsupportedNativeComponent(name: string) {
  return KNOWN_UNSUPPORTED_NATIVE_COMPONENTS.has(name.toLowerCase())
}
