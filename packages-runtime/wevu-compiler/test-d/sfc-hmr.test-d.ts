import type {
  VueSfcBlockChanges,
  VueSfcBlockSignatures,
  VueSfcBlockType,
  VueSfcHmrSignatures,
} from '@wevu/compiler'
import {
  classifyVueSfcBlockChanges,
  resolveVueSfcHmrSignatures,
} from '@wevu/compiler'
import { expectType } from 'tsd'

const signatures = resolveVueSfcHmrSignatures(
  '<template><view /></template>',
  '/project/src/components/card.vue',
)
expectType<VueSfcHmrSignatures>(signatures)

const previous: VueSfcBlockSignatures = {
  config: 'config-before',
  script: 'script-before',
  style: 'style-before',
  template: 'template-before',
}
const current: VueSfcBlockSignatures = {
  ...previous,
  template: 'template-after',
}
const changes = classifyVueSfcBlockChanges(previous, current)
expectType<VueSfcBlockChanges>(changes)
expectType<VueSfcBlockType>(changes[0]!)
