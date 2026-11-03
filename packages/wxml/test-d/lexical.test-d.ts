import type { Diagnostic, InterpolationRecovery } from '@weapp-vite/wxml'
import { TemplateLexicalError } from '@weapp-vite/wxml'
import { expectError, expectType } from 'tsd'

const recovery: InterpolationRecovery = { kind: 'interpolation', start: 1, end: 10 }
const error = new TemplateLexicalError(4, '括号不匹配', recovery)
expectType<InterpolationRecovery | undefined>(error.recovery)
expectType<number>(recovery.start)
expectError(recovery.start = 2)
expectError(error.recovery = undefined)

const diagnostic: Diagnostic = { code: 'template/invalid-interpolation', severity: 'error', message: '括号不匹配', start: 4, end: 5, recovery }
expectType<InterpolationRecovery | undefined>(diagnostic.recovery)
expectError(diagnostic.recovery = undefined)
