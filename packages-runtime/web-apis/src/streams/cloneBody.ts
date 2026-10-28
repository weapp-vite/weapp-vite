import { ReadableStream } from '../streams'
import { copyBodyChunk } from './readBody'

/**
 * Body clone 必须隔离两侧的可变字节；普通对象流的 tee 会共享 Uint8Array 引用。
 * 先转换为字节流，再使用 Streams 原生的字节 tee 保留双分支取消与错误传播。
 */
export function cloneBodyStream(stream: ReadableStream<Uint8Array<ArrayBuffer>>) {
  const reader = stream.getReader()
  const bytes = new ReadableStream({
    type: 'bytes',
    async pull(controller) {
      try {
        while (true) {
          const chunk = await reader.read()
          if (chunk.done) {
            controller.close()
            return
          }
          // enqueue 会转移字节流的 buffer；复制后再入队，避免分离原生产者持有的内存。
          const copy = copyBodyChunk(chunk.value)
          if (copy.byteLength > 0) {
            controller.enqueue(copy)
            return
          }
        }
      }
      catch (error) {
        controller.error(error)
        void reader.cancel(error).catch(() => {})
      }
    },
    cancel: reason => reader.cancel(reason),
  })
  return bytes.tee()
}
