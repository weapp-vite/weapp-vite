import type { Element, IEventOptions } from '@weapp-vite/miniprogram-automator'
import { expectError, expectType } from 'tsd'

declare const element: Element
const input: IEventOptions = { eventName: 'input', detail: { value: 'boundary-input' } }
const touch: IEventOptions = { eventName: 'touchend', changedTouches: [], detail: { source: 'test' } }
expectType<Promise<void>>(element.dispatchEvent(input))
expectType<Promise<void>>(element.dispatchEvent(touch))
expectType<Promise<void>>(element.dispatchEvent({ eventName: 'custom' }))
expectType<Promise<void>>(element.dispatchEvent({ eventName: 'custom', $: '#child', detail: { nested: { value: false } } }))
expectError(element.dispatchEvent({ eventName: 'input', eventData: { value: 'internal-protocol-field' } }))
expectError(element.dispatchEvent({ eventName: 'input', detail: 42 }))
expectError(element.dispatchEvent({ detail: { value: 'missing-event-name' } }))
