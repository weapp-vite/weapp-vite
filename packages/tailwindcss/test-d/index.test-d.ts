import type { HmrCompilerPreparation } from '@weapp-vite/hmr'
import type { Compiler, CompilerGenerateRequest, CompilerGenerateResult, CompilerSnapshot, TailwindRootState } from '@weapp-vite/tailwindcss'
import { copyTailwindGenerationValue, createTailwindController, createTailwindPreparation, prepareTailwindRoots } from '@weapp-vite/tailwindcss'
import { expectType } from 'tsd'

export async function verifyPublicTypes() {
  const controller = createTailwindController({ compiler: { platform: 'weapp', appType: 'weapp-vite' } })
  expectType<Promise<Compiler>>(controller.getCompiler())
  const compiler = await controller.getCompiler()
  const snapshot: CompilerSnapshot = compiler.createSnapshot({ id: 'shared', classSet: ['py-5.5'] })
  expectType<HmrCompilerPreparation>(createTailwindPreparation(compiler, snapshot))
  expectType<{ target: string }>(copyTailwindGenerationValue({ target: 'weapp' }))
  expectType<Promise<Map<'owner', CompilerGenerateResult>>>(prepareTailwindRoots(compiler, { revision: 1, changedFiles: [], sources: new Map() }, new Map<'owner', TailwindRootState>(), {
    cwd: '.',
    sourceId: file => file,
    async captureRequest(key, request) {
      expectType<'owner'>(key)
      expectType<CompilerGenerateRequest>(request)
    },
  }))
  expectType<Promise<void>>(controller.dispose())
}
