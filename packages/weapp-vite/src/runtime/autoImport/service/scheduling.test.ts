import type { MutableCompilerContext } from '../../../context'
import { describe, expect, it, vi } from 'vitest'
import { createAutoImportScheduling } from './scheduling'

function createScheduling() {
  const outputsHelpers = {
    scheduleManifestWrite: vi.fn(async () => {}),
    scheduleTypedComponentsWrite: vi.fn(),
    scheduleHtmlCustomDataWrite: vi.fn(),
    scheduleVueComponentsWrite: vi.fn(),
  }
  return {
    ...createAutoImportScheduling({ ctx: {} as MutableCompilerContext, outputsHelpers }),
    outputsHelpers,
  }
}

describe('support output ownership during isolated builds', () => {
  it('keeps each isolated service read-only while concurrent active work keeps writing', async () => {
    const snapshot = createScheduling()
    const active = createScheduling()
    const entered = Promise.withResolvers<void>()
    const resume = Promise.withResolvers<void>()
    let child: ReturnType<typeof createScheduling> | undefined
    const pending = snapshot.runWithoutOutputWrites(async () => {
      entered.resolve()
      await resume.promise
      child = createScheduling()
      await child.runWithoutOutputWrites(() => child!.runInBatch(async () => {
        await Promise.resolve()
        child!.deferOrSchedule('manifest', true)
        child!.deferOrSchedule('typed', true)
        await child!.runWithoutOutputWrites(async () => {
          child!.deferOrSchedule('vue', true)
        })
        child!.deferOrSchedule('html', true)
      }))
    })
    await entered.promise
    active.deferOrSchedule('manifest', true)
    resume.resolve()
    await pending
    for (const output of Object.values(child!.outputsHelpers)) {
      expect(output).not.toHaveBeenCalled()
    }
    expect(active.outputsHelpers.scheduleManifestWrite).toHaveBeenCalledTimes(1)
    snapshot.deferOrSchedule('manifest', true)
    expect(snapshot.outputsHelpers.scheduleManifestWrite).toHaveBeenCalledTimes(1)
  })

  it('restores writes after failure and covers callbacks while the build awaits closeBundle', async () => {
    const snapshot = createScheduling()
    const entered = Promise.withResolvers<void>()
    const resume = Promise.withResolvers<void>()
    const pending = snapshot.runWithoutOutputWrites(async () => {
      entered.resolve()
      await resume.promise
      throw new Error('snapshot failed')
    })
    const rejected = expect(pending).rejects.toThrow('snapshot failed')
    await entered.promise
    snapshot.deferOrSchedule('typed', true)
    expect(snapshot.outputsHelpers.scheduleTypedComponentsWrite).not.toHaveBeenCalled()
    resume.resolve()
    await rejected
    snapshot.deferOrSchedule('manifest', true)
    expect(snapshot.outputsHelpers.scheduleManifestWrite).toHaveBeenCalledTimes(1)
  })
})
