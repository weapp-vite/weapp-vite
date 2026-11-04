import type { FrameworkFamily } from '../types'
import assert from 'node:assert/strict'
import path from 'node:path'
import { corpusHash, corpusJson } from '../../archive'
import { readFrameworkCatalog } from '../catalog'
import { fileIdentity, writeProjectFile } from '../files'
import { antFixtureFiles } from './ant'
import { mpxFixtureFiles } from './mpx'
import { taroFixtureFiles } from './taro'
import { uniFixtureFiles } from './uni'

/** 自产夹具只用于框架矩阵，不具有真实上游语料配额资格。 */
export async function prepareMatrixFixture(framework: FrameworkFamily, version: string, outputDir: string, target?: string) {
  assert.ok((await readFrameworkCatalog()).some(item => item.framework === framework && item.version === version), 'Unregistered controlled fixture release')
  const files = framework === 'ant-design-mini' ? antFixtureFiles() : framework === 'mpx' ? mpxFixtureFiles(target) : framework === 'taro' ? taroFixtureFiles(version.startsWith('2.')) : uniFixtureFiles(framework === 'uni-vue3')
  const fixtureId = `${framework}-${version}-${corpusHash(corpusJson(files)).slice(0, 16)}`
  const directory = path.join(outputDir, fixtureId)
  for (const [file, source] of Object.entries(files)) {
    await writeProjectFile(directory, `src/${file}`, source)
  }
  const identities = await Promise.all(Object.keys(files).sort().map(file => fileIdentity(directory, `src/${file}`)))
  const provenance = {
    schemaVersion: 1,
    kind: 'controlled-fixture',
    quotaEligible: false,
    fixtureId,
    framework,
    version,
    features: framework === 'ant-design-mini'
      ? ['page', 'component', 'conditional', 'loop', 'event', 'entity', 'unicode', 'default-slot', 'named-slot', 'official-platform-allowlist', 'upstream-preprocessor']
      : ['page', 'component', 'conditional', 'loop', 'event', 'entity', 'unicode', ...(framework === 'mpx' && target === 'jd' ? [] : ['subpackage']), ...(framework === 'taro' ? ['component-children', 'official-runtime-base-template'] : ['default-slot', 'named-slot', framework === 'mpx' ? 'inline-script-target-conversion' : 'inline-wxs-weixin-only'])],
    restrictions: framework === 'mpx' && target === 'jd' ? [{ feature: 'subpackage', reason: 'Pinned MPX JD JSON compiler explicitly rejects subPackages; both pages remain ordinary page entries.', evidence: `https://unpkg.com/@mpxjs/webpack-plugin@${version}/lib/platform/json/wx/index.js` }] : [],
    files: identities,
  }
  await writeProjectFile(directory, 'fixture.json', `${corpusJson(provenance)}\n`)
  return { directory, input: path.join(directory, 'src'), fixtureId, provenance }
}
