import type { FrameworkRelease, FrameworkTarget, GenerationIdentity } from './types'
import assert from 'node:assert/strict'
import { corpusHash, corpusJson } from '../archive'
import { createAntProject } from './ant'
import { createMpxProject } from './mpx'
import { createTaroProject } from './taro'
import { createUniProject } from './uni'

export { validateGenerationIdentity } from './identity'

/** 仅使用本仓库维护的编译配置；不会执行采集仓库的 scripts 或配置文件。 */
export function createControlledProject(release: FrameworkRelease, target: FrameworkTarget, inputDependencies: Record<string, string> = {}) {
  const project = release.framework === 'ant-design-mini'
    ? createAntProject(release, target)
    : release.framework === 'mpx'
      ? createMpxProject(release, target)
      : release.framework === 'taro'
        ? createTaroProject(release, target)
        : createUniProject(release, target)
  assert.ok(inputDependencies && typeof inputDependencies === 'object' && !Array.isArray(inputDependencies), 'Input dependencies must be a package/version object')
  for (const [name, version] of Object.entries(inputDependencies)) {
    assert.ok(/^(?:@[a-z\d][\w.-]*\/)?[a-z\d][\w.-]*$/.test(name), 'Invalid input dependency package name')
    assert.ok(!Object.hasOwn(project.dependencies, name), 'Input dependencies cannot replace the controlled compiler toolchain')
    assert.ok(typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version), 'Input dependencies must use exact registry versions')
    project.dependencies[name] = version
  }
  for (const version of Object.values(project.dependencies)) {
    assert.ok(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version), 'Direct compiler dependencies must be pinned')
  }
  project.files['package.json'] = `${corpusJson({
    name: 'template-corpus-controlled-build',
    version: '0.0.0',
    private: true,
    packageManager: 'pnpm@12.16.1',
    dependencies: project.dependencies,
  })}\n`
  project.files['pnpm-workspace.yaml'] = 'packages: []\n'
  project.files['.npmrc'] = 'registry=https://registry.npmjs.org/\nignore-scripts=true\naudit=false\nfund=false\n'
  return project
}

export function generationInputKey(identity: GenerationIdentity, input: unknown): string {
  return corpusHash(corpusJson({ identity, input })).slice(0, 16)
}
