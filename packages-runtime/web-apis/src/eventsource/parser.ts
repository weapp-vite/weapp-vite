export interface ServerSentEvent {
  type: string
  data: string
  lastEventId: string
}

interface ParserCallbacks {
  onEvent: (event: ServerSentEvent) => void
  onId: (id: string) => void
  onRetry: (delay: number) => void
}

/** 增量解析事件流；仅空行提交事件，连接结束时丢弃未完成的数据。 */
export class EventStreamParser {
  private fragments: string[] = []
  private data: string[] = []
  private eventType = ''
  private lastEventId: string
  private firstCharacter = true
  private skipLf = false

  constructor(private readonly callbacks: ParserCallbacks, lastEventId = '') {
    this.lastEventId = lastEventId
  }

  feed(chunk: string) {
    let start = 0
    if (this.firstCharacter && chunk.length > 0) {
      this.firstCharacter = false
      if (chunk.charCodeAt(0) === 0xFEFF) {
        start = 1
      }
    }

    for (let index = start; index < chunk.length; index++) {
      const code = chunk.charCodeAt(index)
      if (this.skipLf) {
        this.skipLf = false
        if (code === 10) {
          start = index + 1
          continue
        }
      }
      if (code !== 10 && code !== 13) {
        continue
      }
      this.fragments.push(chunk.slice(start, index))
      const line = this.fragments.join('')
      this.fragments = []
      start = index + 1
      this.skipLf = code === 13
      this.line(line)
    }
    if (start < chunk.length) {
      this.fragments.push(chunk.slice(start))
    }
  }

  private line(line: string) {
    if (line === '') {
      this.callbacks.onId(this.lastEventId)
      const event = this.data.length > 0
        ? { type: this.eventType || 'message', data: this.data.join('\n'), lastEventId: this.lastEventId }
        : null
      this.data = []
      this.eventType = ''
      if (event) {
        this.callbacks.onEvent(event)
      }
      return
    }
    if (line.startsWith(':')) {
      return
    }
    const separator = line.indexOf(':')
    const field = separator === -1 ? line : line.slice(0, separator)
    let value = separator === -1 ? '' : line.slice(separator + 1)
    if (value.startsWith(' ')) {
      value = value.slice(1)
    }
    switch (field) {
      case 'data':
        this.data.push(value)
        break
      case 'event':
        this.eventType = value
        break
      case 'id':
        if (!value.includes('\0')) {
          this.lastEventId = value
        }
        break
      case 'retry':
        if (/^\d+$/.test(value)) {
          const delay = Number(value)
          if (Number.isFinite(delay)) {
            this.callbacks.onRetry(Math.min(delay, 2147483647))
          }
        }
    }
  }
}
