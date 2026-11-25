import type {
  A2uiActionMessage,
  A2uiCatalog,
  A2uiEnvelope,
  A2uiInteraction,
  A2uiNode,
  A2uiSession,
  A2uiStateMessageType,
  A2uiSurfaceView,
} from '@wevu/a2ui'
import {
  A2UI_PROTOCOL_VERSION,
  A2UI_STATE_MESSAGES,
  createA2uiCatalog,
  createA2uiSession,
  installA2uiRuntimeCompat,
  readA2uiEnvelope,
} from '@wevu/a2ui'
import { expectAssignable, expectError, expectType } from 'tsd'

const session: A2uiSession = createA2uiSession({
  catalog: {},
  onSurfaces(views) {
    expectType<A2uiSurfaceView[]>(views)
  },
  onAction(message) {
    expectType<A2uiActionMessage>(message)
  },
})

expectType<void>(session.receive({ version: '1.0', deleteSurface: { surfaceId: 's1' } }))
expectType<Promise<void>>(session.interact('s1', { type: 'action', nodeId: 'n1' }))
expectType<Promise<void>>(session.interact('s1', { type: 'input', nodeId: 'n1', value: 'x' }))
expectType<void>(session.dispose())

expectError(session.interact('s1', { type: 'input', nodeId: 'n1' }))
expectError(session.interact('s1', { type: 'action', nodeId: 'n1', value: 'x' }))
expectError(session.interact('s1', { type: 'unknown', nodeId: 'n1' }))
expectError(session.receive())

const catalog: A2uiCatalog = createA2uiCatalog({})
expectType<string>(catalog.id)
expectType<string>(catalog.catalog.id)
expectError(createA2uiCatalog())

expectType<void>(installA2uiRuntimeCompat())
expectError(installA2uiRuntimeCompat({}))

expectType<'1.0'>(A2UI_PROTOCOL_VERSION)
expectType<A2uiStateMessageType[]>(A2UI_STATE_MESSAGES.filter(() => true))
expectType<A2uiEnvelope>(readA2uiEnvelope({}))
expectError(readA2uiEnvelope())

const node: A2uiNode = {
  id: 'n1-v0',
  componentId: 'text',
  type: 'Text',
  props: { text: 'hello' },
  children: [],
  actions: [],
}
expectType<readonly A2uiNode[]>(node.children)
expectError<A2uiNode>({ id: 'n1', componentId: 'text', type: 'Text', props: {}, children: [] })
expectAssignable<A2uiInteraction>({ type: 'input', nodeId: 'n1', value: 'x' })
expectError<A2uiInteraction>({ type: 'input', nodeId: 'n1', value: 1 })
