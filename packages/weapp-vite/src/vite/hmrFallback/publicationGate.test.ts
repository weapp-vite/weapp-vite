import type { OutputBundle } from 'rolldown'
import { expect, it } from 'vitest'
import { createTargetPublicationGate } from './publicationGate'

function publicationBundle(marker: string): OutputBundle {
  return {
    'pages/home/index.js': {
      type: 'chunk',
      code: `Page({ data: { marker: ${JSON.stringify(marker)} } })`,
    },
  } as OutputBundle
}

it.each(['before', 'during'] as const)('keeps an initial publication completed %s the recovery gate out of its completion count', async (timing) => {
  const marker = 'recovered-source-generation'
  const gate = createTargetPublicationGate(marker)
  const releaseInitial = Promise.withResolvers<void>()
  let totalCompleted = 0
  const initial = gate.publish('build', publicationBundle('initial-source-generation'), async () => {
    await releaseInitial.promise
    totalCompleted += 1
  })
  if (timing === 'before') {
    releaseInitial.resolve()
    await initial
  }
  const recovery = gate.publish('build', publicationBundle(marker), () => {
    totalCompleted += 1
  })
  try {
    expect(gate.started()).toBe(true)
    if (timing === 'during') {
      releaseInitial.resolve()
      await initial
    }
    expect(totalCompleted).toBe(1)
    expect(gate.completed()).toBe(0)
    gate.release()
    await recovery
    expect(gate.completed()).toBe(1)
    expect(totalCompleted).toBe(2)
  }
  finally {
    releaseInitial.resolve()
    gate.release()
    await Promise.all([initial, recovery])
  }
})

it('does not classify another host publication as the native recovery generation', async () => {
  const marker = 'recovered-source-generation'
  const gate = createTargetPublicationGate(marker)
  let totalCompleted = 0
  await gate.publish('dev', publicationBundle(marker), () => {
    totalCompleted += 1
  })
  expect(totalCompleted).toBe(1)
  expect(gate.started()).toBe(false)
  expect(gate.completed()).toBe(0)
  gate.release()
})
