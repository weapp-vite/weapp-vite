import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { compileNativeI18n } from './native'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map(directory => fs.rm(directory, {
    force: true,
    recursive: true,
  })))
})

describe('native i18n compiler', () => {
  it('generates native JS and WXS assets without weapp-vite', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-i18n-'))
    tempDirectories.push(root)
    const localeDir = path.join(root, 'pages/index/i18n')
    await fs.mkdir(localeDir, { recursive: true })
    await Promise.all([
      fs.writeFile(path.join(localeDir, 'en-US.json'), JSON.stringify({ title: 'Title' })),
      fs.writeFile(path.join(localeDir, 'zh-CN.json'), JSON.stringify({ title: '标题' })),
    ])

    const result = await compileNativeI18n({
      defaultLocale: 'zh-CN',
      fallbackLocale: 'en-US',
      srcRoot: root,
    })

    expect(result.files).toHaveLength(2)
    expect(result.jsFile).toBe(path.join(root, 'i18n/locales.js'))
    expect(await fs.readFile(result.jsFile, 'utf8')).toContain('module.exports =')
    expect(await fs.readFile(result.wxsFile, 'utf8')).toContain('module.exports = { t: t }')
  })
})
