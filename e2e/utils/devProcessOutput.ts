import type { DevProcessOutputStream } from './devProcessTrace'
import { StringDecoder } from 'node:string_decoder'

/** 各流独立解码，终端换行统一为 LF；stdout 前缀只追加，编辑前字符游标不会后退。 */
export function createDevProcessOutput(append: (text: string) => void) {
  const streams = new Map<DevProcessOutputStream, { decoder: StringDecoder, ended: boolean, afterCr: boolean }>()
  const pending: { stream: DevProcessOutputStream, text: string }[] = []
  let active: DevProcessOutputStream | undefined
  let endsWithNewline = true

  const stateFor = (stream: DevProcessOutputStream) => {
    let state = streams.get(stream)
    if (!state) {
      state = { decoder: new StringDecoder('utf8'), ended: false, afterCr: false }
      streams.set(stream, state)
    }
    return state
  }

  const drain = () => {
    while (true) {
      // stderr 的 spinner 可能只有行首 CR 与状态文字，未完片段不能阻塞 stdout 就绪信号。
      const index = active === undefined
        ? pending.findIndex(chunk => chunk.stream !== 'stderr' || chunk.text.includes('\n') || stateFor(chunk.stream).ended)
        : pending.findIndex(chunk => chunk.stream === active)
      if (index < 0 || !pending.length) {
        if (active !== undefined && stateFor(active).ended) {
          active = undefined
          continue
        }
        return
      }
      const chunk = pending.splice(index, 1)[0]!
      if (active === undefined && !endsWithNewline) {
        // 只有流已终结的无换行尾部会到这里；不能把下一条流拼成同一行。
        append('\n')
      }
      const newline = chunk.text.indexOf('\n')
      const text = newline < 0 ? chunk.text : chunk.text.slice(0, newline + 1)
      append(text)
      endsWithNewline = newline >= 0
      active = newline < 0 && !stateFor(chunk.stream).ended ? chunk.stream : undefined
      if (newline >= 0 && newline + 1 < chunk.text.length) {
        pending.unshift({ stream: chunk.stream, text: chunk.text.slice(newline + 1) })
      }
    }
  }

  const enqueue = (stream: DevProcessOutputStream, text: string) => {
    if (text) {
      const previous = pending.find(chunk => chunk.stream === stream)
      if (previous) {
        previous.text += text
      }
      else {
        pending.push({ stream, text })
      }
    }
  }

  const decode = (stream: DevProcessOutputStream, text: string) => {
    if (!text) {
      return ''
    }
    const state = stateFor(stream)
    if (state.afterCr && text.startsWith('\n')) {
      text = text.slice(1)
    }
    state.afterCr = text.endsWith('\r')
    return text.replace(/\r\n?/g, '\n')
  }

  const end = (stream: DevProcessOutputStream) => {
    const state = stateFor(stream)
    if (!state.ended) {
      enqueue(stream, decode(stream, state.decoder.end()))
      state.ended = true
      drain()
    }
  }

  return {
    write(stream: DevProcessOutputStream, chunk: string | Uint8Array) {
      const state = stateFor(stream)
      // 迟到输出仍被 trace 判定为失败，但采集视图继续按新片段分帧，不按已结束尾部交错。
      state.ended = false
      enqueue(stream, decode(stream, typeof chunk === 'string' ? chunk : state.decoder.write(chunk)))
      drain()
    },
    end,
    flush() {
      for (const stream of streams.keys()) {
        end(stream)
      }
    },
  }
}
