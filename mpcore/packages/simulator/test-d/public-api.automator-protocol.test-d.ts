import type {
  HeadlessTestingCDP,
  HeadlessTestingDispatchEventInit,
  HeadlessTestingNodeHandle,
  HeadlessTestingSessionHandle,
  HeadlessTestingTouchEventInit,
} from '..'
import { expectAssignable, expectType } from 'tsd'

declare const session: HeadlessTestingSessionHandle
declare const node: HeadlessTestingNodeHandle

expectType<Promise<void>>(session.disconnect())
expectType<Promise<void>>(session.close())
expectType<Promise<unknown>>(session.send('Tool.getInfo'))
expectType<Promise<{ result: number }>>(session.send<{ result: number }>('App.callFunction', { functionDeclaration: '() => 1' }, { timeout: 100 }))
expectType<HeadlessTestingCDP>(session.CDP())
expectType<Promise<unknown>>(session.CDP().enable({ timeout: 100 }))
expectType<Promise<unknown>>(session.CDP().sendCommand('Runtime', 'getHeapUsage', {}, { timeout: 100 }))
expectType<Promise<unknown>>(session.CDP().listProtocol())
expectType<() => void>(session.CDP().onEvent((domain, event, params) => {
  expectType<string>(domain)
  expectType<string>(event)
  expectType<unknown>(params)
}))
expectAssignable<HeadlessTestingTouchEventInit>({ changedTouches: [{ identifier: 0, pageX: 10, pageY: 20 }] })
expectAssignable<HeadlessTestingTouchEventInit>({ changeTouches: [{ clientX: 10, clientY: 20 }] })
expectAssignable<HeadlessTestingDispatchEventInit>({ eventName: 'touchend', $: '#target', changedTouches: [] })
expectType<Promise<unknown>>(node.touchstart({ touches: [], changedTouches: [] }))
expectType<Promise<unknown>>(node.touchmove({ changeTouches: [] }))
expectType<Promise<unknown>>(node.touchend({ changedTouches: [] }))
expectType<Promise<unknown>>(node.dispatchEvent({ eventName: 'touchend', changedTouches: [] }))
