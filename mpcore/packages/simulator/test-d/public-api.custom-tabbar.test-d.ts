import type { HeadlessComponentInstance, HeadlessPageInstance, HeadlessTestingNodeHandle, HeadlessTestingPageHandle } from '..'
import { expectType } from 'tsd'

declare const page: HeadlessPageInstance
declare const handle: HeadlessTestingPageHandle
declare const node: HeadlessTestingNodeHandle
expectType<HeadlessComponentInstance | null | undefined>(page.getTabBar?.())
expectType<Promise<HeadlessTestingNodeHandle[]>>(handle.getElementsByXpath('//*[@id="tab-counter"]'))
expectType<Promise<HeadlessTestingNodeHandle[]>>(node.getElementsByXpath('.//button'))
