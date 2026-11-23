import { readFileSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../../vite'
import { createSubpackageOutputFixture } from './nativeFixture'

function readPageImage(dist: string, route: string) {
  let image: string | undefined
  const modules = new Map<string, { exports: unknown }>()
  function load(file: string) {
    const existing = modules.get(file)
    if (existing) {
      return existing.exports
    }
    const module = { exports: {} }
    modules.set(file, module)
    runInNewContext(readFileSync(file, 'utf8'), {
      module,
      exports: module.exports,
      require: (specifier: string) => load(path.resolve(path.dirname(file), specifier)),
      Page: (config: { data: { image: string } }) => {
        image = config.data.image
      },
    }, { filename: file })
    return module.exports
  }
  load(path.join(dist, `${route}.js`))
  return image
}

it.each([
  { name: 'main JS and subpackage JS/WXSS', mainConsumer: 'js' },
  { name: 'main WXML and subpackage JS/WXSS', mainConsumer: 'wxml' },
  { name: 'only main JS', mainConsumer: 'js', mainOnly: true },
  { name: 'two ordinary subpackages', mainConsumer: 'js', anotherSubpackage: true },
] as const)('emits one main-package image for $name', async ({ mainConsumer, ...options }) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [mainRoute, featureRoute] = fixture.routes
    const source = (route: string, ext: string) => path.join(fixture.root, 'src', `${route}.${ext}`)
    const secondRoute = 'packages/another/detail/index'
    if ('anotherSubpackage' in options) {
      await writeFile(path.join(fixture.root, 'src/app.json'), JSON.stringify({
        pages: [mainRoute],
        subPackages: [
          { root: 'packages/feature', pages: ['pages/index/index'] },
          { root: 'packages/another', pages: ['detail/index'] },
        ],
      }))
      await writeFile(path.join(fixture.root, 'project.private.config.json'), JSON.stringify({ condition: { miniprogram: {
        list: [...fixture.routes, secondRoute].map(route => ({ name: route, pathName: route, query: '' })),
      } } }))
      await mkdir(path.dirname(source(secondRoute, 'js')), { recursive: true })
      await writeFile(source(secondRoute, 'js'), 'import image from "../../feature/image.png"; Page({ data: { image } })')
      await writeFile(source(secondRoute, 'json'), '{}')
      await writeFile(source(secondRoute, 'wxml'), '<image src="{{image}}"/>')
      await writeFile(source(mainRoute, 'js'), 'Page({})')
      await writeFile(source(mainRoute, 'wxml'), '<view/>')
    }
    if ('mainOnly' in options) {
      await writeFile(source(featureRoute, 'js'), 'Page({})')
      await writeFile(source(featureRoute, 'wxss'), '')
      await writeFile(source(featureRoute, 'wxml'), '<view/>')
    }
    await writeFile(source(mainRoute, 'wxss'), '')
    if (mainConsumer === 'wxml') {
      await writeFile(source(mainRoute, 'js'), 'Page({})')
      await writeFile(source(mainRoute, 'wxml'), '<image src="../../packages/feature/image.png"/>')
    }
    await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: { assetsDir: '[subpackage]/assets', assetsInlineLimit: 0, minify: false },
    })
    const dist = path.join(fixture.root, 'dist')
    const files = (await readdir(dist, { recursive: true })).map(file => path.normalize(file))
    const images = files.filter(file => /(?:^|\/)image(?:-[^/]+)?\.png$/.test(file))
    expect(images).toEqual([expect.stringMatching(/^assets\/image-[^/]+\.png$/)])
    if ('anotherSubpackage' in options) {
      expect(readPageImage(dist, secondRoute)).toBe(`/${images[0]}`)
    }
    else if (mainConsumer === 'js') {
      expect(readPageImage(dist, mainRoute)).toBe(`/${images[0]}`)
    }
    else {
      expect(await readFile(path.join(dist, `${mainRoute}.wxml`), 'utf8')).toContain(`src="/${images[0]}"`)
    }
    if (!('mainOnly' in options)) {
      expect(readPageImage(dist, featureRoute)).toBe(`/${images[0]}`)
      expect(await readFile(path.join(dist, `${featureRoute}.wxss`), 'utf8')).toContain(`/${images[0]}`)
    }
  }
  finally {
    await fixture.close()
  }
})

it.each(['wxml', 'mixed'] as const)('promotes identical images at different paths with %s consumers', async (kind) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [main, feature] = fixture.routes
    const source = (file: string) => path.join(fixture.root, 'src', file)
    await copyFile(source('packages/feature/image.png'), source('image.png'))
    for (const [route, src] of [[main, '/image.png'], [feature, '../../image.png']] as const) {
      await writeFile(source(`${route}.js`), 'Page({})')
      const style = route === feature && kind === 'mixed'
      await writeFile(source(`${route}.wxss`), style ? `.page { background: url("${src}"); }` : '')
      await writeFile(source(`${route}.wxml`), style ? '<view class="page"/>' : `<image src="${src}"/>`)
    }
    await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: { assetsDir: '[subpackage]/assets', assetsInlineLimit: 0 },
    })
    const dist = path.join(fixture.root, 'dist')
    const files = (await readdir(dist, { recursive: true })).map(file => path.normalize(file))
    const images = files.filter(file => /(?:^|\/)image(?:-[^/]+)?\.png$/.test(file))
    expect(images).toEqual([expect.stringMatching(/^assets\/image-[^/]+\.png$/)])
    for (const route of fixture.routes) {
      const style = route === feature && kind === 'mixed'
      expect(await readFile(path.join(dist, `${route}.${style ? 'wxss' : 'wxml'}`), 'utf8')).toContain(`/${images[0]}`)
    }
  }
  finally {
    await fixture.close()
  }
})
