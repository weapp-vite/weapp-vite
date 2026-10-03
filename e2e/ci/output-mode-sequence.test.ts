import { expect, it } from 'vitest'
import { verifyEditSequence } from '../../scripts/editSequence/driver'
import { createProcessObserver } from '../../scripts/editSequence/processObserver'
import { createSequenceProject } from '../../scripts/editSequence/project'
import { createWeappModeSequence } from '../../scripts/editSequence/weappModeScenarios'

it.each([true, false])('matches fresh production through mode/cache transitions (emptyOutDir: %s)', async (emptyOutDir) => {
  const project = await createSequenceProject()
  const observer = createProcessObserver<Record<string, string>>('weapp-modes', project.root)
  try {
    await verifyEditSequence(createWeappModeSequence(emptyOutDir), observer, { timeoutMs: 90_000 })
    expect(observer.resources?.()).toEqual({ children: 0 })
  }
  finally {
    await project.close()
  }
}, 95_000)
