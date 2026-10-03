import { bindRuntimeEvent } from '@weapp-vite/web'
import { expectAssignable, expectError } from 'tsd'

const listener: EventListener = (event) => {
  expectAssignable<Event>(event)
}

bindRuntimeEvent('onReady', listener, { capture: true })
bindRuntimeEvent('tap', listener)
expectError(bindRuntimeEvent('click', listener, { capture: 'true' }))
expectError(bindRuntimeEvent('click', 'handleClick'))
