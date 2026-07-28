export type ComponentInteraction = {
  type: 'command'
  method: string
  commandTarget?: 'component' | 'parent'
  delayBefore?: number
  delayAfter?: number
  args?: readonly unknown[]
  event?: string
  eventTarget?: 'component' | 'parent'
  expect?: {
    binding: string
    value: unknown
  }
  expectTarget?: {
    method: string
    value: unknown
  }
} | {
  type: 'model'
  model: string
  value: unknown
  event?: string
}

export interface ComponentMarkup {
  markup: string
  parent?: string
  setup?: string
  imports?: readonly {
    name: string
    source: string
  }[]
  interaction?: ComponentInteraction
}

export interface ComponentLibraryGeneratorOptions {
  appRoot: string
  checkOnly: boolean
  components: string[]
  getComponentMarkup: (component: string) => ComponentMarkup
  logPrefix: string
  projectDescription: string
  projectName: string
  title: string
  versionLabel: string
}
