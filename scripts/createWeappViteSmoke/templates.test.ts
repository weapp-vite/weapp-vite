import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveMiniProgramDirectory } from './templates.mjs'

const roots: string[] = []

async function fixture(platform: string, filename: string, config: Record<string, unknown>, multiPlatform = true) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'template-ide-root-'))
  roots.push(root)
  const directory = multiPlatform ? path.join(root, 'dist', platform) : root
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, filename), JSON.stringify(config))
  return { root, directory }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
})

describe('template IDE output directory resolution', () => {
  it.each([
    ['weapp', 'project.config.json', 'miniprogramRoot'],
    ['alipay', 'mini.project.json', 'miniprogramRoot'],
    ['tt', 'project.config.json', 'miniprogramRoot'],
    ['swan', 'project.swan.json', 'smartProgramRoot'],
    ['jd', 'project.config.json', 'miniprogramRoot'],
    ['xhs', 'project.config.json', 'miniprogramRoot'],
  ])('resolves the %s configured application root inside its platform IDE directory', async (platform, filename, rootKey) => {
    const { root, directory } = await fixture(platform, filename, { [rootKey]: 'dist' })
    expect(await resolveMiniProgramDirectory(root, 'multi-platform', platform)).toBe(path.join(directory, 'dist'))
  })

  it.each(['multi-platform', 'multi-platform-sfc'])('keeps the two-argument WeChat entry compatible for %s', async (template) => {
    const { root, directory } = await fixture('weapp', 'project.config.json', { miniprogramRoot: 'dist' })
    expect(await resolveMiniProgramDirectory(root, template)).toBe(path.join(directory, 'dist'))
  })

  it('uses the project directory for ordinary templates', async () => {
    const { root } = await fixture('weapp', 'project.config.json', { miniprogramRoot: 'dist' }, false)
    expect(await resolveMiniProgramDirectory(root, 'default')).toBe(path.join(root, 'dist'))
  })

  it('keeps the SFC platform parameter independent from the default WeChat output', async () => {
    const { root, directory } = await fixture('alipay', 'mini.project.json', { miniprogramRoot: 'compiled' })
    expect(await resolveMiniProgramDirectory(root, 'multi-platform-sfc', 'alipay')).toBe(path.join(directory, 'compiled'))
  })

  it('honors Baidu root priority and falls back through registered keys', async () => {
    const { root, directory } = await fixture('swan', 'project.swan.json', { smartProgramRoot: 'primary', miniprogramRoot: 'secondary', srcMiniprogramRoot: 'tertiary' })
    expect(await resolveMiniProgramDirectory(root, 'multi-platform', 'swan')).toBe(path.join(directory, 'primary'))
    await fs.writeFile(path.join(directory, 'project.swan.json'), JSON.stringify({ smartProgramRoot: ' ', miniprogramRoot: 'secondary', srcMiniprogramRoot: 'tertiary' }))
    expect(await resolveMiniProgramDirectory(root, 'multi-platform', 'swan')).toBe(path.join(directory, 'secondary'))
  })

  it('accepts Windows separators in a registered fallback root', async () => {
    const { root, directory } = await fixture('alipay', 'mini.project.json', { miniprogramRoot: '', srcMiniprogramRoot: 'nested\\application' })
    expect(await resolveMiniProgramDirectory(root, 'multi-platform', 'alipay')).toBe(path.join(directory, 'nested', 'application'))
  })

  it('uses the IDE directory when no root is declared and rejects a missing platform configuration', async () => {
    const { root, directory } = await fixture('weapp', 'project.config.json', {})
    expect(await resolveMiniProgramDirectory(root, 'multi-platform')).toBe(directory)
    await fs.mkdir(path.join(root, 'dist', 'alipay'))
    await fs.writeFile(path.join(root, 'dist', 'alipay', 'project.config.json'), '{"miniprogramRoot":"dist"}')
    expect(await resolveMiniProgramDirectory(root, 'multi-platform', 'alipay')).toBeNull()
  })
})
