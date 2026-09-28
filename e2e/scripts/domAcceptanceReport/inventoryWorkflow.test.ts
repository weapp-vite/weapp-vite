import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertDomAcceptanceInventoryComplete, createDomAcceptanceInventory } from './inventory'

vi.mock('../e2e-suite-manifest', () => ({
  getIdeExhaustiveTasks: () => [{ label: 'ide/example.test.ts' }],
  getIdeHeadlessTasks: () => [{ label: 'ide/example.test.ts' }],
}))

describe('live DOM inventory', () => {
  let root: string
  let source: string

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'dom-inventory-live-'))
    fs.mkdirSync(path.join(root, 'e2e/ide'), { recursive: true })
    fs.mkdirSync(path.join(root, 'e2e/scripts/domAcceptanceReport'), { recursive: true })
    fs.writeFileSync(path.join(root, 'e2e/scripts/e2e-suite-manifest.ts'), '')
    fs.writeFileSync(path.join(root, 'e2e/scripts/domAcceptanceReport/inventory.ts'), '')
    source = path.join(root, 'e2e/ide/example.test.ts')
    fs.writeFileSync(source, 'it(\'initial\', ctx => createDomAcceptance(ctx, \'fixture\', []))')
  })

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  it('checks sources without generated files and rejects new uncovered cases despite an old complete report', () => {
    const initial = createDomAcceptanceInventory(root)
    expect(() => assertDomAcceptanceInventoryComplete(initial)).not.toThrow()
    fs.writeFileSync(path.join(root, 'e2e/dom-acceptance-inventory.json'), JSON.stringify(initial))
    fs.appendFileSync(source, '\nit(\'new uncovered case\', () => page.data(\'count\'))')
    const changed = createDomAcceptanceInventory(root)
    expect(changed.summary.expandedCaseDeclarations).toBe(2)
    expect(() => assertDomAcceptanceInventoryComplete(changed)).toThrow('1 cases missing plans')
  })

  it('includes both independent source additions without merging saved reports', () => {
    fs.writeFileSync(path.join(root, 'e2e/dom-acceptance-inventory.json'), 'invalid stale report')
    fs.writeFileSync(path.join(root, 'e2e/dom-acceptance-inventory.md'), 'stale report')
    for (const name of ['branch-a', 'branch-b']) {
      fs.appendFileSync(source, `\nimport './${name}.test'`)
      fs.writeFileSync(path.join(root, `e2e/ide/${name}.test.ts`), `it('${name}', ctx => createDomAcceptance(ctx, 'fixture', []))`)
    }
    const inventory = createDomAcceptanceInventory(root)
    expect(inventory.tasks[0]!.cases.map(item => item.name)).toEqual(['initial', 'branch-a', 'branch-b'])
    expect(() => assertDomAcceptanceInventoryComplete(inventory)).not.toThrow()
  })
})
