import type { WeappInjectWebRuntimeGlobalsTarget } from '@wevu/web-apis'
import { ResponsePolyfill, TextDecoderPolyfill } from '@wevu/web-apis'
import { EventSourcePolyfill, MessageEventPolyfill } from '@wevu/web-apis/eventsource'
import { ReadableStream, ReadableStreamPolyfill, TextDecoderStreamPolyfill, TransformStreamPolyfill, WritableStreamPolyfill } from '@wevu/web-apis/streams'
import { expectAssignable, expectType } from 'tsd'

expectAssignable<WeappInjectWebRuntimeGlobalsTarget>('EventSource')
expectAssignable<WeappInjectWebRuntimeGlobalsTarget>('TextDecoderStream')
expectType<ReadableStream<Uint8Array<ArrayBuffer>> | null>(new ResponsePolyfill(new ReadableStream<Uint8Array>()).body)
expectType<ReadableStream<Uint8Array>>(new ReadableStreamPolyfill<Uint8Array>())
expectType<WritableStream<string>>(new WritableStreamPolyfill<string>())
expectType<TransformStream<string, number>>(new TransformStreamPolyfill<string, number>())
expectType<ReadableStream<string>>(new TextDecoderStreamPolyfill().readable)
expectType<WritableStream<BufferSource>>(new TextDecoderStreamPolyfill().writable)
expectType<string>(new TextDecoderPolyfill('utf-8', { fatal: true }).decode(new Uint8Array(), { stream: true }))
const source = new EventSourcePolyfill('https://stream.test')
expectType<number>(source.readyState)
expectType<string>(source.url)
expectType<void>(source.close())
source.onmessage = (event) => {
  expectType<string>(event.data)
  expectType<string>(event.lastEventId)
}
expectType<string>(new MessageEventPolyfill('message', { data: 'value' }).data)
