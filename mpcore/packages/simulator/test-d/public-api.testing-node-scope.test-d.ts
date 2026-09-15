import type {
  HeadlessTestingNodeEventInit,
  HeadlessTestingNodeHandle,
  HeadlessTestingNodeValueEventInit,
  HeadlessTestingPageHandle,
} from '..'
import { expectAssignable, expectType } from 'tsd'

declare const page: HeadlessTestingPageHandle
declare const node: HeadlessTestingNodeHandle

expectType<Promise<HeadlessTestingNodeHandle | null>>(page.$('#declared-component'))
expectType<Promise<HeadlessTestingNodeHandle[]>>(page.$$('component'))
expectType<Promise<HeadlessTestingNodeHandle | null>>(node.$('.projected'))
expectType<Promise<HeadlessTestingNodeHandle[]>>(node.$$('.projected'))
expectType<Promise<string>>(node.text())
expectType<Promise<Record<string, unknown>>>(node.dataset())
expectAssignable<HeadlessTestingNodeEventInit>({
  currentTarget: { dataset: { index: 0 } },
  dataset: { index: 0 },
  target: { dataset: { index: 0 } },
})
expectAssignable<HeadlessTestingNodeValueEventInit>({
  dataset: { index: 0 },
  detail: { value: 'updated' },
})
expectType<Promise<unknown>>(node.tap({ dataset: { index: 0 } }))
