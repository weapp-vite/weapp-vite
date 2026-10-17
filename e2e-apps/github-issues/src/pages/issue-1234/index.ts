interface TouchPoint {
  identifier?: number
  pageX?: number
  pageY?: number
  clientX?: number
  clientY?: number
}

interface TouchEvent {
  type: string
  touches?: TouchPoint[]
  changedTouches?: TouchPoint[]
  target?: { id?: string, dataset?: Record<string, unknown> }
  currentTarget?: { id?: string, dataset?: Record<string, unknown> }
}

interface RecordedTouchEvent {
  type: string
  touches: TouchPoint[]
  changedTouches: TouchPoint[]
  target: string
  currentTarget: string
}

function readTouches(touches: TouchPoint[] = []) {
  return touches.map(({ identifier, pageX, pageY, clientX, clientY }) => ({ identifier, pageX, pageY, clientX, clientY }))
}

Page({
  data: {
    events: [] as RecordedTouchEvent[],
    eventLog: '[]',
  },
  recordTouch(event: TouchEvent) {
    const events = [...this.data.events, {
      type: event.type,
      touches: readTouches(event.touches),
      changedTouches: readTouches(event.changedTouches),
      target: event.target?.id ?? '',
      currentTarget: event.currentTarget?.id ?? '',
    }]
    this.setData({ events, eventLog: JSON.stringify(events) })
  },
})
