import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import YAML from 'yaml'
import { verificationTopologyVariant, workflowTopology } from './topology.mjs'

const workflow = '.github/workflows/validate-ci-e2e.yml'
const diagnostic = 'watcher-comparison-diagnostic'

/** 只追加已审阅的 watcher 诊断 job；任何已有契约漂移均停止同步。 */
export function appendWatcherComparisonDiagnostic(frozen, current) {
  assert(current[workflow]?.[diagnostic], '缺少已审阅的 watcher comparison 诊断 job')
  const updated = {
    ...frozen,
    [workflow]: { ...frozen[workflow], [diagnostic]: frozen[workflow]?.[diagnostic] ?? current[workflow][diagnostic] },
  }
  assert.deepEqual(current, updated, '同步只允许新增 watcher comparison 诊断 job，不能改写已有拓扑')
  return current
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL('../../', import.meta.url)
  const target = new URL('./candidate-topology.json', import.meta.url)
  const frozen = JSON.parse(await readFile(target, 'utf8'))
  const current = Object.fromEntries(await Promise.all(Object.keys(frozen).map(async (file) => {
    const contents = YAML.parse(await readFile(new URL(file, root), 'utf8'))
    if (file === '.github/workflows/validate-ci.yml') {
      assert.equal(verificationTopologyVariant(contents), 'candidate')
    }
    return [file, workflowTopology(contents, 'candidate')]
  })))
  await writeFile(target, `${JSON.stringify(appendWatcherComparisonDiagnostic(frozen, current), null, 2)}\n`)
}
