import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it, vi } from 'vitest'
import { compileVueFile, getMiniProgramTemplatePlatform } from 'wevu/compiler'
import { prepareAutoImportHmrBaselines, resolveAutoImportHmrCompiler } from './hmrBaseline'

// 单测沿用包测试的源码编译器映射；真实 CLI 冒烟核验被测 checkout 的构建入口。
vi.mock('../../../../packages-runtime/wevu/dist/compiler.mjs', async () => import('wevu/compiler'))

const workspaceRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const weappViteDir = path.join(workspaceRoot, 'packages/weapp-vite')
const source = '<template><view class="baseline"><van-button data-bench="component" /></view></template>'

async function compileInitialOutput() {
  const compiled = await compileVueFile(source, path.join(workspaceRoot, 'src/pages/reference/index.vue'), {
    isPage: true,
    stabilizeCssVarsRuntime: true,
    template: { platform: getMiniProgramTemplatePlatform('weapp'), formatWxml: true, preserveComments: true },
  })
  expect(compiled.template).toBeTypeOf('string')
  return compiled.template!
}

it('freezes exact mode-specific references from the measured public compiler before any mutation', async () => {
  const initialOutput = await compileInitialOutput()
  const baseline = await prepareAutoImportHmrBaselines({
    workspaceRoot,
    weappViteDir,
    source,
    filename: path.join(workspaceRoot, 'src/pages/reference/index.vue'),
    initialOutput,
    initialRuntime: 'stateful-experimental',
  })
  expect(baseline.initial).toBe(initialOutput)
  expect(baseline.classic).toBe('<view class="baseline">\n  <van-button data-bench="component" />\n</view>\n')
  expect(baseline.evidence.initial.sha256).not.toBe(baseline.evidence.classic.sha256)
  expect(baseline.evidence.source.sha256).toMatch(/^[a-f\d]{64}$/)
  expect(baseline.evidence.initialOutputExactlyVerified).toBe(true)
  expect(baseline.evidence.frozenBeforeFirstMutation).toBe(true)
  expect(path.isAbsolute(baseline.evidence.compiler.entry)).toBe(false)
  expect(JSON.stringify(baseline.evidence)).not.toContain(workspaceRoot)
})

it('rejects a reference that cannot exactly reproduce the real initial output', async () => {
  const initialOutput = await compileInitialOutput()
  await expect(prepareAutoImportHmrBaselines({
    workspaceRoot,
    weappViteDir,
    source,
    filename: path.join(workspaceRoot, 'src/pages/reference/index.vue'),
    initialOutput: initialOutput.replace('data-bench="component"', 'data-bench="different"'),
    initialRuntime: 'stateful-experimental',
  })).rejects.toThrow('does not exactly reproduce the initial emitted template')
})

it.each(['public-package', 'implementation'] as const)('rejects a compiler linked from a different checkout: %s', async (escape) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'auto-import-compiler-'))
  const measured = path.join(root, 'measured')
  const external = path.join(root, 'driver-compiler')
  const viteDir = path.join(measured, 'packages/weapp-vite')
  const packageRoot = path.join(viteDir, 'node_modules/wevu')
  try {
    await mkdir(path.dirname(packageRoot), { recursive: true })
    await mkdir(external)
    if (escape === 'public-package') {
      await symlink(external, packageRoot, 'junction')
    }
    else {
      await mkdir(path.join(packageRoot, 'node_modules/@wevu'), { recursive: true })
      await writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: 'wevu', version: '1.0.0', exports: { './compiler': { import: './compiler.mjs' } }, dependencies: { '@wevu/compiler': '1.0.0' } }))
      await writeFile(path.join(packageRoot, 'compiler.mjs'), 'throw new Error("wrong compiler executed")')
      await symlink(external, path.join(packageRoot, 'node_modules/@wevu/compiler'), 'junction')
    }
    await expect(resolveAutoImportHmrCompiler(measured, viteDir)).rejects.toThrow('must belong to the measured checkout')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
