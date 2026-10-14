import { readFileSync } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'

export const manifestPath = 'packages/ast-native/correctness.manifest.json'
const baseline = JSON.parse(readFileSync(new URL(`../../${manifestPath}`, import.meta.url), 'utf8'))
const buildPackages = new Map([
  ['@wevu/compiler...', 'packages-runtime/wevu-compiler'],
  ['weapp-vite...', 'packages/weapp-vite'],
])

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) {
    throw new TypeError('Invalid correctness manifest fields')
  }
}

function uniqueList(value, valid) {
  if (!Array.isArray(value) || !value.length || value.length > 1000
    || value.some(item => !valid(item)) || new Set(value).size !== value.length) {
    throw new TypeError('Invalid or duplicate correctness manifest entries')
  }
}

/** 候选只能扩充可信 driver 的覆盖下限，不允许传入命令或缩减基础语料。 */
export function validateManifest(value) {
  exactKeys(value, ['schemaVersion', 'requiredExports', 'buildFilters', 'suites'])
  if (value.schemaVersion !== 1) {
    throw new Error('Unsupported correctness manifest version')
  }
  uniqueList(value.requiredExports, item => typeof item === 'string' && /^[a-z]\w*Native$/u.test(item))
  uniqueList(value.buildFilters, item => buildPackages.has(item))
  if (!Array.isArray(value.suites)) {
    throw new TypeError('Missing correctness suites')
  }
  for (const suite of value.suites) {
    exactKeys(suite, ['file', 'minimumAssertions'])
    if (typeof suite.file !== 'string' || !/^test\/(?:[a-z][\w-]*\/)*[a-z][\w.-]*\.test\.ts$/iu.test(suite.file)
      || !Number.isSafeInteger(suite.minimumAssertions) || suite.minimumAssertions <= 0) {
      throw new TypeError('Invalid correctness suite or assertion floor')
    }
  }
  uniqueList(value.suites.map(suite => suite.file), () => true)
  if (new Set(value.suites.map(suite => suite.file.toLowerCase())).size !== value.suites.length) {
    throw new Error('Case-colliding correctness suites')
  }
  for (const key of ['requiredExports', 'buildFilters']) {
    if (baseline[key].some(item => !value[key].includes(item))) {
      throw new Error('Candidate omits trusted correctness baseline')
    }
  }
  for (const floor of baseline.suites) {
    const suite = value.suites.find(item => item.file === floor.file)
    if (!suite || suite.minimumAssertions < floor.minimumAssertions) {
      throw new Error('Candidate reduces trusted correctness suite coverage')
    }
  }
  return structuredClone(value)
}

export const baselineManifest = validateManifest(baseline)

/** 清单和 suite 必须是候选 checkout 内的真实文件，不能通过符号链接逃逸。 */
export async function candidateFile(root, relative) {
  const directory = await realpath(root)
  const resolved = await realpath(path.join(directory, relative))
  const fromRoot = path.relative(directory, resolved)
  if (!fromRoot || fromRoot.startsWith(`..${path.sep}`) || fromRoot === '..' || path.isAbsolute(fromRoot)) {
    throw new Error('Correctness file escapes candidate checkout')
  }
  if (!(await stat(resolved)).isFile()) {
    throw new Error('Correctness entry must be a regular file')
  }
  return resolved
}

export async function loadManifest(root) {
  const bytes = await readFile(await candidateFile(root, manifestPath))
  const manifest = validateManifest(JSON.parse(bytes.toString('utf8')))
  for (const suite of manifest.suites) {
    await candidateFile(root, `packages/ast-native/${suite.file}`)
  }
  for (const filter of manifest.buildFilters) {
    const packageFile = await candidateFile(root, `${buildPackages.get(filter)}/package.json`)
    const packageName = JSON.parse(await readFile(packageFile, 'utf8')).name
    if (`${packageName}...` !== filter) {
      throw new Error('Correctness build filter does not match the workspace package')
    }
  }
  return { manifest, bytes }
}
