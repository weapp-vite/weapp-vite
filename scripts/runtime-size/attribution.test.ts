import type { RuntimeSizeTierReport } from '../runtime-size'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runtimeSizeTargets } from '../runtime-size-config'
import { createRuntimeTierAttribution } from './attribution'

describe('runtime capability attribution', () => {
  it('keeps output overhead, explicit baselines and live reference chains without depending on helper names', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'runtime-attribution-'))
    try {
      await mkdir(path.join(root, 'node_modules/wevu'), { recursive: true })
      await writeFile(path.join(root, 'node_modules/wevu/package.json'), JSON.stringify({ name: 'wevu', version: '1.0.0' }))
      const modulePath = 'node_modules/wevu/runtime.mjs'
      const base: RuntimeSizeTierReport = { id: 'reactivity-core', label: 'base', dev: { bytes: 20 }, production: { bytes: 20, retainedModules: { entry: 'entry', modules: [{ path: 'entry', bytesInOutput: 5, imports: [] }] } } }
      const current: RuntimeSizeTierReport = { id: 'minimal-app', label: 'app', dev: { bytes: 50 }, production: { bytes: 50, retainedModules: { entry: 'entry', modules: [{ path: 'entry', bytesInOutput: 5, imports: [modulePath] }, { path: modulePath, bytesInOutput: 30, imports: [] }] } } }
      const result = createRuntimeTierAttribution(root, runtimeSizeTargets[0]!, current, [base, current], 'import { createApp } from "wevu/internal-runtime"')
      expect(result.comparison).toEqual({ tier: 'reactivity-core', bytesDelta: 30 })
      expect(result.unattributedBytes).toBe(15)
      expect(result.categoryBytes.runtime).toBe(30)
      expect(result.modules.find(module => module.path === modulePath)).toMatchObject({ bytesDelta: 30, importChain: ['entry', modulePath] })
      expect(() => createRuntimeTierAttribution(root, runtimeSizeTargets[0]!, current, [current], '')).toThrow('Missing comparison tier')
      current.production.bytes = 1
      expect(() => createRuntimeTierAttribution(root, runtimeSizeTargets[0]!, current, [base, current], '')).toThrow('exceeds output bytes')
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
