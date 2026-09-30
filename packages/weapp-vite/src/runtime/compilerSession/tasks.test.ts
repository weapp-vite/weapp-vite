import { describe, expect, it } from 'vitest'
import { waitForBuildTasks } from './tasks'

describe('parallel build lifetime', () => {
  it.each(['npm', 'worker', 'projectConfig'])('does not return a compiler failure while %s is still writing', async () => {
    const compilerError = new Error('invalid syntax')
    const copy = Promise.withResolvers<void>()
    let finished = false
    const result = waitForBuildTasks([Promise.reject(compilerError), copy.promise])
      .catch((error: unknown) => {
        finished = true
        return error
      })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(finished).toBe(false)
    copy.resolve()
    expect(await result).toBe(compilerError)
  })
  it('observes an early auxiliary failure while allowing the bundler to finish', async () => {
    const bundler = Promise.withResolvers<string>()
    const npmError = new Error('npm failed')
    let finished = false
    const result = waitForBuildTasks([bundler.promise, Promise.reject(npmError)])
      .catch((error: unknown) => {
        finished = true
        return error
      })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(finished).toBe(false)
    bundler.resolve('bundle')
    expect(await result).toBe(npmError)
  })
  it('drains secondary failures without replacing the primary diagnostic', async () => {
    const compilerError = new Error('invalid syntax')
    await expect(waitForBuildTasks([Promise.reject(compilerError), Promise.reject(new Error('copy failed'))])).rejects.toBe(compilerError)
    await expect(waitForBuildTasks([Promise.resolve('bundle'), Promise.resolve()])).resolves.toEqual(['bundle', undefined])
  })
})
