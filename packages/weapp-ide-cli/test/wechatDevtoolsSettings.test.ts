import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  bootstrapWechatDevtoolsSettings,
  detectWechatDevtoolsServicePort,
} from '../src/cli/wechatDevtoolsSettings'

async function createTempHomeDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-ide-cli-devtools-settings-'))
}

async function readJson(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>
}

function createStorageHash(key: string) {
  return createHash('md5').update(key).digest('hex')
}

describe('bootstrapWechatDevtoolsSettings', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(async tempDir => fs.rm(tempDir, { recursive: true, force: true })))
  })

  it('detects existing security settings without overriding them', async () => {
    const homeDir = await createTempHomeDir()
    tempDirs.push(homeDir)
    const localDataDir = path.join(
      homeDir,
      'Library',
      'Application Support',
      '微信开发者工具',
      'instance-a',
      'WeappLocalData',
    )
    await fs.mkdir(localDataDir, { recursive: true })
    await fs.writeFile(
      path.join(localDataDir, 'localstorage_b72da75d79277d2f5f9c30c9177be57e.json'),
      `${JSON.stringify({
        general: {
          loadEditorWhenLaunch: true,
        },
        security: {
          enableServicePort: false,
          port: 3000,
          allowGetTicket: false,
          trustWhenAuto: false,
        },
      }, null, 2)}\n`,
      'utf8',
    )

    const result = await bootstrapWechatDevtoolsSettings({
      homeDir,
      platform: 'darwin',
    })

    expect(result).toEqual({
      touchedInstanceCount: 1,
      detectedSecurityCount: 1,
      updatedSecurityCount: 0,
      trustedProjectCount: 0,
      servicePort: 3000,
      servicePortEnabled: false,
    })

    const localstorage = await readJson(path.join(localDataDir, 'localstorage_b72da75d79277d2f5f9c30c9177be57e.json'))

    expect(localstorage.security).toEqual({
      enableServicePort: false,
      port: 3000,
      allowGetTicket: false,
      trustWhenAuto: false,
    })
    expect(localstorage.general).toEqual({
      loadEditorWhenLaunch: true,
    })
  })

  it('creates trusted project storage when project trust is enabled', async () => {
    const homeDir = await createTempHomeDir()
    tempDirs.push(homeDir)
    const localDataDir = path.join(
      homeDir,
      'Library',
      'Application Support',
      '微信开发者工具',
      'instance-a',
      'WeappLocalData',
    )
    await fs.mkdir(localDataDir, { recursive: true })
    await fs.writeFile(path.join(localDataDir, 'hash_key_map_2.json'), '{}\n', 'utf8')

    const projectPath = '/Users/tester/Projects/demo-app'
    const normalizedProjectPath = path.resolve(projectPath)
    const trustedProjectHash = createStorageHash(`project2_${normalizedProjectPath}`)
    await fs.writeFile(
      path.join(localDataDir, `localstorage_${trustedProjectHash}.json`),
      `project2_${normalizedProjectPath}`,
      'utf8',
    )

    const result = await bootstrapWechatDevtoolsSettings({
      homeDir,
      platform: 'darwin',
      projectPath,
      trustProject: true,
    })

    expect(result).toEqual({
      touchedInstanceCount: 1,
      detectedSecurityCount: 0,
      updatedSecurityCount: 0,
      trustedProjectCount: 1,
      servicePort: undefined,
      servicePortEnabled: undefined,
    })

    const hashKeyMap = await readJson(path.join(localDataDir, 'hash_key_map_2.json'))
    expect(hashKeyMap).toMatchObject({
      [trustedProjectHash]: `project2_${normalizedProjectPath}`,
    })

    const trustedProject = await readJson(path.join(localDataDir, `localstorage_${trustedProjectHash}.json`))
    const trustedProjectLs = await readJson(path.join(localDataDir, `ls_${trustedProjectHash}.json`))
    expect(trustedProject).toMatchObject({
      projectid: normalizedProjectPath,
      projectpath: normalizedProjectPath,
      isTrusted: true,
    })
    expect(trustedProjectLs).toMatchObject({
      projectid: normalizedProjectPath,
      projectpath: normalizedProjectPath,
      isTrusted: true,
    })
  })

  it('supports Windows User Data root storage layout and keeps detected port', async () => {
    const homeDir = await createTempHomeDir()
    tempDirs.push(homeDir)
    const localAppDataDir = path.join(homeDir, 'AppData', 'Local')
    const localDataDir = path.join(
      localAppDataDir,
      '微信开发者工具',
      'User Data',
      'WeappLocalData',
    )
    await fs.mkdir(localDataDir, { recursive: true })
    await fs.writeFile(path.join(localDataDir, 'hash_key_map_2.json'), '{}\n', 'utf8')
    await fs.writeFile(
      path.join(localDataDir, 'ls_b72da75d79277d2f5f9c30c9177be57e.json'),
      `${JSON.stringify({
        security: {
          enableServicePort: true,
          port: 21992,
        },
      }, null, 2)}\n`,
      'utf8',
    )

    const projectPath = 'C:/workspace/demo-app'
    const normalizedProjectPath = path.resolve(projectPath)
    const result = await bootstrapWechatDevtoolsSettings({
      homeDir,
      localAppDataDir,
      platform: 'win32',
      projectPath,
      trustProject: true,
    })

    expect(result).toEqual({
      touchedInstanceCount: 1,
      detectedSecurityCount: 1,
      updatedSecurityCount: 0,
      trustedProjectCount: 1,
      servicePort: 21992,
      servicePortEnabled: true,
    })

    const settingsStorage = await readJson(path.join(localDataDir, 'ls_b72da75d79277d2f5f9c30c9177be57e.json'))
    expect(settingsStorage.security).toEqual({
      enableServicePort: true,
      port: 21992,
    })

    const trustedProjectHash = createStorageHash(`project2_${normalizedProjectPath}`)
    const trustedProject = await readJson(path.join(localDataDir, `localstorage_${trustedProjectHash}.json`))
    const trustedProjectLs = await readJson(path.join(localDataDir, `ls_${trustedProjectHash}.json`))
    expect(trustedProject).toMatchObject({
      projectid: normalizedProjectPath,
      projectpath: normalizedProjectPath,
      isTrusted: true,
    })
    expect(trustedProjectLs).toMatchObject({
      projectid: normalizedProjectPath,
      projectpath: normalizedProjectPath,
      isTrusted: true,
    })
  })

  it('skips unsupported platforms without touching any files', async () => {
    const homeDir = await createTempHomeDir()
    tempDirs.push(homeDir)

    const result = await bootstrapWechatDevtoolsSettings({
      homeDir,
      platform: 'linux',
      projectPath: '/project/demo',
      trustProject: true,
    })

    expect(result).toEqual({
      touchedInstanceCount: 0,
      detectedSecurityCount: 0,
      updatedSecurityCount: 0,
      trustedProjectCount: 0,
      servicePort: undefined,
      servicePortEnabled: undefined,
    })
  })
})

describe('detectWechatDevtoolsServicePort', () => {
  const tempDirs: string[] = []

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(async tempDir => fs.rm(tempDir, { recursive: true, force: true })))
  })

  it('prefers an enabled service-port instance when multiple instances exist', async () => {
    const homeDir = await createTempHomeDir()
    tempDirs.push(homeDir)
    const baseDir = path.join(homeDir, 'Library', 'Application Support', '微信开发者工具')
    const disabledLocalDataDir = path.join(baseDir, 'instance-a', 'WeappLocalData')
    const enabledLocalDataDir = path.join(baseDir, 'instance-b', 'WeappLocalData')
    await fs.mkdir(disabledLocalDataDir, { recursive: true })
    await fs.mkdir(enabledLocalDataDir, { recursive: true })
    await fs.writeFile(
      path.join(disabledLocalDataDir, 'localstorage_b72da75d79277d2f5f9c30c9177be57e.json'),
      `${JSON.stringify({
        security: {
          enableServicePort: false,
          port: 3000,
        },
      }, null, 2)}\n`,
      'utf8',
    )
    await fs.writeFile(
      path.join(enabledLocalDataDir, 'localstorage_b72da75d79277d2f5f9c30c9177be57e.json'),
      `${JSON.stringify({
        security: {
          enableServicePort: true,
          port: 21992,
        },
      }, null, 2)}\n`,
      'utf8',
    )

    const result = await detectWechatDevtoolsServicePort({
      homeDir,
      platform: 'darwin',
    })

    expect(result).toEqual({
      touchedInstanceCount: 2,
      detectedSecurityCount: 2,
      servicePort: 21992,
      servicePortEnabled: true,
    })
  })
})
