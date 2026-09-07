import type { HeadlessSession } from '../src'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { launch } from '../src/testing'
import { cleanupTempDirs, createBaseFixture } from './helpers'

describe('headless testing launch configuration', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    cleanupTempDirs(tempDirs)
  })

  it('awaits session configuration before app bootstrap', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    fs.writeFileSync(path.join(projectPath, 'dist/app.js'), `
App({
  onLaunch() {
    wx.setStorageSync('bootstrap-observed', wx.getStorageSync('configured-before-bootstrap'))
  },
})
`)
    let configuredSession: HeadlessSession | undefined
    const miniProgram = await launch({
      async configureSession(session) {
        configuredSession = session
        await Promise.resolve()
        session.getWx().setStorageSync('configured-before-bootstrap', 'ready')
      },
      projectPath,
    })

    try {
      expect(configuredSession?.getApp()).not.toBeNull()
      await expect(miniProgram.callWxMethod('getStorageSync', 'bootstrap-observed'))
        .resolves
        .toBe('ready')
    }
    finally {
      await miniProgram.close()
    }
  })

  it('closes the constructed session when async configuration fails', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    let configuredSession: HeadlessSession | undefined

    await expect(launch({
      async configureSession(session) {
        configuredSession = session
        await Promise.resolve()
        throw new Error('configuration failed')
      },
      projectPath,
    })).rejects.toThrow('configuration failed')
    expect(configuredSession?.isClosed).toBe(true)
  })

  it('closes the configured session when app bootstrap fails', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    fs.writeFileSync(
      path.join(projectPath, 'dist/app.js'),
      'throw new Error("bootstrap failed")\n',
    )
    let configuredSession: HeadlessSession | undefined

    await expect(launch({
      configureSession(session) {
        configuredSession = session
      },
      projectPath,
    })).rejects.toThrow('bootstrap failed')
    expect(configuredSession?.isClosed).toBe(true)
  })

  it('keeps unconfigured launch requests on the existing mock-only failure path', async () => {
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    const miniProgram = await launch({ projectPath })
    let failure: Error | undefined
    let completeCalls = 0

    try {
      await miniProgram.callWxMethod('request', {
        complete() {
          completeCalls += 1
        },
        fail(error: Error) {
          failure = error
        },
        url: 'http://127.0.0.1:54321/query/items',
      })
      expect(failure?.message).toContain('No request mock matched in headless runtime')
      expect(completeCalls).toBe(1)
    }
    finally {
      await miniProgram.close()
    }
  })
})
