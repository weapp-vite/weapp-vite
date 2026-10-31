import { describe, expect, it } from 'vitest'
import { createNativeBuildFixture, nativeBuildPlatforms } from './nativeBuilds.mjs'

describe('installed native build fixture contracts', () => {
  it('covers exactly the six supported build platforms', () => {
    expect(nativeBuildPlatforms).toEqual(['weapp', 'alipay', 'tt', 'swan', 'jd', 'xhs'])
  })

  it.each([
    ['weapp', 'wxml', '<wxs src', 'wxs'],
    ['alipay', 'axml', '<import-sjs from', 'sjs'],
    ['tt', 'ttml', '<sjs src', 'sjs'],
    ['swan', 'swan', '<import-sjs src', 'sjs'],
    ['jd', 'jxml', '<wxs src', 'wxs'],
    ['xhs', 'xhsml', '<wxs src', 'wxs'],
  ])('uses the native %s template and module grammar', (platform, extension, tag, script) => {
    const { files, protectedText, nativeInline } = createNativeBuildFixture(platform)
    const page = files[`src/pages/home/index.${extension}`]
    expect(page).toContain(tag)
    expect(page).toContain(`./typed.${script}.ts`)
    expect(page).toContain('./ordinary.js')
    expect(page).toContain(nativeInline)
    expect(page).toContain(protectedText)
    expect(files['vite.config.mts']).toContain('from \'weapp-vite/vite\'')
    expect(files['vite.config.mts']).toContain('from \'vite-plus\'')
    expect(files['vite.config.mts']).toContain(`platform: '${platform}'`)
    expect(files['vite.config.mts']).toContain('root: import.meta.dirname')
  })

  it('separates Baidu Filter JavaScript from SJS and keeps its risky text in the build input', () => {
    const { files, nativeFilter } = createNativeBuildFixture('swan')
    expect(files['src/pages/home/native.filter.js']).toBe(nativeFilter)
    expect(files['src/pages/home/index.swan']).toContain('<filter module="inlineFilter">')
    expect(nativeFilter).toContain('value < 2')
    expect(nativeFilter).toContain('</filter><debug/>')
    expect(files['src/pages/home/typed.filter.ts']).toContain(': string')
  })
})
