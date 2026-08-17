import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createWevuComponentDefinition,
  getWevuComponentLifecycleDefinition,
} from '@/internal-runtime'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('runtime: component definition factory', () => {
  it('creates the production lifecycle definition without native registration', () => {
    const componentConstructor = vi.fn()
    vi.stubGlobal('Component', componentConstructor)

    const definition = createWevuComponentDefinition({
      props: { count: { type: Number, default: 1 } },
      setup: props => ({ count: props.count }),
    })
    const lifecycleDefinition = getWevuComponentLifecycleDefinition(definition)

    expect(componentConstructor).not.toHaveBeenCalled()
    expect(lifecycleDefinition?.properties.count.value).toBe(1)
    expect(lifecycleDefinition?.lifetimes.created).toBeTypeOf('function')
    expect(lifecycleDefinition?.lifetimes.attached).toBeTypeOf('function')
    expect(lifecycleDefinition?.lifetimes.ready).toBeTypeOf('function')
    expect(lifecycleDefinition?.lifetimes.detached).toBeTypeOf('function')
  })
})
