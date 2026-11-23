import type { Plugin, UserConfig } from 'vite'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../../vite'
import { createSubpackageOutputFixture } from './nativeFixture'

it.each([
  { assetDirectory: undefined, expectedDirectory: '.' },
  { assetDirectory: 'assets', expectedDirectory: 'packages/feature/assets' },
])('applies assetsDir to owned files and preserves fixed page entries: $expectedDirectory', async ({ assetDirectory, expectedDirectory }) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [main, feature] = fixture.routes
    await writeFile(path.join(fixture.root, 'src', `${main}.js`), 'Page({})')
    await writeFile(path.join(fixture.root, 'src', `${main}.wxss`), '')
    await writeFile(path.join(fixture.root, 'src', `${main}.wxml`), '<view/>')
    const plugin: Plugin = {
      name: 'test:asset-without-source',
      buildStart() {
        this.emitFile({ type: 'asset', name: 'ordinary.txt', source: 'plugin asset' })
      },
    }
    const config: UserConfig = {
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp(), plugin],
      weapp: { srcRoot: 'src', autoRoutes: false, vue: { enable: false }, npm: { enable: false } },
      build: { ...(assetDirectory === undefined ? {} : { assetsDir: assetDirectory }), assetsInlineLimit: 0, minify: false },
    }
    await build(config)
    const dist = path.join(fixture.root, 'dist')
    const files = (await readdir(dist, { recursive: true })).map(file => path.normalize(file))
    const read = (file: string) => readFile(path.join(dist, file), 'utf8')
    const [image] = files.filter(file => file.endsWith('.png'))
    expect(files.filter(file => file.endsWith('.png'))).toHaveLength(1)
    expect(path.dirname(image!)).toBe(expectedDirectory)
    expect(await read(`${feature}.js`)).toContain(`/${image}`)
    expect(await read(`${feature}.wxss`)).toContain(`/${image}`)
    const [ordinary] = files.filter(file => /(?:^|\/)ordinary-[^/]+\.txt$/.test(file))
    expect(path.dirname(ordinary!)).toBe(assetDirectory ?? '.')
    expect(await read(ordinary!)).toBe('plugin asset')
    expect(JSON.parse(await read('app.json')) as unknown).toMatchObject({
      pages: [main],
      subPackages: [{ root: 'packages/feature', pages: ['pages/index/index'] }],
    })
    for (const route of fixture.routes) {
      for (const extension of ['js', 'wxml', 'json']) {
        expect(files).toContain(`${route}.${extension}`)
      }
    }
  }
  finally {
    await fixture.close()
  }
})
