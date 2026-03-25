export interface HeadlessAppDefinition extends Record<string, any> {}

export interface HeadlessPageDefinition extends Record<string, any> {}

export interface HeadlessComponentDefinition extends Record<string, any> {}

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
  const id = registries.currentLoadContext?.route ?? `anonymous:${registries.components.size}`
  if (registries.components.has(id)) {
    throw createDuplicateRegistrationError('component', id)
  }
  registries.components.set(id, definition)
  return definition
}
