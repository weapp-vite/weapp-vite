import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { expect, it } from 'vitest'
import { createLogicalEntryId, createSidecarSourceSpecifier } from '../../moduleGraph/protocol'
import { isStatefulHmrBoundary } from './boundaries'

it.each(['page', 'component', 'app', 'layout'] as const)('keeps %s execution acceptance outside inert script sidecars', async (kind) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'stateful-execution-boundary-')))
  const source = path.join(root, 'entry.vue')
  const external = path.join(root, 'setup.ts')
  try {
    await writeFile(source, '<script setup>const count = 0</script><template><view>{{ count }}</view></template>')
    await writeFile(external, 'export const count = 0')
    const entries = new Set([source])
    const delegated = new Set(kind === 'component' ? [source] : [])
    expect(isStatefulHmrBoundary(source, root, entries, delegated)).toBe(kind !== 'component')
    expect(isStatefulHmrBoundary(createLogicalEntryId(source, kind), root, entries, delegated)).toBe(true)
    for (const dependency of [source, external]) {
      expect(isStatefulHmrBoundary(createSidecarSourceSpecifier(source, dependency, 'script'), root, entries, delegated)).toBe(false)
    }
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
