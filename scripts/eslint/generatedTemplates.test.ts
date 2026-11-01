import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))

describe.each([
  ['repository', '.'],
  ['scaffold package', 'packages/create-weapp-vite'],
])('generated template lint ownership from %s', (_label, directory) => {
  it('excludes publication assets while retaining their source and generation configuration', async () => {
    const eslint = new ESLint({ cwd: path.join(repositoryRoot, directory), errorOnUnmatchedPattern: false })
    const repositoryEslint = new ESLint({ cwd: repositoryRoot, overrideConfigFile: path.join(repositoryRoot, 'eslint.config.js') })

    // 原生副本含消费者 ESLint 配置；从目录遍历核对仓库入口在查找子配置前排除产物。
    await expect(eslint.lintFiles([path.join(repositoryRoot, 'packages/create-weapp-vite/templates')])).resolves.toEqual([])

    for (const file of [
      'packages/create-weapp-vite/templates/default/src/app.ts',
      'packages/create-weapp-vite/templates/vite-plus/default/package.json',
      'packages/create-weapp-vite/templates/vite-plus/default/vite.config.ts',
      'packages/create-weapp-vite/templates/vite-plus/wevu/src/app.vue',
    ]) {
      await expect(repositoryEslint.isPathIgnored(path.join(repositoryRoot, file)), file).resolves.toBe(true)
    }

    for (const file of [
      'templates/weapp-vite-template/src/app.ts',
      'templates/weapp-vite-template/weapp-vite.config.ts',
      'packages/create-weapp-vite/src/templates/prepared.ts',
      'packages/create-weapp-vite/src/toolchain/quality.ts',
      'packages/create-weapp-vite/scripts/prepare-templates.ts',
    ]) {
      await expect(repositoryEslint.isPathIgnored(path.join(repositoryRoot, file)), file).resolves.toBe(false)
    }
  }, 30_000)
})
