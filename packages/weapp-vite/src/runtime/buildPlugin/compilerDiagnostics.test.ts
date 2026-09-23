import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { expect, it } from 'vitest'
import { createCompilerContext } from '../../createContext'

const DEFINE_CONFIG_IMPORT = path.resolve(import.meta.dirname, '../../config.ts').replace(/\\/g, '/')
const WEAPP_VITE_PACKAGE_ROOT = path.resolve(import.meta.dirname, '../../..')

it('rejects an invalid loop without publishing a page and builds its corrected source', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-invalid-loop-'))
  const pageFile = path.join(root, 'src/pages/index/index.vue')
  const source = '<template><view v-for="item in">{{ item }}</view></template>\n'
    + '<script setup lang="ts">const items = [1, 2]</script>\n'
  const files: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'invalid-loop-build-test', private: true, version: '0.0.0' }),
    'tsconfig.json': JSON.stringify({
      compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'Bundler', skipLibCheck: true },
      include: ['src/**/*.vue'],
    }),
    'project.config.json': JSON.stringify({
      appid: 'wx1234567890abcd',
      compileType: 'miniprogram',
      miniprogramRoot: 'dist/',
      srcMiniprogramRoot: 'src/',
    }),
    'vite.config.ts': `import { defineConfig } from '${DEFINE_CONFIG_IMPORT}'\nexport default defineConfig({ weapp: { srcRoot: 'src' } })\n`,
    'src/app.js': 'App({})\n',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'], window: {} }),
    'src/pages/index/index.vue': source,
  }

  try {
    for (const [relative, content] of Object.entries(files)) {
      const filename = path.join(root, relative)
      await fs.mkdir(path.dirname(filename), { recursive: true })
      await fs.writeFile(filename, content, 'utf8')
    }
    await fs.mkdir(path.join(root, 'node_modules'))
    await fs.symlink(WEAPP_VITE_PACKAGE_ROOT, path.join(root, 'node_modules/weapp-vite'), 'dir')
    const failed = await createCompilerContext({
      key: `${root}:invalid`,
      cwd: root,
      mode: 'production',
      isDev: false,
      syncSupportFiles: false,
    })
    await expect(failed.buildService.build({ skipNpm: true })).rejects.toThrow()
    await expect(fs.readFile(path.join(failed.configService.outDir, 'pages/index/index.wxml')))
      .rejects
      .toMatchObject({ code: 'ENOENT' })

    await fs.writeFile(pageFile, source.replace('item in', 'item of items'), 'utf8')
    const corrected = await createCompilerContext({
      key: `${root}:corrected`,
      cwd: root,
      mode: 'production',
      isDev: false,
      syncSupportFiles: false,
    })
    await corrected.buildService.build({ skipNpm: true })
    const template = await fs.readFile(path.join(corrected.configService.outDir, 'pages/index/index.wxml'), 'utf8')
    expect(template).toMatch(/wx:for="\{\{[^}]+\}\}"/)
    for (const extension of ['js', 'json']) {
      const stat = await fs.stat(path.join(corrected.configService.outDir, `pages/index/index.${extension}`))
      expect(stat.isFile()).toBe(true)
    }
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
