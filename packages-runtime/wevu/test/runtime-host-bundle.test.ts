import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { createRuntimeHostBundle } from './helpers/runtimeHostBundle'

describe('runtime host bundle configuration', () => {
  it.each([
    ['cold build', true],
    ['warm cache', false],
  ] as const)('uses package aliases independently of unrelated app support files (%s)', async (_, hasSupportFiles) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-runtime-host-'))
    const files = {
      'tsconfig.base.json': JSON.stringify({ compilerOptions: { target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler' } }),
      'tsconfig.json': JSON.stringify({
        extends: './tsconfig.base.json',
        files: [],
        references: [{ path: './apps/unrelated' }, { path: './packages/runtime' }],
      }),
      'apps/unrelated/tsconfig.json': JSON.stringify({ extends: './.weapp-vite/tsconfig.shared.json' }),
      'packages/runtime/tsconfig.json': JSON.stringify({
        extends: '../../tsconfig.base.json',
        compilerOptions: { paths: { '@/*': ['./src/*'] } },
      }),
      'packages/runtime/src/host.ts': 'export const host: string = "package-alias"',
      'packages/runtime/src/runtime/platform.ts': 'export { host } from "@/host"; export const platform = import.meta.env.PLATFORM',
      'packages/runtime/src/runtime/hooks/base.ts': 'export const hook: number = 1',
      'packages/runtime/src/router.ts': 'export const createRouter = () => "router"; export const useRouter = () => "router"',
    }
    try {
      for (const [filename, source] of Object.entries(files)) {
        const file = path.join(root, filename)
        await mkdir(path.dirname(file), { recursive: true })
        await writeFile(file, source)
      }
      if (hasSupportFiles) {
        const supportFile = path.join(root, 'apps/unrelated/.weapp-vite/tsconfig.shared.json')
        await mkdir(path.dirname(supportFile), { recursive: true })
        await writeFile(supportFile, '{}')
      }
      const code = await createRuntimeHostBundle('alipay', path.join(root, 'packages/runtime'))
      const module = { exports: {} as Record<string, unknown> }
      runInNewContext(code, { module, exports: module.exports })
      expect(module.exports).toMatchObject({ host: 'package-alias', platform: 'alipay', hook: 1 })
      expect(module.exports.createRouter).toBeTypeOf('function')
      expect(module.exports.useRouter).toBeTypeOf('function')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
