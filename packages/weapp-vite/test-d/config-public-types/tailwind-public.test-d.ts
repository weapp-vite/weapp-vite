import type { CreateCompilerOptions } from 'weapp-tailwindcss/core'
import type { WeappTailwindcssOptions, WeappViteConfig } from 'weapp-vite/types'
import { expectAssignable, expectNotAssignable, expectType } from 'tsd'
import { defineConfig } from 'weapp-vite/config'

const tailwind: WeappTailwindcssOptions = {
  cssEntries: ['src/app.css'],
  compiler: {
    maxRoots: 64,
    onRootEvicted(id) {
      expectType<string>(id)
    },
  },
  tailwindcss: {
    v4: {
      cssSources: [{
        css: '@import "tailwindcss" source(none);',
        file: 'src/app.css',
        base: 'src',
        dependencies: ['src/tokens.css'],
      }],
    },
  },
}

const config = defineConfig({ weapp: { tailwindcss: tailwind } })
expectAssignable<WeappViteConfig['tailwindcss']>(config.weapp.tailwindcss)
expectAssignable<CreateCompilerOptions['compiler']>(tailwind.compiler)
expectAssignable<NonNullable<NonNullable<CreateCompilerOptions['tailwindcss']>['v4']>['cssSources']>(tailwind.tailwindcss?.v4?.cssSources)
expectNotAssignable<WeappTailwindcssOptions>({ compiler: { maxRoots: '64' } })
expectNotAssignable<WeappTailwindcssOptions>({ cssEntries: [42] })
