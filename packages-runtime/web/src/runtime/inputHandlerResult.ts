interface NativeInputEventState {
  target: Element
  value?: string
}

const nativeInputEventStates = new WeakMap<Event, NativeInputEventState>()

export function dispatchNativeInputEvent<T>(target: Element, detail: T) {
  const event = new CustomEvent<T>('input', {
    bubbles: true,
    composed: true,
    detail,
  })
  const state: NativeInputEventState = { target }
  nativeInputEventStates.set(event, state)
  target.dispatchEvent(event)
  return state.value
}

export function invokeMiniProgramEventHandler(
  handler: (event: unknown) => unknown,
  instance: unknown,
  syntheticEvent: unknown,
  nativeEvent: Event,
) {
  const result = handler.call(instance, syntheticEvent)
  const state = nativeEvent.type === 'input'
    ? nativeInputEventStates.get(nativeEvent)
    : undefined
  if (state?.target === nativeEvent.currentTarget && typeof result === 'string') {
    state.value = result
  }
}
