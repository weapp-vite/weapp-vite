import { afterEach, expect, it, vi } from 'vitest'
import { createDevBuildCompletion } from './devBuildCompletion'

afterEach(() => vi.useRealTimers())

function createProcess() {
  const exit = Promise.withResolvers<never>()
  let output = 'restart begun\npublication complete\n'
  return {
    getOutput: () => output,
    append: (text: string) => { output += text },
    waitFor: <T>(task: Promise<T>) => Promise.race([task, exit.promise]),
    exit: (error: Error) => exit.reject(error),
  }
}

it('waits beyond old completions and partially visible output until this publication finishes', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const publication = createDevBuildCompletion(dev, { started: 'restart begun', completed: 'publication complete' })
  let finished = false
  const waiting = publication.wait().then(() => {
    finished = true
  })
  dev.append('restart begun\nnew page and control file visible\n')
  await vi.advanceTimersByTimeAsync(50)
  expect(finished).toBe(false)
  dev.append('publication com')
  await vi.advanceTimersByTimeAsync(50)
  expect(finished).toBe(false)
  dev.append('plete\n')
  await vi.advanceTimersByTimeAsync(25)
  await waiting
  expect(finished).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it('does not use an intermediate completion when another restart has already begun', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const publication = createDevBuildCompletion(dev, { started: 'restart begun', completed: 'publication complete' })
  dev.append('restart begun\npublication complete\nrestart begun\n')
  let finished = false
  const waiting = publication.wait().then(() => {
    finished = true
  })
  await vi.advanceTimersByTimeAsync(50)
  expect(finished).toBe(false)
  dev.append('publication complete\n')
  await vi.advanceTimersByTimeAsync(25)
  await waiting
  expect(vi.getTimerCount()).toBe(0)
})

it('retains a completion that arrived after capture but before waiting', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const publication = createDevBuildCompletion(dev, { completed: 'publication complete' })
  dev.append('publication complete\n')
  await publication.wait()
  expect(vi.getTimerCount()).toBe(0)
})

it('fails and removes polling when the process exits before publication', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const publication = createDevBuildCompletion(dev, { completed: 'publication complete' })
  const error = new Error('build process exited')
  const rejected = expect(publication.wait()).rejects.toBe(error)
  dev.append('build failed\n')
  dev.exit(error)
  await rejected
  expect(vi.getTimerCount()).toBe(0)
})

it('keeps failed builds failed when no completion arrives within the original deadline', async () => {
  vi.useFakeTimers()
  const dev = createProcess()
  const publication = createDevBuildCompletion(dev, { completed: 'publication complete' })
  const rejected = expect(publication.wait(100)).rejects.toThrow('Timed out waiting for current dev build')
  dev.append('build failed\n')
  await vi.advanceTimersByTimeAsync(100)
  await rejected
  expect(vi.getTimerCount()).toBe(0)
})
