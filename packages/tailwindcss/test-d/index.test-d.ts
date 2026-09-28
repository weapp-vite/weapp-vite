import type { HmrCompilerPreparation } from '@weapp-vite/hmr'
import type { Compiler, CompilerSnapshot } from '@weapp-vite/tailwindcss'
import { createTailwindController, createTailwindPreparation } from '@weapp-vite/tailwindcss'
import { expectType } from 'tsd'

export async function verifyPublicTypes() {
  const controller = createTailwindController({ compiler: { platform: 'weapp', appType: 'weapp-vite' } })
  expectType<Promise<Compiler>>(controller.getCompiler())
  const compiler = await controller.getCompiler()
  const snapshot: CompilerSnapshot = compiler.createSnapshot({ id: 'shared', classSet: ['py-5.5'] })
  expectType<HmrCompilerPreparation>(createTailwindPreparation(compiler, snapshot))
  expectType<Promise<void>>(controller.dispose())
}
