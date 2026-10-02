import { bindRuntimeEvent } from '@weapp-vite/web'
import { expectAssignable, expectError } from 'tsd'

const listener: EventListener = (event) => {
  expectAssignable<Event>(event)
}

bindRuntimeEvent('onReady', listener, { component: true, capture: true })
bindRuntimeEvent('click', listener, { component: true, alias: 'tap' })
expectError(bindRuntimeEvent('click', listener, { component: 'true' }))
expectError(bindRuntimeEvent('click', listener, { alias: true }))
