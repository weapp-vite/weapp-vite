import { describe, expect, it } from 'vitest'
import tdesignTemplateConfig from '../../../../../../templates/weapp-vite-wevu-tailwindcss-tdesign-template/weapp-vite.config'
import { createNpmPackageFileMatcher } from './packageFiles'

describe('npm package file matcher', () => {
  it('includes only configured package files', () => {
    const matches = createNpmPackageFileMatcher({
      include: ['dialog/**', 'common/**/*.js'],
    })

    expect(matches('dialog/index.js')).toBe(true)
    expect(matches('common/utils.js')).toBe(true)
    expect(matches('button/index.js')).toBe(false)
  })

  it('applies excludes after includes', () => {
    const matches = createNpmPackageFileMatcher({
      include: ['dialog/**'],
      exclude: ['**/*.d.ts'],
    })

    expect(matches('dialog/index.js')).toBe(true)
    expect(matches('dialog/index.d.ts')).toBe(false)
  })

  it('normalizes Windows path separators', () => {
    const matches = createNpmPackageFileMatcher({
      include: ['dialog/**'],
    })

    expect(matches('dialog\\index.js')).toBe(true)
  })

  it('keeps the TDesign template button transitive runtime dependencies while excluding declarations', () => {
    const matches = createNpmPackageFileMatcher(tdesignTemplateConfig.weapp.npm.packageFiles['tdesign-miniprogram'])

    for (const file of [
      'button/index.js',
      'button/props.js',
      'button/type.js',
      'button/button.js',
      'mixins/using-config.js',
      'config-provider/use-config.js',
      'config-provider/config-store.js',
      'config-provider/reactive-state.js',
      'locale/zh_CN.js',
      'miniprogram_npm/dayjs/index.js',
      'miniprogram_npm/dayjs/locale/zh-cn.js',
    ]) {
      expect(matches(file), file).toBe(true)
      expect(matches(file.replace(/\.js$/, '.d.ts')), file).toBe(false)
    }
  })
})
