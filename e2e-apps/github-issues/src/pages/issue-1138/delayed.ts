import type { SetDataDebugInfo } from 'wevu'
import { createApp, nextTick } from 'wevu'

const events: SetDataDebugInfo[] = []
let delayed = false
let queueDrained = false
let release: (() => void) | undefined
const app = createApp({
  data: () => ({ count: 0 }),
  setData: {
    debugPhases: true,
    debugWhen: 'always',
    debug(info) {
      if (info.phase) {
        events.push(info)
      }
    },
  },
})
let runtime: ReturnType<typeof app.mount> | undefined

Page({
  data: { count: 0 },
  onLoad() {
    delayed = false
    queueDrained = false
    release = undefined
    events.length = 0
    runtime = app.mount({
      setData: payload => new Promise<void>((resolve) => {
        this.setData(payload, () => {
          if (delayed) {
            release = resolve
          }
          else { resolve() }
        })
      }),
    })
  },
  onUnload() {
    runtime?.unmount()
    runtime = undefined
    release = undefined
  },
  async _beginE2E() {
    events.length = 0
    delayed = true
    queueDrained = false
    if (runtime) {
      runtime.state.count = 1
    }
    await nextTick()
    queueDrained = true
    return { events, queueDrained }
  },
  _readE2E() {
    return { events, queueDrained, nativeCallbackCompleted: Boolean(release) }
  },
  async _releaseE2E() {
    release?.()
    release = undefined
    await nextTick()
    return events
  },
})
