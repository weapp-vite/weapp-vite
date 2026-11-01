import type { Compiler, CreateCompilerOptions } from '@weapp-vite/tailwindcss'
import { createTailwindController } from '@weapp-vite/tailwindcss'
import { expectType } from 'tsd'
import { createCompiler } from 'weapp-tailwindcss/core'

const options: CreateCompilerOptions = { platform: 'weapp', appType: 'weapp-vite' }
const controller = createTailwindController({
  compiler: options,
  loadCore: async () => ({ createCompiler }),
})
expectType<Promise<Compiler>>(controller.getCompiler())
