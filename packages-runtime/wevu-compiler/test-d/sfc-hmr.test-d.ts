import type {
  VueSfcBlockChanges,
  VueSfcBlockSignatures,
  VueSfcBlockType,
  VueSfcHmrSignatures,
} from '@wevu/compiler'
import {
  classifyVueSfcBlockChanges,
  compileVueFile,
  resolveVueSfcHmrSignatures,
} from '@wevu/compiler'
import { expectType } from 'tsd'

const signatures = resolveVueSfcHmrSignatures(
  '<template><view /></template>',
  'src/components/card.vue',
)
expectType<VueSfcHmrSignatures>(signatures)
void compileVueFile(
  '<script setup>const color = "red"</script><template><view /></template><style>.root { color: v-bind(color); }</style>',
  'src/components/card.vue',
).then((compiled) => {
  expectType<string[] | undefined>(compiled.meta?.cssVars)
})

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
