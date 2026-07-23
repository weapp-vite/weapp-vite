export type SupportedNativeComponentName = 'view' | 'text' | 'image' | 'button' | 'input' | 'scroll-view'

export interface NativeComponentDescriptor {
  name: SupportedNativeComponentName
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
    attributes: ['value', 'type', 'password', 'placeholder', 'disabled', 'maxlength', 'confirm-type'],
    defaultStyle: 'display: block; box-sizing: border-box; min-height: 1.4em;',
  },
  {
    name: 'scroll-view',
    webTag: 'weapp-scroll-view',
    attributes: ['scroll-x', 'scroll-y', 'scroll-top', 'scroll-left'],
    defaultStyle: 'display: block; box-sizing: border-box;',
  },
] as const satisfies readonly NativeComponentDescriptor[])

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
  'textarea',
  'form',
  'label',
  'picker',
  'picker-view',
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
