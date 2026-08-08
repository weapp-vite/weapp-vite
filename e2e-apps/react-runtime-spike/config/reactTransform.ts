import { transform } from '@swc/core'
import { transformWithOxc } from 'vite'

export type ReactTransformMode = 'oxc' | 'swc-react-compiler'

export async function transformReactTsx(source: string, filename: string, mode: ReactTransformMode) {
  if (mode === 'oxc') {
    return await transformWithOxc(source, filename, {
      jsx: {
        importSource: 'react',
        runtime: 'automatic',
      },
      lang: 'tsx',
      sourcemap: true,
    })
  }

  const result = await transform(source, {
    filename,
    jsc: {
      parser: {
        syntax: 'typescript',
        tsx: true,
      },
      target: 'es2020',
      transform: {
        react: {
          importSource: 'react',
          runtime: 'automatic',
        },
        reactCompiler: {
          compilationMode: 'infer',
        },
      },
    },
    module: {
      type: 'es6',
    },
    sourceMaps: true,
  })

  return {
    code: result.code,
    map: result.map,
  }
}
