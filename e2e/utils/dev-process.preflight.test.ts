import { expect, it, vi } from 'vitest'
import { startDevProcess } from './dev-process'

const mocks = vi.hoisted(() => ({ execute: vi.fn(), trace: vi.fn(), preflight: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.execute }))
vi.mock('./devProcessTrace', () => ({ createDevProcessTrace: mocks.trace }))
vi.mock('./devProcessCleanup/windowsKernelArtifact', () => ({ assertWindowsKernelInspectorReady: mocks.preflight }))

it('fails before creating a trace or dispatching dev when the required tool is missing', () => {
  const failure = new Error('Run pnpm e2e:build-tools')
  mocks.preflight.mockImplementation(() => {
    throw failure
  })
  expect(() => startDevProcess('node', ['fixture.js'])).toThrow(failure)
  expect(mocks.execute).not.toHaveBeenCalled()
  expect(mocks.trace).not.toHaveBeenCalled()
})
