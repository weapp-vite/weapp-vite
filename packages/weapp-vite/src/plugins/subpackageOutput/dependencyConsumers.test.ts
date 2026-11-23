import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../../vite'
import { createSubpackageOutputFixture } from './nativeFixture'

it.each([
  { name: 'only by subpackage JS', via: 'js', location: 'subpackage' },
  { name: 'only by subpackage WXSS', via: 'wxss', location: 'subpackage' },
  { name: 'from main JS and subpackage WXSS', via: 'wxss', location: 'main', mainLogo: 'logo.png' },
  { name: 'under separate paths with identical bytes', via: 'wxss', location: 'main', mainLogo: 'other/logo.png' },
  { name: 'with a Rolldown naming callback', via: 'js', location: 'subpackage', customNaming: true },
] as const)('places dependency images used $name', async ({ via, location, ...options }) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [mainRoute, featureRoute] = fixture.routes
    const source = (route: string, ext: string) => path.join(fixture.root, 'src', `${route}.${ext}`)
    const dependency = path.join(fixture.root, 'node_modules/fixture-images')
    await mkdir(dependency)
    const image = path.join(fixture.root, 'src/packages/feature/image.png')
    await mkdir(path.join(dependency, 'other'))
    await writeFile(path.join(dependency, 'package.json'), JSON.stringify({ name: 'fixture-images', exports: { './*': './*' } }))
    await copyFile(image, path.join(dependency, 'logo.png'))
    await copyFile(image, path.join(dependency, 'other/logo.png'))
    for (const route of [mainRoute, featureRoute]) {
      await writeFile(source(route, 'js'), 'Page({})')
      await writeFile(source(route, 'wxss'), '')
    }
    await writeFile(source(featureRoute, via), via === 'js'
      ? 'import image from "fixture-images/logo.png"; Page({ data: { image } })'
      : '.page { background: url("fixture-images/logo.png"); }')
    if ('mainLogo' in options) {
      await writeFile(source(mainRoute, 'js'), `import image from "fixture-images/${options.mainLogo}"; Page({ data: { image } })`)
    }
    const customNaming = 'customNaming' in options
    await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', vue: { enable: false }, autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: {
        assetsDir: customNaming ? 'fallback' : '[subpackage]/assets',
        assetsInlineLimit: 0,
        minify: false,
        manifest: true,
        rolldownOptions: customNaming
          ? { output: { assetFileNames: () => '[subpackage]/managed/[name]-[hash][extname]' } }
          : undefined,
      },
    })
    const dist = path.join(fixture.root, 'dist')
    const files = (await readdir(dist, { recursive: true })).map(file => path.normalize(file))
    const logos = files.filter(file => /\/logo-[^/]+\.png$/.test(file))
    const directory = `${location === 'subpackage' ? 'packages/feature/' : ''}${customNaming ? 'managed' : 'assets'}`
    expect(logos).toEqual([expect.stringMatching(`^${directory}/logo-`)])
    expect(await readFile(path.join(dist, logos[0]!))).toEqual(await readFile(image))
    expect(await readFile(path.join(dist, `${featureRoute}.${via}`), 'utf8')).toContain(`/${logos[0]}`)
    const manifest = JSON.parse(await readFile(path.join(dist, '.vite/manifest.json'), 'utf8')) as Record<string, {
      file: string
      assets?: string[]
    }>
    const referencedFiles = Object.values(manifest).flatMap(item => [item.file, ...item.assets ?? []])
    expect(referencedFiles).toContain(logos[0])
    expect(JSON.stringify(manifest)).not.toContain('weapp-vite-asset-references')
    expect(files.some(file => file.startsWith('weapp-vite-asset-references'))).toBe(false)
    if ('mainLogo' in options) {
      expect(await readFile(path.join(dist, `${mainRoute}.js`), 'utf8')).toContain(`/${logos[0]}`)
    }
  }
  finally {
    await fixture.close()
  }
})
