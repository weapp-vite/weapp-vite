import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../../vite'
import { createSubpackageOutputFixture } from './nativeFixture'

it.each([
  ['same source', false, false],
  ['identical bytes', true, false],
  ['identical bytes in WXML alone', true, true],
] as const)('shares %s among ordinary packages while keeping independent copies', async (_kind, distinctFiles, templateOnly) => {
  const fixture = await createSubpackageOutputFixture()
  const source = (file: string) => path.join(fixture.root, 'src', file)
  const [main, feature] = fixture.routes
  const independentRoots = ['packages/standalone', 'packages/extra/offline']
  const page = 'pages/index/index'
  const independentRoutes = independentRoots.map(root => `${root}/${page}`)
  const routes = [main, feature, ...independentRoutes]
  try {
    await writeFile(source('app.json'), JSON.stringify({
      pages: [main],
      subPackages: [
        { root: 'packages/feature', pages: [page] },
        ...independentRoots.map(root => ({ root, name: `${root.split('/').at(-1)}-entry`, pages: [page], independent: true })),
      ],
    }))
    await writeFile(path.join(fixture.root, 'project.private.config.json'), JSON.stringify({
      condition: { miniprogram: { list: routes.map(route => ({ name: route, pathName: route, query: '' })) } },
    }))
    const shared = 'common/images/shared.png'
    const original = source('packages/feature/image.png')
    const bytes = await readFile(original)
    await rm(original)
    if (!distinctFiles) {
      await mkdir(path.dirname(source(shared)), { recursive: true })
      await writeFile(source(shared), bytes)
    }
    for (const [index, route] of routes.entries()) {
      const routeDir = path.dirname(route)
      await mkdir(source(routeDir), { recursive: true })
      const imported = distinctFiles ? `${routeDir}/copy.png` : shared
      const templateSource = distinctFiles ? `${routeDir}/template.png` : shared
      if (distinctFiles) {
        await writeFile(source(imported), bytes)
        await writeFile(source(templateSource), bytes)
      }
      const specifier = path.relative(routeDir, imported)
      await writeFile(source(`${route}.js`), !templateOnly && index % 2 === 0
        ? `import image from '${specifier.startsWith('.') ? specifier : `./${specifier}`}'; Page({ data: { image } })`
        : 'Page({})')
      await writeFile(source(`${route}.wxss`), templateOnly || index % 2 === 0 ? '' : `.page { background-image: url('${specifier}'); }`)
      await writeFile(source(`${route}.wxml`), templateOnly
        ? `<view><image src="/${templateSource}"/><image src="/${imported}"/></view>`
        : `<image src="/${templateSource}"/>`)
      await writeFile(source(`${route}.json`), '{}')
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
    const emitted = files.filter(file => file.endsWith('.png'))
    expect(emitted.map(file => path.dirname(file)).sort()).toEqual(['assets', ...independentRoots.map(root => `${root}/assets`)].sort())
    const read = (file: string) => readFile(path.join(dist, file), 'utf8')
    for (const [index, route] of routes.entries()) {
      const owner = independentRoots[index - 2]
      const directory = owner ? `${owner}/assets` : 'assets'
      const image = emitted.find(file => path.dirname(file) === directory)!
      expect(path.basename(image)).toMatch(/^.[^-\n\r\u2028\u2029]*-(?:[^\n\r/\u2028\u2029]*\/[^-\n\r\u2028\u2029]*-)*(?:[\n\r\u2028\u2029][^/]*|[^\n\r/\u2028\u2029]+(?:[\n\r\u2028\u2029][^/]*)?)\.png$/)
      expect(await readFile(path.join(dist, image))).toEqual(bytes)
      const template = await read(`${route}.wxml`)
      expect([...template.matchAll(/<image src="([^"]+)"/g)].map(match => match[1]))
        .toEqual(templateOnly ? [`/${image}`, `/${image}`] : [`/${image}`])
      if (!templateOnly) {
        expect(await read(`${route}.${index % 2 === 0 ? 'js' : 'wxss'}`)).toContain(`/${image}`)
      }
      expect(await read(`${route}.json`)).not.toBe('')
    }
  }
  finally {
    await fixture.close()
  }
})

it('does not copy an independent-only WXML image from a shared source directory into the main package', async () => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [main] = fixture.routes
    const independentRoot = 'packages/standalone'
    const independent = `${independentRoot}/pages/index/index`
    const source = (file: string) => path.join(fixture.root, 'src', file)
    const shared = 'common/shared.png'
    const bytes = await readFile(source('packages/feature/image.png'))

    await rm(source('packages/feature/image.png'))
    await mkdir(path.dirname(source(shared)), { recursive: true })
    await writeFile(source(shared), bytes)
    await writeFile(source('app.json'), JSON.stringify({
      pages: [main],
      subPackages: [{ root: independentRoot, pages: ['pages/index/index'], independent: true }],
    }))
    await writeFile(source(`${main}.js`), 'Page({})')
    await writeFile(source(`${main}.wxml`), '<view>main</view>')
    await writeFile(source(`${main}.wxss`), '')
    await mkdir(path.dirname(source(`${independent}.js`)), { recursive: true })
    await writeFile(source(`${independent}.js`), 'Page({})')
    await writeFile(source(`${independent}.json`), '{}')
    await writeFile(source(`${independent}.wxml`), `<image src="/${shared}"/>`)
    await writeFile(source(`${independent}.wxss`), '')

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
    const images = files.filter(file => path.basename(file).startsWith('shared-') && file.endsWith('.png'))
    expect(images).toHaveLength(1)
    expect(path.dirname(images[0]!)).toBe(path.join(independentRoot, 'assets'))
    expect(files).not.toContain(shared)
    expect(await readFile(path.join(dist, `${independent}.wxml`), 'utf8')).toContain(`/${images[0]}`)
  }
  finally {
    await fixture.close()
  }
})
