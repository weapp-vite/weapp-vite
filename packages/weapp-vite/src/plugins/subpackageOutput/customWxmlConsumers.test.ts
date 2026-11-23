import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../../vite'
import { createSubpackageOutputFixture } from './nativeFixture'
import { waitForAssetBuild } from './watchFixture'

it('uses the transformed WXML image consumers for automatic sharing on each watch generation', async () => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [main, feature] = fixture.routes
    const source = (file: string) => path.join(fixture.root, 'src', file)
    await writeFile(source(`${main}.js`), 'Page({})')
    await writeFile(source(`${main}.wxml`), '<view id="image-container"/>')
    await writeFile(source(`${main}.wxss`), '')
    const dependency = 'use-image.txt'
    const dependencyPath = path.join(fixture.root, dependency)
    await writeFile(dependencyPath, 'off')
    let mainTransforms = 0
    const watcher = await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: {
        srcRoot: 'src',
        vue: { enable: false },
        autoRoutes: false,
        autoImport: false,
        autoImportComponents: false,
        npm: { enable: false },
        wxml: {
          async transform(code, context) {
            if (context.fileName !== `${main}.wxml`) {
              return
            }
            mainTransforms++
            context.addWatchFile(dependency)
            if (await readFile(dependencyPath, 'utf8') !== 'on') {
              return
            }
            return code.replace('<view id="image-container"/>', '<image src="/packages/feature/image.png"/>')
          },
        },
      },
      build: { watch: {}, assetsDir: '[subpackage]/assets', assetsInlineLimit: 0 },
    })
    if (!('on' in watcher)) {
      throw new Error('Expected a watch build')
    }
    try {
      const dist = path.join(fixture.root, 'dist')
      const template = () => readFile(path.join(dist, `${main}.wxml`), 'utf8')
      const imageFiles = async () => (await readdir(dist, { recursive: true })).map(file => path.normalize(file)).filter(file => /(?:^|\/)image(?:-[^/]+)?\.png$/.test(file))
      const style = () => readFile(path.join(dist, `${feature}.wxss`), 'utf8')
      await waitForAssetBuild(watcher, async () => (await template()).includes('image-container'))
      const initial = await imageFiles()
      expect(initial).toEqual([expect.stringMatching(/^packages\/feature\/assets\/image-/)])
      expect(await style()).toContain(`/${initial[0]}`)
      expect(mainTransforms).toBe(1)

      await waitForAssetBuild(watcher, async () => (await template()).includes('<image '), () => writeFile(dependencyPath, 'on'))
      const shared = await imageFiles()
      expect(shared).toEqual([expect.stringMatching(/^assets\/image-/)])
      expect(await template()).toContain(`src="/${shared[0]}"`)
      expect(await style()).toContain(`/${shared[0]}`)
      expect(mainTransforms).toBe(2)

      await waitForAssetBuild(watcher, async () => (await template()).includes('image-container'), () => writeFile(dependencyPath, 'off'))
      expect(await imageFiles()).toEqual(initial)
      expect(await style()).toContain(`/${initial[0]}`)
      expect(mainTransforms).toBe(3)
    }
    finally {
      await watcher.close()
    }
  }
  finally {
    await fixture.close()
  }
}, 30_000)
