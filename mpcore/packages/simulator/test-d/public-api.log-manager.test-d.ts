import type { HeadlessWx, HeadlessWxGetLogManagerOption, HeadlessWxLogManager } from '..'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'

declare const wx: HeadlessWx
const manager = wx.getLogManager({ level: 1 })
expectType<HeadlessWxLogManager>(manager)
expectType<HeadlessWxLogManager>(wx.getLogManager())
expectType<void>(manager.debug('debug', { details: true }))
expectType<void>(manager.info('info', 1))
expectType<void>(manager.log('log', null))
expectType<void>(manager.warn('warn', ['details']))
expectAssignable<HeadlessWxGetLogManagerOption>({ level: 0 })
expectNotAssignable<HeadlessWxGetLogManagerOption>({ level: 'debug' })
expectNotAssignable<Promise<HeadlessWxLogManager>>(manager)
