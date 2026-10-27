import type { GlassEaselComponentDefinition } from './types'
import * as glassEasel from 'glass-easel'
import { wxml } from 'glass-easel-template-compiler'

export type LifecycleRecords = WeakMap<glassEasel.GeneralComponent, string[]>

export function normalizeComponentName(name: string): string {
  if (!name || /[\\?#:]/.test(name)) {
    throw new TypeError('glass-easel component name must be a root-relative POSIX path')
  }
  const segments: string[] = []
  for (const segment of name.split('/')) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      if (!segments.length) {
        throw new TypeError('glass-easel component name cannot escape its component space')
      }
      segments.pop()
    }
    else {
      segments.push(segment)
    }
  }
  if (!segments.length) {
    throw new TypeError('glass-easel component name must not be empty')
  }
  return segments.join('/')
}

export function registerDefinition(
  space: glassEasel.ComponentSpace,
  definition: GlassEaselComponentDefinition,
  records: LifecycleRecords,
): glassEasel.GeneralComponentDefinition {
  const lifetimes = { ...definition.lifetimes }
  for (const name of ['created', 'attached', 'ready', 'detached']) {
    const callback = lifetimes[name]
    lifetimes[name] = function (this: glassEasel.GeneralComponent, ...args: unknown[]) {
      let lifecycle = records.get(this)
      if (!lifecycle) {
        lifecycle = []
        records.set(this, lifecycle)
      }
      lifecycle.push(name)
      return callback?.apply(this, args)
    }
  }
  return space.define(definition.name)
    .usingComponents(definition.usingComponents ?? {})
    .definition({
      template: wxml(definition.template),
      data: definition.data,
      properties: definition.properties,
      methods: definition.methods,
      observers: definition.observers,
      options: definition.options,
      lifetimes,
    })
    .registerComponent()
    .general()
}

/** 独立定义不进入其他 adapter 的组件空间。 */
export function createGlassEaselComponentDefinition(definition: GlassEaselComponentDefinition): glassEasel.GeneralComponentDefinition {
  return registerDefinition(new glassEasel.ComponentSpace(), { ...definition, name: normalizeComponentName(definition.name) }, new WeakMap())
}

/** 旧 slots 参数通过真实父组件投影，字符串仅作为调用方控制的 WXML 输入。 */
export function createSlotParent(
  space: glassEasel.ComponentSpace,
  definition: glassEasel.GeneralComponentDefinition,
  slots: Record<string, string>,
): glassEasel.GeneralComponentDefinition {
  const content = Object.entries(slots).map(([name, source]) => {
    const attribute = name === 'default'
      ? ''
      : ` slot="${name.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')}"`
    return `<block${attribute}>${source}</block>`
  }).join('')
  return space.define()
    .usingComponents({ 'adapter-content': definition })
    .definition({ template: wxml(`<adapter-content>${content}</adapter-content>`) })
    .registerComponent()
    .general()
}
