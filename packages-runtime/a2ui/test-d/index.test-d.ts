import type {
  A2uiActionMessage,
  A2uiCatalog,
  A2uiEnvelope,
  A2uiErrorMessage,
  A2uiFunctionHandler,
  A2uiInteraction,
  A2uiLocale,
  A2uiNode,
  A2uiPropValue,
  A2uiRendererDataModel,
  A2uiSession,
  A2uiStateMessageType,
  A2uiSurfaceView,
  A2uiTransportMetadata,
} from '@wevu/a2ui'
import {
  A2UI_PROTOCOL_VERSION,
  A2UI_STATE_MESSAGES,
  createA2uiCatalog,
  createA2uiSession,
  installA2uiRuntimeCompat,
  readA2uiEnvelope,
  readA2uiEnvelopes,
} from '@wevu/a2ui'
import { expectAssignable, expectError, expectType } from 'tsd'

const session: A2uiSession = createA2uiSession({
  catalog: {},
  onSurfaces(views) {
    expectType<A2uiSurfaceView[]>(views)
  },
  onAction(message, metadata) {
    expectType<A2uiActionMessage>(message)
    expectType<A2uiTransportMetadata | undefined>(metadata)
  },
  onError(error, metadata) {
    expectType<A2uiErrorMessage>(error)
    expectType<A2uiTransportMetadata | undefined>(metadata)
  },
  functionImplementations: {
    format: async args => String(args.value),
  },
  locale: 'zh-CN',
})

createA2uiSession({
  catalog: {},
  locale: 'en-US',
  onSurfaces() {},
  onAction() {},
})
expectError(createA2uiSession({
  catalog: {},
  locale: 'fr-FR',
  onSurfaces() {},
  onAction() {},
}))

expectType<void>(session.receive({ version: '1.0', deleteSurface: { surfaceId: 's1' } }))
expectType<Promise<void>>(session.interact('s1', { type: 'action', nodeId: 'n1' }))
expectType<Promise<void>>(session.interact('s1', { type: 'action', nodeId: 'n1', actionName: 'secondary' }))
expectType<Promise<void>>(session.interact('s1', { type: 'action', nodeId: 'n1', eventId: 'event-1' }))
expectType<Promise<void>>(session.interact('s1', { type: 'input', nodeId: 'n1', value: 'x' }))
expectType<Promise<void>>(session.interact('s1', { type: 'input', nodeId: 'n1', bindingName: 'value', value: true }))
expectType<Promise<void>>(session.interact('s1', { type: 'input', nodeId: 'n1', bindingName: 'value', value: 1 }))
expectType<void>(session.dispose())

expectError(session.interact('s1', { type: 'input', nodeId: 'n1' }))
expectError(session.interact('s1', { type: 'action', nodeId: 'n1', value: 'x' }))
expectError(session.interact('s1', { type: 'action', nodeId: 'n1', eventId: 1 }))
expectError(session.interact('s1', { type: 'input', nodeId: 'n1', value: 'x', eventId: 'event-1' }))
expectError(session.interact('s1', { type: 'unknown', nodeId: 'n1' }))
expectError(session.receive())

const handler: A2uiFunctionHandler = async args => args.value

const catalog: A2uiCatalog = createA2uiCatalog({})
expectType<string>(catalog.id)
expectType<string>(catalog.catalog.id)
expectType<A2uiCatalog>(createA2uiCatalog({}, { format: handler }))
expectType<A2uiCatalog>(createA2uiCatalog({}, undefined, { locale: 'zh-CN' }))
expectType<A2uiCatalog>(createA2uiCatalog({}, undefined, { locale: 'en-US' }))
expectError(createA2uiCatalog({}, { format: 1 }))
expectError(createA2uiCatalog({}, undefined, { locale: 'fr-FR' }))
expectError(createA2uiCatalog())

expectType<void>(installA2uiRuntimeCompat())
expectError(installA2uiRuntimeCompat({}))

expectType<'1.0'>(A2UI_PROTOCOL_VERSION)
expectType<A2uiStateMessageType[]>(A2UI_STATE_MESSAGES.filter(() => true))
expectType<A2uiEnvelope>(readA2uiEnvelope({}))
expectType<A2uiEnvelope[]>(readA2uiEnvelopes([]))
expectType<A2uiEnvelope[]>(readA2uiEnvelopes({ messages: [] }))
expectError(readA2uiEnvelope())
expectError(readA2uiEnvelopes())

const locale: A2uiLocale = 'zh-CN'
expectAssignable<A2uiLocale>(locale)
const rendererDataModel: A2uiRendererDataModel = {
  version: '1.0',
  surfaces: { s1: { name: 'Alice' } },
}
const transportMetadata: A2uiTransportMetadata = { a2uiRendererDataModel: rendererDataModel }
expectType<A2uiTransportMetadata>(transportMetadata)
expectError<A2uiRendererDataModel>({ version: '0.9', surfaces: {} })

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
expectAssignable<A2uiInteraction>({ type: 'input', nodeId: 'n1', bindingName: 'value', value: 1 })
expectAssignable<A2uiInteraction>({ type: 'action', nodeId: 'n1', actionName: 'secondary' })
expectError<A2uiInteraction>({ type: 'input', nodeId: 'n1', value: () => 'invalid' })

const nested: A2uiPropValue = { tabs: [{ title: 'A', child: node }] }
expectAssignable<A2uiPropValue>(nested)
expectType<A2uiFunctionHandler>(handler)
