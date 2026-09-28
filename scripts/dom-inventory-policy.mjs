import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const DOM_INVENTORY_FILES = [
  'e2e/dom-acceptance-inventory.json',
  'e2e/dom-acceptance-inventory.md',
]

export function assertDomInventoryUntracked(root = fileURLToPath(new URL('..', import.meta.url))) {
  const tracked = execFileSync('git', ['ls-files', '--cached', '-z', '--', ...DOM_INVENTORY_FILES], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
  if (tracked.length) {
    throw new Error(`Generated DOM inventories must not be tracked; run git rm --cached -- ${tracked.join(' ')}. Commit the test sources instead.`)
  }
  // --no-index 同时覆盖首次 checkout 和尚未生成报告的工作树。
  const ignored = execFileSync('git', ['check-ignore', '--no-index', '-z', '--stdin'], {
    cwd: root,
    encoding: 'utf8',
    input: `${DOM_INVENTORY_FILES.join('\0')}\0`,
  }).split('\0').filter(Boolean)
  if (DOM_INVENTORY_FILES.some(file => !ignored.includes(file))) {
    throw new Error('Generated DOM inventories must remain ignored in .gitignore')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  assertDomInventoryUntracked()
}
