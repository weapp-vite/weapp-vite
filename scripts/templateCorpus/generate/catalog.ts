import type { FrameworkFamily, FrameworkRelease, FrameworkTarget } from './types'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

/** 版本和目标来自冻结清单；存在目标只代表候选，必须实际构建才可计数。 */
export async function readFrameworkCatalog(): Promise<FrameworkRelease[]> {
  const parsed: unknown = JSON.parse(await readFile(new URL('../frameworks.json', import.meta.url), 'utf8'))
  assert.ok(Array.isArray(parsed), 'Invalid framework catalog')
  for (const value of parsed as FrameworkRelease[]) {
    assert.ok(['uni-vue2', 'uni-vue3', 'mpx', 'taro', 'ant-design-mini'].includes(value.framework), 'Unknown framework family')
    assert.ok(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(value.version), 'Unpinned framework version')
    assert.ok(value.compiler.startsWith('@') && Array.isArray(value.targets), 'Invalid compiler identity')
    if (value.upstream) {
      assert.ok(/^[\w.-]+\/[\w.-]+$/.test(value.upstream.repository) && /^[\da-f]{40}$/.test(value.upstream.commit), 'Invalid immutable upstream identity')
    }
    const targets = new Set<string>()
    for (const target of value.targets) {
      assert.ok(target.target && !targets.has(target.target), 'Duplicate framework target')
      assert.ok(target.platform && target.profileId && target.evidence, 'Missing target evidence')
      assert.ok(['candidate', 'unsupported'].includes(target.support), 'Unknown target support state')
      assert.ok(target.extensions.every(extension => /^\.[a-z\d]+$/.test(extension)), 'Invalid template extension')
      targets.add(target.target)
    }
  }
  return parsed as FrameworkRelease[]
}

export function selectFrameworkTarget(catalog: FrameworkRelease[], framework: FrameworkFamily, version: string, target: string): { release: FrameworkRelease, target: FrameworkTarget } {
  const release = catalog.find(item => item.framework === framework && item.version === version)
  assert.ok(release, `Unregistered framework release: ${framework}@${version}`)
  const selected = release.targets.find(item => item.target === target)
  assert.ok(selected, `Unregistered framework target: ${framework}@${version}/${target}`)
  return { release, target: selected }
}
