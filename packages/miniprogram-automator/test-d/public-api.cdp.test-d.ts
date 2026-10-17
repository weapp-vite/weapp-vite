import type { CDPCommandOptions, CDPEventListener, CDPSession, IEventOptions, ITouchEventOptions, MiniProgram } from '@weapp-vite/miniprogram-automator'
import { expectError, expectType } from 'tsd'

declare const program: MiniProgram
const cdp: CDPSession = program.CDP()
const options: CDPCommandOptions = { timeout: 1000 }
expectType<Promise<unknown>>(cdp.enable(options))
expectType<Promise<{ result: number }>>(cdp.sendCommand<{ result: number }>('Runtime', 'evaluate', { expression: '1' }, options))
expectType<Promise<any>>(cdp.listProtocol(options))
const listener: CDPEventListener = (_domain, _event, _params) => {}
expectType<() => void>(cdp.onEvent(listener))
expectType<Promise<any>>(program.send('App.CDPListProtocol', {}, options))
expectType<Promise<void>>(program.disconnect())
const touch: ITouchEventOptions = { changedTouches: [{ identifier: 1, pageX: 2 }], changeTouches: [] }
const event: IEventOptions = { ...touch, eventName: 'touchend' }
expectType<ITouchEventOptions>(touch)
expectType<IEventOptions>(event)
expectError(cdp.sendCommand('Runtime', 1))
expectError(cdp.enable({ timeout: '1000' }))
expectError(program.send('Tool.getInfo', {}, { timeout: '1000' }))
