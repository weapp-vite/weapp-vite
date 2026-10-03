import type { MiniProgramArtifact } from '@mpcore/test'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { createVitestProject } from './index'
import { createRunnerFixture } from './runner/fixtures'

const injected = vi.hoisted(() => ({ artifact: undefined as MiniProgramArtifact | undefined }))
vi.mock('vitest', async (importOriginal) => {
  const original = await importOriginal<typeof import('vitest')>()
  return { ...original, inject: (key: string) => key === 'mpcoreArtifact' ? injected.artifact : undefined }
})

it('reads updated injected artifacts for each runtime creation within the same worker', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mpcore-injected-artifact-'))
  try {
    const fixture = await createRunnerFixture(root)
    injected.artifact = fixture.artifacts[0]!
    const first = createVitestProject()
    try {
      const firstPage = await first.renderPage('/pages/index/index')
      expect(firstPage.screen.getByText('first').textContent).toBe('first')
      await firstPage.user.tap(firstPage.screen.getByRole('button', { name: 'add' }))
      injected.artifact = fixture.artifacts[1]!
      const second = createVitestProject()
      try {
        const secondPage = await second.renderPage('/pages/index/index')
        expect(secondPage.screen.getByText('second').textContent).toBe('second')
        expect(secondPage.screen.getByText('count: 1').textContent).toBe('count: 1')
        expect(firstPage.screen.getByText('count: 2').textContent).toBe('count: 2')
      }
      finally {
        await second.close()
      }
    }
    finally {
      await first.close()
    }
  }
  finally {
    injected.artifact = undefined
    await rm(root, { recursive: true, force: true })
  }
})
