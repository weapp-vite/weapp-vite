import { copyFile, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { loadConfigFromFile } from 'vite'
import { expect, it } from 'vitest'

it('loads the library config before unrelated workspace projects have generated their tsconfigs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'json-render-config-'))
  const project = path.join(root, 'packages-runtime', 'json-render-components')
  const repo = path.resolve(import.meta.dirname, '../..')
  try {
    await mkdir(project, { recursive: true })
    await copyFile(path.join(repo, 'tsconfig.base.json'), path.join(root, 'tsconfig.base.json'))
    await writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
      extends: './tsconfig.base.json',
      references: [{ path: './apps/unprepared/.weapp-vite/tsconfig.shared.json' }],
      files: [],
    }))
    // 保留包级依赖边界，配置加载不能依赖根目录的隐式依赖提升。
    await symlink(path.join(import.meta.dirname, 'node_modules'), path.join(project, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    for (const file of ['package.json', 'tsconfig.json', 'weapp-vite.config.ts']) {
      await copyFile(path.join(import.meta.dirname, file), path.join(project, file))
    }
    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      path.join(project, 'weapp-vite.config.ts'),
      project,
      'silent',
      undefined,
      'runner',
    )
    expect(loaded?.config).toMatchObject({
      weapp: { lib: { entry: ['renderer/index.vue', 'fallback/index.js'], outDir: 'dist/miniprogram' } },
    })
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
