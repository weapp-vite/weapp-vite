import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  resolveWechatDevtoolsMetadata,
  resolveWechatDevtoolsPackageJsonPath,
} from './wechatDevtoolsMetadata'

const temporaryDirectories: string[] = []

function createTemporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-devtools-metadata-'))
  temporaryDirectories.push(directory)
  return directory
}

function writePackageJson(appPath: string, relativePath: string, metadata: Record<string, unknown>) {
  const packageJsonPath = path.join(appPath, relativePath)
  fs.mkdirSync(path.dirname(packageJsonPath), { recursive: true })
  fs.writeFileSync(packageJsonPath, JSON.stringify(metadata))
  return packageJsonPath
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true })
  }
})

describe('resolveWechatDevtoolsMetadata', () => {
  it('prefers the Electron app.asar.unpacked package metadata', () => {
    const appPath = createTemporaryDirectory()
    const electronPackageJson = writePackageJson(
      appPath,
      'Contents/Resources/app.asar.unpacked/package.json',
      {
        buildTime: 1787647793927,
        productName: '微信开发者工具',
        version: '2.02.2608060',
      },
    )
    writePackageJson(
      appPath,
      'Contents/Resources/package.nw/package.json',
      { version: '2.01.2510290' },
    )

    expect(resolveWechatDevtoolsMetadata(appPath)).toEqual({
      appPath,
      buildTime: '1787647793927 (2026-08-25T08:49:53.927Z)',
      packageJsonPath: electronPackageJson,
      productName: '微信开发者工具',
      version: '2.02.2608060',
    })
  })

  it('falls back to the legacy package.nw layout', () => {
    const appPath = createTemporaryDirectory()
    const legacyPackageJson = writePackageJson(
      appPath,
      'Contents/Resources/package.nw/package.json',
      { name: '微信开发者工具', version: '2.01.2510290' },
    )

    expect(resolveWechatDevtoolsMetadata(appPath)).toMatchObject({
      packageJsonPath: legacyPackageJson,
      productName: '微信开发者工具',
      version: '2.01.2510290',
    })
  })

  it('accepts a package.json path directly', () => {
    const appPath = createTemporaryDirectory()
    const packageJsonPath = writePackageJson(appPath, 'custom/package.json', {
      productName: 'Custom DevTools',
      version: '1.0.0',
    })

    expect(resolveWechatDevtoolsPackageJsonPath(packageJsonPath)).toBe(packageJsonPath)
    expect(resolveWechatDevtoolsMetadata(packageJsonPath)).toMatchObject({
      appPath: packageJsonPath,
      packageJsonPath,
      productName: 'Custom DevTools',
      version: '1.0.0',
    })
  })

  it('reports an explicit missing state', () => {
    const appPath = createTemporaryDirectory()

    expect(resolveWechatDevtoolsMetadata(appPath)).toEqual({
      appPath,
      buildTime: '未检测到',
      packageJsonPath: path.join(appPath, 'Contents/Resources/app.asar.unpacked/package.json'),
      productName: '未检测到',
      version: '未检测到',
    })
  })
})
