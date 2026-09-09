import type { HeadlessSession } from '..'
import { expectError, expectType } from 'tsd'

declare const session: HeadlessSession

expectType<unknown>(session.evaluateRuntime('() => getApp()'))
expectType<number>(session.evaluateRuntime<number>('value => value + 1', [2]))
expectError(session.evaluateRuntime(2))
