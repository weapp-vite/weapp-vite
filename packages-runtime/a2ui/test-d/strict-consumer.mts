import type { A2uiActionMessage, A2uiCatalog, A2uiEnvelope } from '@wevu/a2ui'
import { createA2uiCatalog, readA2uiEnvelope } from '@wevu/a2ui'

declare const actionMessage: A2uiActionMessage
declare const catalog: A2uiCatalog

const envelope: A2uiEnvelope = readA2uiEnvelope({
  version: '1.0',
  deleteSurface: { surfaceId: 'surface-1' },
})
const createdCatalog: A2uiCatalog = createA2uiCatalog({})

void actionMessage.action
void catalog.catalog.id
void createdCatalog.catalog.id
void envelope.message
