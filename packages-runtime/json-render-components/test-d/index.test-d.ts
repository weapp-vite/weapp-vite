import type { JsonValue, RendererEvent, RenderNode } from '@wevu/json-render-components/types'
import { expectAssignable, expectNotAssignable } from 'tsd'

expectAssignable<RendererEvent>({ id: 'field', name: 'input', value: 'hello' })
expectAssignable<RenderNode>({ id: 'root', type: 'Card', props: { title: '示例' }, children: [] })
expectNotAssignable<JsonValue>(() => 'unsupported')
expectNotAssignable<RendererEvent>({ id: 'field', name: 'input', value: () => 1 })
expectNotAssignable<RenderNode>({ id: 'root', type: 'Card', props: {}, children: ['child-id'] })
