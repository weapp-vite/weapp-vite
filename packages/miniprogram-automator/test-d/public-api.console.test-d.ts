import type { ConsoleLogOptions, ConsoleRemoteObject, MiniProgram, StructuredConsoleEntry } from '..'
import { expectError, expectType } from 'tsd'

declare const miniProgram: MiniProgram
expectType<Promise<void>>(miniProgram.enableLog())
expectType<Promise<void>>(miniProgram.enableLog(3_000))
expectError(miniProgram.enableLog('3000'))
const options: ConsoleLogOptions = { structured: true }
expectType<Promise<void>>(miniProgram.enableLog(3_000, options))
expectType<Promise<void>>(miniProgram.flushConsole())
expectError(miniProgram.enableLog(3_000, { structured: 'yes' }))
declare const entry: StructuredConsoleEntry
expectType<ConsoleRemoteObject[]>(entry.args)
expectType<string | undefined>(entry.args[0]!.inspectionError)
