export interface NativeComponentDescriptor {
  name: string
  webTag: string
  attributes: readonly string[]
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
    name: 'scroll-view',
    webTag: 'weapp-scroll-view',
    attributes: ['scroll-x', 'scroll-y', 'scroll-top', 'scroll-left'],
    defaultStyle: 'display: block; box-sizing: border-box;',
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
  'navigator',
  'swiper',
  'swiper-item',
  'movable-area',
  'movable-view',
  'icon',
  'progress',
  'rich-text',
  'picker',
  'picker-view',
  'slider',
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

export function isKnownUnsupportedNativeComponent(name: string) {
  return KNOWN_UNSUPPORTED_NATIVE_COMPONENTS.has(name.toLowerCase())
}
