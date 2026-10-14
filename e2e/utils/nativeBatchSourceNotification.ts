import { Writable } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'

/** 首个真实侧车通知驱动一次脚本保存，不拦截或延迟宿主 watcher。 */
export function createNativeBatchSourceNotification(onNotification: () => void) {
  const decoder = new StringDecoder('utf8')
  let pending = ''
  let armed = false
  let triggered = false
  const consume = (text: string) => {
    pending += text
    const lines = pending.split(/\r?\n/)
    pending = lines.pop() ?? ''
    for (const line of lines) {
      if (!armed) {
        continue
      }
      const match = line.match(/\[stateful-hmr-snapshot\] (\{.*\})/)
      if (!match) {
        continue
      }
      const event = JSON.parse(match[1]!) as { stage?: unknown, file?: unknown }
      if (event.stage === 'source-change' && typeof event.file === 'string'
        && /^src\/pages\/index\/index\.(?:json|wxss|wxml)$/.test(event.file)) {
        armed = false
        triggered = true
        onNotification()
      }
    }
  }
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      try {
        consume(decoder.write(chunk))
        callback()
      }
      catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)))
      }
    },
    final(callback) {
      try {
        consume(`${decoder.end()}\n`)
        callback()
      }
      catch (error) {
        callback(error instanceof Error ? error : new Error(String(error)))
      }
    },
  })
  return {
    stream,
    get triggered() { return triggered },
    arm() {
      armed = true
      triggered = false
    },
    disarm() { armed = false },
  }
}
