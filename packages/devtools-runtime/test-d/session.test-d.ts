import type { AutomatorMiniProgram, DevtoolsRuntimeHooks } from '@weapp-vite/devtools-runtime'
import { closeOwnedSharedMiniProgram, closeSharedMiniProgram, releaseSharedMiniProgram, releaseSharedMiniProgramByKey, withMiniProgram } from '@weapp-vite/devtools-runtime'
import { expectType } from 'tsd'

declare const program: AutomatorMiniProgram
declare const hooks: DevtoolsRuntimeHooks
expectType<Promise<void>>(program.disconnect())
expectType<Promise<void>>(releaseSharedMiniProgram('project'))
expectType<Promise<void>>(releaseSharedMiniProgramByKey('session-key'))
expectType<Promise<void>>(closeSharedMiniProgram('project'))
expectType<Promise<void>>(closeOwnedSharedMiniProgram({ projectPath: 'project' }, program))
expectType<Promise<string>>(withMiniProgram(hooks, { projectPath: 'project' }, async () => 'result'))
