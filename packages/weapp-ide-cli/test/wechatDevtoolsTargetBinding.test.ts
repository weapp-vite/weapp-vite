import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getRuntimeWechatDevtoolsServicePort, setRuntimeWechatDevtoolsServicePort } from '../src/cli/wechatDevtoolsRuntimePort'
import { bootstrapWechatDevtoolsSettings, detectWechatDevtoolsServicePort } from '../src/cli/wechatDevtoolsSettings'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })))
})

describe('selected DevTools installation ownership', () => {
  it('keeps disabled selected settings instead of borrowing another installation', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wechat-target-binding-'))
    directories.push(homeDir)
    const base = path.join(homeDir, 'Library', 'Application Support', '微信开发者工具')
    const target = {
      cliPath: path.join(homeDir, 'selected.app', 'Contents', 'MacOS', 'cli'),
      appPath: path.join(homeDir, 'selected.app', 'Contents', 'Resources', 'app.asar'),
      installationId: 'selected',
      profileDir: path.join(base, 'selected'),
    }
    for (const [instance, enableServicePort, port] of [['selected', false, 22001], ['other', true, 22002]] as const) {
      const localData = path.join(base, instance, 'WeappLocalData')
      await fs.mkdir(localData, { recursive: true })
      await fs.writeFile(path.join(localData, 'localstorage_b72da75d79277d2f5f9c30c9177be57e.json'), JSON.stringify({ security: { enableServicePort, port } }))
    }
    expect(await detectWechatDevtoolsServicePort({ homeDir, platform: 'darwin', target })).toMatchObject({
      touchedInstanceCount: 1,
      detectedSecurityCount: 1,
      servicePort: 22001,
      servicePortEnabled: false,
    })
    await fs.rm(target.profileDir, { recursive: true })
    expect(await bootstrapWechatDevtoolsSettings({ homeDir, platform: 'darwin', target })).toMatchObject({
      touchedInstanceCount: 0,
      detectedSecurityCount: 0,
      servicePort: undefined,
    })
  })

  it('does not let one CLI overwrite another installation runtime port', () => {
    const first = { installationId: 'first' }
    const second = { installationId: 'second' }
    setRuntimeWechatDevtoolsServicePort(22011, first)
    setRuntimeWechatDevtoolsServicePort(22012, second)
    expect(getRuntimeWechatDevtoolsServicePort(first)).toBe(22011)
    expect(getRuntimeWechatDevtoolsServicePort(second)).toBe(22012)
    setRuntimeWechatDevtoolsServicePort(undefined, first)
    expect(getRuntimeWechatDevtoolsServicePort(first)).toBeUndefined()
    expect(getRuntimeWechatDevtoolsServicePort(second)).toBe(22012)
    setRuntimeWechatDevtoolsServicePort(undefined, second)
  })
})
