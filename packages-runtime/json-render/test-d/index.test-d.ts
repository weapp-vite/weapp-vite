import type { CatalogSpec, RenderNode } from '@wevu/json-render'
import { createJsonRenderer, defineRendererCatalog, standardComponents, useJsonRenderer } from '@wevu/json-render'
import { JsonRendererResolver } from '@wevu/json-render/resolver'
import { expectError, expectType } from 'tsd'
import { z } from 'zod'

const catalog = defineRendererCatalog({
  components: { ...standardComponents, Counter: { props: z.object({ value: z.number() }), events: ['change'] } },
  actions: { update: z.object({ amount: z.number() }) },
})
const spec: CatalogSpec<typeof catalog> = {
  root: 'counter',
  elements: { counter: { type: 'Counter', props: { value: { $state: '/count' } }, on: { change: { action: 'update', params: { amount: 3 } } } } },
}
const renderer = createJsonRenderer({
  catalog,
  spec,
  initialState: { count: 1 },
  actions: {
    update(params, context) {
      expectType<number>(params.amount)
      expectType<number>(context.state.count)
      expectType<boolean>(context.isActive())
      context.setState('/count', params.amount)
      context.onCleanup(() => {})
    },
  },
})
expectType<RenderNode | null>(renderer.tree.value)
expectType<Promise<boolean>>(renderer.dispatch({ id: 'counter', name: 'change', value: 2 }))
expectType<boolean>(renderer.createStream(spec).push('', true))
expectType<boolean>(renderer.load(spec, { count: 2 }))
expectType<string | undefined>(JsonRendererResolver().resolve('json-renderer')?.from)
expectError(renderer.setState('/count', () => 1))
expectError(renderer.load(spec, { count: 'wrong' }))
expectError(createJsonRenderer({ catalog, spec, initialState: { count: 1 }, actions: {} }))
expectError(useJsonRenderer({ catalog, spec, initialState: { count: 1 }, actions: { unknown() {} } }))
expectError({ root: 'x', elements: { x: { type: 'Missing', props: {} } } } satisfies CatalogSpec<typeof catalog>)
expectError({ root: 'x', elements: { x: { type: 'Counter', props: { value: 'wrong' } } } } satisfies CatalogSpec<typeof catalog>)
expectError({ root: 'x', elements: { x: { type: 'Counter', props: { value: { $bindState: '/count' } } } } } satisfies CatalogSpec<typeof catalog>)
expectError({ root: 'x', elements: { x: { type: 'Counter', props: { value: 1 }, on: { change: { action: 'update', params: { amount: 'wrong' } } } } } } satisfies CatalogSpec<typeof catalog>)
