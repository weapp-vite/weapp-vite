import type { HeadlessTestingNodeHandle, HeadlessTestingPageHandle } from '..'
import { expectType } from 'tsd'

declare const page: HeadlessTestingPageHandle
declare const node: HeadlessTestingNodeHandle

expectType<Promise<HeadlessTestingNodeHandle | null>>(page.$('#declared-component'))
expectType<Promise<HeadlessTestingNodeHandle[]>>(page.$$('component'))
expectType<Promise<HeadlessTestingNodeHandle | null>>(node.$('.projected'))
expectType<Promise<HeadlessTestingNodeHandle[]>>(node.$$('.projected'))
expectType<Promise<string>>(node.text())
