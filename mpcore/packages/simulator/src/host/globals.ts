export interface HeadlessAppDefinition extends Record<string, any> {}

export interface HeadlessPageDefinition extends Record<string, any> {}

export interface HeadlessComponentDefinition extends Record<string, any> {}

export interface HeadlessBehaviorDefinition extends Record<string, any> {
  __isHeadlessBehavior__?: boolean
}

export interface HeadlessHostLoadContext {
  kind: 'app' | 'page' | 'component'
  route?: string
}

export interface HeadlessHostRegistries {
  appDefinition: HeadlessAppDefinition | null
  components: Map<string, HeadlessComponentDefinition>
  currentLoadContext: HeadlessHostLoadContext | null
  pages: Map<string, HeadlessPageDefinition>
}

function createDuplicateRegistrationError(kind: string, id: string) {
  return new Error(`Duplicate ${kind} registration in headless runtime: ${id}`)
}

function callDefinitionMethod(
  instance: Record<string, any>,
  method: unknown,
  args: any[],
) {
  if (typeof method === 'function') {
    return method.apply(instance, args)
  }
}

function normalizeComponentPageDefinition(definition: HeadlessComponentDefinition): HeadlessPageDefinition {
  const {
    lifetimes = {},
    methods = {},
    pageLifetimes = {},
    ...rest
  } = definition
  const created = lifetimes.created ?? rest.created
  const attached = lifetimes.attached ?? rest.attached
  const ready = lifetimes.ready ?? rest.ready ?? methods.onReady ?? rest.onReady
  const detached = lifetimes.detached ?? rest.detached ?? methods.onUnload ?? rest.onUnload
  const load = methods.onLoad ?? rest.onLoad
  const show = pageLifetimes.show ?? methods.onShow ?? rest.onShow
  const hide = pageLifetimes.hide ?? methods.onHide ?? rest.onHide
  const resize = pageLifetimes.resize ?? methods.onResize ?? rest.onResize
  const routeDone = pageLifetimes.routeDone ?? methods.onRouteDone ?? rest.onRouteDone

  return {
    ...rest,
    ...methods,
    onLoad(this: Record<string, any>, ...args: any[]) {
      callDefinitionMethod(this, created, [])
      callDefinitionMethod(this, attached, [])
      return callDefinitionMethod(this, load, args)
    },
    onShow(this: Record<string, any>, ...args: any[]) {
      return callDefinitionMethod(this, show, args)
    },
    onHide(this: Record<string, any>, ...args: any[]) {
      return callDefinitionMethod(this, hide, args)
    },
    onReady(this: Record<string, any>, ...args: any[]) {
      return callDefinitionMethod(this, ready, args)
    },
    onUnload(this: Record<string, any>, ...args: any[]) {
      return callDefinitionMethod(this, detached, args)
    },
    onResize(this: Record<string, any>, ...args: any[]) {
      return callDefinitionMethod(this, resize, args)
    },
    onRouteDone(this: Record<string, any>, ...args: any[]) {
      return callDefinitionMethod(this, routeDone, args)
    },
  }
}

export function createHostRegistries(): HeadlessHostRegistries {
  return {
    appDefinition: null,
    components: new Map(),
    currentLoadContext: null,
    pages: new Map(),
  }
}

export function registerAppDefinition(registries: HeadlessHostRegistries, definition: HeadlessAppDefinition) {
  if (registries.appDefinition) {
    throw createDuplicateRegistrationError('app', 'app')
  }
  registries.appDefinition = definition
  return definition
}

export function registerPageDefinition(registries: HeadlessHostRegistries, definition: HeadlessPageDefinition) {
  const route = registries.currentLoadContext?.route
  if (!route) {
    throw new Error('Cannot register Page() without an active page load context in headless runtime.')
  }
  if (registries.pages.has(route)) {
    throw createDuplicateRegistrationError('page', route)
  }
  registries.pages.set(route, definition)
  return definition
}

export function registerComponentDefinition(registries: HeadlessHostRegistries, definition: HeadlessComponentDefinition) {
  if (registries.currentLoadContext?.kind === 'page') {
    return registerPageDefinition(registries, normalizeComponentPageDefinition(definition))
  }
  const id = registries.currentLoadContext?.route ?? `anonymous:${registries.components.size}`
  if (registries.components.has(id)) {
    throw createDuplicateRegistrationError('component', id)
  }
  registries.components.set(id, definition)
  return definition
}
