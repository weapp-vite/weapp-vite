import { appendFileSync, readFileSync, realpathSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/** 固定版本来自当前 action 所属 checkout，不能读取被测工程的工作目录。 */
export function resolveNodeSelector(requested = '', fixed = readFileSync(new URL('../../../.node-version', import.meta.url), 'utf8').trim()) {
  const policy = JSON.parse(readFileSync(new URL('../../ci-toolchain.json', import.meta.url), 'utf8'))
  const preferred = policy.node.preferred
  const selector = String(requested).trim()
  if (!selector || selector === 'default') {
    return { version: fixed, checkLatest: false }
  }
  if (Object.hasOwn(preferred, selector)) {
    return { version: `^${preferred[selector]}`, checkLatest: true }
  }
  if (/[\r\n]/u.test(selector)) {
    throw new Error('Node.js selector must fit on one line')
  }
  return { version: selector, checkLatest: false }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const selected = resolveNodeSelector(process.env.CI_NODE_VERSION)
  appendFileSync(process.env.GITHUB_OUTPUT, `node-version=${selected.version}\ncheck-latest=${selected.checkLatest}\n`)
}
