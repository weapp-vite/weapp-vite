import { readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'pathe'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { weapp } from '../../vite'
import { createSubpackageOutputFixture } from './nativeFixture'

async function installVueFixture(root: string) {
  await symlink(path.resolve(import.meta.dirname, '../../../node_modules/wevu'), path.join(root, 'node_modules/wevu'), 'junction')
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { wevu: '*' } }))
}

it.each([
  ['image', 'src="../../packages/feature/image.png"'],
  ['img', 'src="../../packages/feature/image.png"'],
  ['image', ':src="photo"'],
] as const)('shares a Vue <%s %s> image with a native subpackage stylesheet', async (element, attribute) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [main, feature] = fixture.routes
    const source = (file: string) => path.join(fixture.root, 'src', file)
    await installVueFixture(fixture.root)
    await rm(source(`${main}.js`))
    await rm(source(`${main}.wxml`))
    await writeFile(source(`${main}.wxss`), '')
    const dynamic = attribute.startsWith(':')
    const template = `<template><view><${element} ${attribute}/></view></template>`
    const script = dynamic ? '<script setup>import photo from "@/packages/feature/image.png"</script>' : ''
    await writeFile(source(`${main}.vue`), `${template}${script}`)
    await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: { assetsDir: '[subpackage]/assets', assetsInlineLimit: 0, minify: false },
    })
    const dist = path.join(fixture.root, 'dist')
    const assets = (await readdir(dist, { recursive: true })).map(file => path.normalize(file)).filter(file => /(?:^|\/)image(?:-[^/]+)?\.png$/.test(file))
    expect(assets).toEqual([expect.stringMatching(/^assets\/image-[^/]+\.png$/)])
    const templateOutput = await readFile(path.join(dist, `${main}.wxml`), 'utf8')
    if (dynamic) {
      expect(templateOutput).toMatch(/src="\{\{[^}]+\}\}"/)
      const files = (await readdir(dist, { recursive: true })).filter(file => file.endsWith('.js'))
      const scripts = await Promise.all(files.map(file => readFile(path.join(dist, file), 'utf8')))
      expect(scripts.some(code => code.includes(`/${assets[0]}`))).toBe(true)
    }
    else {
      expect(templateOutput).toContain(`src="/${assets[0]}"`)
    }
    expect(await readFile(path.join(dist, `${feature}.wxss`), 'utf8')).toContain(`/${assets[0]}`)
  }
  finally {
    await fixture.close()
  }
})

it.each([false, true])('keeps Vue style and template images inside an independent subpackage (script import: %s)', async (withImport) => {
  const fixture = await createSubpackageOutputFixture()
  try {
    const [main, feature] = fixture.routes
    const subpackage = 'packages/feature'
    const source = (file: string) => path.join(fixture.root, 'src', file)
    const image = `${subpackage}/image.png`
    const bytes = await readFile(source(image))
    await installVueFixture(fixture.root)
    await writeFile(source('app.json'), JSON.stringify({
      pages: [main],
      subPackages: [{ root: subpackage, pages: ['pages/index/index'], independent: true }],
    }))
    for (const extension of ['js', 'wxml', 'wxss']) {
      await rm(source(`${feature}.${extension}`))
    }
    const dynamic = withImport ? '<image :src="photo"/>' : ''
    const script = withImport ? '<script setup>import photo from "../../image.png"</script>' : ''
    await writeFile(source(`${feature}.vue`), `
      <template><view class="page"><image src="../../image.png"/>${dynamic}</view></template>
      ${script}
      <style scoped>.page { background-image: url('../../image.png'); }</style>
    `)
    await build({
      root: fixture.root,
      configFile: false,
      logLevel: 'silent',
      plugins: [weapp()],
      weapp: { srcRoot: 'src', autoRoutes: false, autoImport: false, autoImportComponents: false, npm: { enable: false } },
      build: { assetsDir: '[subpackage]/assets', assetsInlineLimit: 0, minify: false },
    })
    const dist = path.join(fixture.root, 'dist')
    const files = (await readdir(dist, { recursive: true })).map(file => path.normalize(file))
    const images = files.filter(file => file.endsWith('.png'))
    expect(images.sort()).toEqual([
      expect.stringMatching(/^assets\/image-[^/]+\.png$/),
      expect.stringMatching(/^packages\/feature\/assets\/image-[^/]+\.png$/),
    ])
    const mainImage = images[0]!
    const independentImage = images[1]!
    const read = (file: string) => readFile(path.join(dist, file), 'utf8')
    for (const [route, emitted] of [[main, mainImage], [feature, independentImage]] as const) {
      expect(await readFile(path.join(dist, emitted))).toEqual(bytes)
      expect(await read(`${route}.wxss`)).toContain(`/${emitted}`)
      expect(await read(`${route}.json`)).not.toBe('')
    }
    expect(await read(`${main}.js`)).toContain(`/${mainImage}`)
    expect(await read(`${feature}.wxml`)).toContain(`src="/${independentImage}"`)
    if (withImport) {
      const scripts = await Promise.all(files.filter(file => file.startsWith(`${subpackage}/`) && file.endsWith('.js')).map(read))
      expect(scripts.some(code => code.includes(`/${independentImage}`))).toBe(true)
      expect(scripts.some(code => code.includes(`"/${mainImage}"`) || code.includes(`'/${mainImage}'`))).toBe(false)
    }
  }
  finally {
    await fixture.close()
  }
})
