import { readdir, readFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../../vite'
import { createSubpackageOutputFixture } from './nativeFixture'

it('rejects inaccessible physical assets in a native host and preserves public output references', async () => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const compile = (shared: boolean) => build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: {
        assetsDir: '[subpackage]/assets',
        assetsInlineLimit: 0,
        minify: false,
        rolldownOptions: { output: shared ? { assetFileNames: 'assets/[name]-[hash][extname]' } : {} },
      },
    })
    await expect(compile(false)).rejects.toThrow('跨分包资源')
    await compile(true)
    const files = (await readdir(path.join(fixture.root, 'dist'), { recursive: true })).map(file => path.normalize(file))
    for (const route of fixture.routes) {
      for (const extension of ['js', 'json', 'wxml', 'wxss']) {
        expect(files).toContain(`${route}.${extension}`)
      }
      const css = await readFile(path.join(fixture.root, 'dist', `${route}.wxss`), 'utf8')
      const url = css.match(/url\(["']?([^"')]+)["']?\)/)![1]!
      const target = url.startsWith('/') ? url.slice(1) : path.normalize(path.join(path.dirname(route), url))
      expect(target).toMatch(/^assets\//)
      expect(files).toContain(target)
    }
  }
  finally {
    await fixture.close()
  }
})
