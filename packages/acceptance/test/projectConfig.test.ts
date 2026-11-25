import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { AcceptanceService } from '../src/acceptance'
import { readRuntimeProjectConfig } from '../src/projectConfig'

const roots: string[] = []
afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

it.each([undefined, '{invalid', '[]', 'null'])('diagnoses invalid artifact project configuration %s in acceptance inspection', async (source) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'acceptance-project-config-'))
  roots.push(root)
  vi.stubEnv('WEAPP_AGENT_STATE_DIR', path.join(root, 'state'))
  await writeFile(path.join(root, 'package.json'), '{"dependencies":{"weapp-vite":"7.11.1"}}')
  await mkdir(path.join(root, 'acceptance'))
  await writeFile(path.join(root, 'acceptance/runtime.json'), JSON.stringify({
    version: 1,
    name: 'runtime-check',
    steps: [{ action: 'route', path: '/pages/index/index' }, { action: 'assert', selector: '#ready', text: 'yes' }],
  }))
  if (source !== undefined) {
    await writeFile(path.join(root, 'project.config.json'), source)
  }
  const service = await AcceptanceService.create(root)
  try {
    const report = await service.inspect()
    expect(report.hasTestAppId).toBe(false)
    expect(report.prerequisites.join('\n')).toContain(source === undefined ? 'miniprogramRoot' : 'JSON object')
    await expect(readRuntimeProjectConfig(root)).rejects.toThrow('project.config.json')
  }
  finally {
    await service.close()
  }
})
