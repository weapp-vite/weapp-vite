import type { DevtoolsRuntimeHooks, DevtoolsRuntimeSessionOptions } from '@weapp-vite/devtools-runtime'
import { closeSharedMiniProgram, resolveSharedMiniProgramSessionKey } from '@weapp-vite/devtools-runtime'
import { expectAssignable, expectType } from 'tsd'

expectAssignable<DevtoolsRuntimeSessionOptions>({ projectPath: 'fixture', cliPath: 'cli', installationId: 'stable' })
expectAssignable<DevtoolsRuntimeHooks>({
  resolveSessionOptions: async options => ({ ...options, installationId: 'stable' }),
  connectMiniProgram: async () => { throw new Error('test contract') },
})
expectType<string>(resolveSharedMiniProgramSessionKey({ projectPath: 'fixture', installationId: 'stable' }))
expectType<Promise<void>>(closeSharedMiniProgram('fixture', undefined, { installationId: 'stable', port: 19510 }))
