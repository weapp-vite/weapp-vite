import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { bootstrapWechatDevtoolsSettings } from '../src/cli/wechatDevtoolsSettings'

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

  it('merges default security settings into local devtools storage', async () => {
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
    await fs.writeFile(
      path.join(localDataDir, 'localstorage_b72da75d79277d2f5f9c30c9177be57e.json'),
      `${JSON.stringify({
        general: {
          loadEditorWhenLaunch: true,
        },
        security: {
          port: 3000,
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
      updatedSecurityCount: 1,
      trustedProjectCount: 0,
    })

    const hashKeyMap = await readJson(path.join(localDataDir, 'hash_key_map_2.json'))
    expect(hashKeyMap).toMatchObject({
      b72da75d79277d2f5f9c30c9177be57e: 'reduxPersist:settings',
    })

    const localstorage = await readJson(path.join(localDataDir, 'localstorage_b72da75d79277d2f5f9c30c9177be57e.json'))
    const lsStorage = await readJson(path.join(localDataDir, 'ls_b72da75d79277d2f5f9c30c9177be57e.json'))

    expect(localstorage.security).toEqual({
      enableServicePort: true,
      port: 21992,
      allowGetTicket: true,
      trustWhenAuto: true,
    })
    expect(lsStorage.security).toEqual(localstorage.security)
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
    const result = await bootstrapWechatDevtoolsSettings({
      homeDir,
      platform: 'darwin',
      projectPath,
      trustProject: true,
    })

    expect(result).toEqual({
      touchedInstanceCount: 1,
      updatedSecurityCount: 1,
      trustedProjectCount: 1,
    })

    const trustedProjectHash = createStorageHash(`project2_${projectPath}`)
    const hashKeyMap = await readJson(path.join(localDataDir, 'hash_key_map_2.json'))
    expect(hashKeyMap).toMatchObject({
      [trustedProjectHash]: `project2_${projectPath}`,
    })

    const trustedProject = await readJson(path.join(localDataDir, `localstorage_${trustedProjectHash}.json`))
    expect(trustedProject).toMatchObject({
      projectid: projectPath,
      projectpath: projectPath,
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
      updatedSecurityCount: 0,
      trustedProjectCount: 0,
    })
  })
})
