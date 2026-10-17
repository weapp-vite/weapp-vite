export interface HeadlessTestingTouch {
  identifier?: number
  pageX?: number
  pageY?: number
  clientX?: number
  clientY?: number
}

export interface HeadlessTestingTouchEventInit {
  touches?: HeadlessTestingTouch[]
  changedTouches?: HeadlessTestingTouch[]
  /** @deprecated 请改用与微信事件一致的 changedTouches。 */
  changeTouches?: HeadlessTestingTouch[]
}

export interface HeadlessTestingNodeEventInit extends HeadlessTestingTouchEventInit {
  currentTarget?: { dataset?: Record<string, unknown>, id?: string }
  dataset?: Record<string, unknown>
  detail?: unknown
  id?: string
  mark?: Record<string, unknown>
  target?: { dataset?: Record<string, unknown>, id?: string }
}

export interface HeadlessTestingNodeValueEventInit extends HeadlessTestingNodeEventInit {
  detail?: { value?: string, [key: string]: unknown }
}

export interface HeadlessTestingDispatchEventInit extends HeadlessTestingNodeEventInit {
  eventName: string
  $?: string
}

/** 正确字段优先；复制触点，避免处理器修改调用者持有的数据。 */
export function readTouchEventPayload(event: HeadlessTestingTouchEventInit) {
  const changedTouches = event.changedTouches ?? event.changeTouches
  return {
    ...(event.touches === undefined ? {} : { touches: event.touches.map(touch => ({ ...touch })) }),
    ...(changedTouches === undefined ? {} : { changedTouches: changedTouches.map(touch => ({ ...touch })) }),
  }
}
