import type { GlassEaselComponentDefinition, GlassEaselRuntimeInfo, GlassEaselWebAdapter, GlassEaselWebAdapterOptions, GlassEaselWebInstance } from './types'
import * as glassEasel from 'glass-easel'
import { wxml } from 'glass-easel-template-compiler'
import glassEaselPackage from 'glass-easel/package.json' with { type: 'json' }
import { getDocumentBackend } from './backend'
import { createSlotParent, normalizeComponentName, registerDefinition } from './definition'

export { createGlassEaselComponentDefinition } from './definition'
export type * from './types'

interface MountedComponent {
  tree: glassEasel.GeneralComponent
  instance: GlassEaselWebInstance
  disposed: boolean
  releasing: boolean
}

/** 使用官方组件树承接模板、slot、数据更新和组件生命周期。 */
export function createGlassEaselWebAdapter(options: GlassEaselWebAdapterOptions = {}): GlassEaselWebAdapter {
  let space: glassEasel.ComponentSpace | undefined = new glassEasel.ComponentSpace()
  space.updateComponentOptions({ writeIdToDOM: true })
  const definitions = new Map<string, glassEasel.GeneralComponentDefinition>()
  const inputs = new Map<string, GlassEaselComponentDefinition>()
  const registeredInputs = new WeakMap<glassEasel.GeneralComponentDefinition, GlassEaselComponentDefinition>()
  const lifecycle = new WeakMap<glassEasel.GeneralComponent, string[]>()
  const ownership = new WeakMap<GlassEaselWebInstance, MountedComponent>()
  const mounted = new Set<MountedComponent>()
  let disposed = false

  const assertActive = () => {
    if (disposed) {
      throw new Error('cannot use a disposed glass-easel adapter')
    }
  }
  const getOwned = (instance: GlassEaselWebInstance) => {
    const record = ownership.get(instance)
    if (!record) {
      throw new Error('glass-easel component is not owned by this adapter')
    }
    return record
  }
  const getLive = (instance: GlassEaselWebInstance) => {
    const record = getOwned(instance)
    assertActive()
    if (record.disposed || record.releasing) {
      throw new Error('cannot use a disposed glass-easel component')
    }
    return record
  }
  const release = (record: MountedComponent) => {
    if (record.disposed || record.releasing) {
      return
    }
    record.releasing = true
    try {
      glassEasel.Element.pretendDetached(record.tree)
      record.tree.destroyBackendElementOnSubtree()
      record.instance.root.remove()
      record.disposed = true
      mounted.delete(record)
    }
    finally {
      record.releasing = false
    }
  }

  const assertDependencies = (currentSpace: glassEasel.ComponentSpace, root: glassEasel.GeneralComponentDefinition) => {
    const visited = new Set<glassEasel.GeneralComponentDefinition>()
    const visit = (definition: glassEasel.GeneralComponentDefinition) => {
      if (visited.has(definition)) {
        return
      }
      visited.add(definition)
      for (const [alias, url] of Object.entries(registeredInputs.get(definition)?.usingComponents ?? {})) {
        const dependency = currentSpace.getComponentByUrlWithoutDefault(url, definition.is)
        if (!dependency || !registeredInputs.has(dependency)) {
          throw new Error(`component dependency is not registered: ${definition.is} -> ${alias} (${url})`)
        }
        visit(dependency)
      }
    }
    visit(root)
  }

  return {
    registerComponent(definition) {
      assertActive()
      if (!definition.name || !definition.template) {
        throw new TypeError('glass-easel component requires name and template')
      }
      definition = Object.freeze({
        ...definition,
        name: normalizeComponentName(definition.name),
        usingComponents: Object.freeze({ ...definition.usingComponents }),
      })
      if (definitions.has(definition.name)) {
        throw new Error(`component already registered: ${definition.name}`)
      }
      const registered = registerDefinition(space!, definition, lifecycle)
      definitions.set(definition.name, registered)
      inputs.set(definition.name, definition)
      registeredInputs.set(registered, definition)
    },
    mountComponent(name, container, props = {}, slots = {}) {
      assertActive()
      name = normalizeComponentName(name)
      const definition = definitions.get(name)
      if (!definition) {
        throw new Error(`component is not registered: ${name}`)
      }
      assertDependencies(space!, definition)
      const backend = getDocumentBackend()
      if (container.ownerDocument !== document) {
        throw new Error('glass-easel components must mount in the current document')
      }
      const hasParent = Object.keys(slots).length > 0 || definition.getComponentOptions().virtualHost
      const rootDefinition = hasParent ? createSlotParent(space!, definition, slots) : definition
      const tree = glassEasel.Component.createWithContext('glass-easel-root', rootDefinition, backend, (component) => {
        component.setData(props)
      })
      const native = hasParent
        ? tree.getShadowRoot()?.childNodes[0]?.asGeneralComponent()
        : tree
      if (!native) {
        tree.destroyBackendElementOnSubtree()
        throw new Error('glass-easel slot parent did not create its content component')
      }
      if (hasParent) {
        native.setData(props)
      }
      const root = tree.getBackendElement() as unknown as HTMLElement
      let record: MountedComponent
      const instance = {
        root,
        native,
        definition: inputs.get(name)!,
        get props() { return glassEasel.dataUtils.deepCopy(native.data, true) as Record<string, unknown> },
        get disposed() { return record.disposed },
      } as GlassEaselWebInstance
      record = { tree, instance, disposed: false, releasing: false }
      ownership.set(instance, record)
      let placeholder: HTMLElement | undefined
      let insertedPlaceholder = false
      try {
        assertActive()
        placeholder = options.host?.createElement?.('glass-easel-placeholder') ?? document.createElement('glass-easel-placeholder')
        if (placeholder.parentNode || placeholder.ownerDocument !== document) {
          throw new Error('glass-easel placeholder must be a new element in the current document')
        }
        assertActive()
        container.append(placeholder)
        insertedPlaceholder = true
        glassEasel.Element.replaceDocumentElement(tree, container as unknown as glassEasel.GeneralBackendElement, placeholder as unknown as glassEasel.GeneralBackendElement)
        assertActive()
        mounted.add(record)
        return instance
      }
      catch (cause) {
        if (insertedPlaceholder) {
          placeholder?.remove()
        }
        release(record)
        throw cause
      }
    },
    updateComponent(instance, props) {
      const record = getLive(instance)
      if (record.tree !== instance.native) {
        record.tree.setData(props)
      }
      instance.native.setData(props)
    },
    triggerEvent(instance, name, detail) {
      getLive(instance)
      instance.native.triggerEvent(name, detail)
      options.host?.dispatchEvent?.(new CustomEvent(name, { detail }), instance)
    },
    unmountComponent(instance) {
      release(getOwned(instance))
    },
    getSnapshot(instance) {
      const record = getOwned(instance)
      return {
        name: instance.definition.name,
        props: glassEasel.dataUtils.deepCopy(instance.native.data, true) as Record<string, unknown>,
        html: instance.root.innerHTML,
        lifecycle: [...(lifecycle.get(instance.native) ?? [])],
        disposed: record.disposed,
      }
    },
    dispose() {
      disposed = true
      const errors: unknown[] = []
      for (const record of mounted) {
        try {
          release(record)
        }
        catch (cause) {
          errors.push(cause)
        }
      }
      definitions.clear()
      inputs.clear()
      space = undefined
      if (errors.length) {
        throw new AggregateError(errors, 'glass-easel adapter cleanup failed')
      }
    },
  }
}

/** 返回构建所使用的官方依赖版本和当前环境能力。 */
export function getGlassEaselRuntimeInfo(): GlassEaselRuntimeInfo {
  return {
    version: glassEaselPackage.version,
    hasDomBackend: typeof document !== 'undefined' && typeof glassEasel.CurrentWindowBackendContext === 'function',
    hasTemplateCompiler: typeof wxml === 'function',
  }
}
