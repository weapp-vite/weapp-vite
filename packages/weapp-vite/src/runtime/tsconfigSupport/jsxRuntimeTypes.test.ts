import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isWevuJsxRuntimeTypePackage } from './jsxSources'

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')

describe('Wevu jsx-runtime type packages', () => {
  it('treats Wevu JSX subpaths as invalid compilerOptions.types entries', () => {
    expect(isWevuJsxRuntimeTypePackage('wevu/weapp/jsx-runtime')).toBe(true)
    expect(isWevuJsxRuntimeTypePackage('wevu/alipay/jsx-runtime')).toBe(true)
    expect(isWevuJsxRuntimeTypePackage('wevu/tt/jsx-runtime')).toBe(true)
    expect(isWevuJsxRuntimeTypePackage('wevu/miniprogram/jsx-runtime')).toBe(true)
    expect(isWevuJsxRuntimeTypePackage('wevu/jsx-runtime')).toBe(true)
    expect(isWevuJsxRuntimeTypePackage('weapp-vite/client')).toBe(false)
    expect(isWevuJsxRuntimeTypePackage('miniprogram-api-typings')).toBe(false)
    expect(isWevuJsxRuntimeTypePackage('react/jsx-runtime')).toBe(false)
  })

  it('reports TS2688 when compilerOptions.types points at a Wevu JSX subpath', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'wevu-jsx-runtime-types-'))
    await mkdir(path.join(root, 'src'), { recursive: true })
    await writeFile(path.join(root, 'src/app.tsx'), 'export const n = <view class="x" />\n')
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        jsx: 'preserve',
        jsxImportSource: 'wevu/weapp',
        module: 'ESNext',
        moduleResolution: 'bundler',
        noEmit: true,
        strict: true,
        types: ['wevu/weapp/jsx-runtime'],
      },
      include: ['src/app.tsx'],
    }, null, 2))

    const withTypes = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json', '--pretty', 'false'], {
      encoding: 'utf8',
      cwd: root,
    })
    expect(withTypes.status).not.toBe(0)
    expect(`${withTypes.stdout}${withTypes.stderr}`).toContain('Cannot find type definition file for \'wevu/weapp/jsx-runtime\'')

    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        jsx: 'preserve',
        jsxImportSource: 'wevu/weapp',
        module: 'ESNext',
        moduleResolution: 'bundler',
        noEmit: true,
        strict: true,
        types: [],
      },
      include: ['src/app.tsx'],
    }, null, 2))

    const withoutTypes = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json', '--pretty', 'false'], {
      encoding: 'utf8',
      cwd: root,
    })
    expect(`${withoutTypes.stdout}${withoutTypes.stderr}`).not.toContain('Cannot find type definition file for \'wevu/weapp/jsx-runtime\'')
  })
})
