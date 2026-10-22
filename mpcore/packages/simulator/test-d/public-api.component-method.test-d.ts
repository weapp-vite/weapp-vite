import type { HeadlessSession, HeadlessTestingScopeHandle } from '..'
import { expectError, expectType } from 'tsd'

declare const session: HeadlessSession
declare const component: HeadlessTestingScopeHandle

expectType<any>(session.callScopeMethodDirect('component:probe', 'mark', 'component-method'))
expectType<Promise<any>>(component.callMethod('mark', 'component-method'))
expectType<Promise<any>>(component.callMethod('completeWithoutValue'))
expectType<Promise<any>>(component.callMethod('completeAsync', 'async-method'))
expectError(session.callScopeMethodDirect('component:probe', 1))
expectError(component.callMethod(1))
