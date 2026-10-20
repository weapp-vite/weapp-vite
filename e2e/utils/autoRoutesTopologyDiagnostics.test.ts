import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCEPTANCE_REPORT_DIR_ENV } from '../scripts/domAcceptanceReport/helpers'
import { closeAutoRoutesTopologyResources, createAutoRoutesTopologyDiagnostics } from './autoRoutesTopologyDiagnostics'

let directory: string
let reportDirectory: string

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'auto-routes-diagnostics-'))
  reportDirectory = path.join(directory, 'reports')
  vi.stubEnv(ACCEPTANCE_REPORT_DIR_ENV, reportDirectory)
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
})

afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await rm(directory, { recursive: true, force: true })
})

function createDiagnostics(project: string, output: string) {
  return createAutoRoutesTopologyDiagnostics({
    project,
    profilePath: path.join(project, 'hmr-profile.jsonl'),
    routes: ['pages/added/index'],
    getDevOutput: () => output,
  })
}

async function readCapturedLog() {
  const parent = path.join(reportDirectory, 'diagnostics')
  const children = await readdir(parent)
  expect(children).toHaveLength(1)
  return readFile(path.join(parent, children[0]!, 'dev.log'), 'utf8')
}

describe('automatic route topology build-error evidence', () => {
  it('retains full multiline dev output even after runtime assertions pass', async () => {
    const project = await mkdtemp(path.join(directory, 'project-'))
    const output = `${'initial build output\n'.repeat(800)}[error] Build failed with 1 error:\n  src/pages/added/index.vue:1:0\n  ERROR: Could not read entry\ntrailing successful rebuild\n${project}/src/app.vue\n`
    const diagnostics = createDiagnostics(project, output)
    const host = { close: vi.fn(async () => {}) }
    const dev = {
      stop: vi.fn(async () => {}),
      getBuildErrors: () => ['[error] Build failed with 1 error:'],
    }

    await expect(closeAutoRoutesTopologyResources({ host, dev, diagnostics, project })).resolves.toBeUndefined()

    expect(await readCapturedLog()).toBe(output.replaceAll(project, '<project>'))
    expect(host.close).toHaveBeenCalledOnce()
    expect(dev.stop).toHaveBeenCalledOnce()
    await expect(readdir(project)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('does not create artifacts when captured diagnostics contain no build errors', async () => {
    const project = await mkdtemp(path.join(directory, 'project-'))
    const diagnostics = createDiagnostics(project, '[success] build completed\n')
    await closeAutoRoutesTopologyResources({
      dev: { stop: async () => {}, getBuildErrors: () => [] },
      diagnostics,
      project,
    })
    await expect(readdir(reportDirectory)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readdir(project)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('captures after stop drains its final diagnostics', async () => {
    const project = await mkdtemp(path.join(directory, 'project-'))
    const diagnostics = createDiagnostics(project, '[error] trailing build failure\n  detail after native exit\n')
    let errors: readonly string[] = []
    await closeAutoRoutesTopologyResources({
      dev: {
        stop: async () => { errors = ['[error] trailing build failure'] },
        getBuildErrors: () => errors,
      },
      diagnostics,
      project,
    })
    expect(await readCapturedLog()).toContain('detail after native exit')
  })

  it('preserves evidence and the original error when stop fails', async () => {
    const project = await mkdtemp(path.join(directory, 'project-'))
    const output = '[error] Build failed with 1 error:\n  ERROR: removed entry could not be read\n'
    const diagnostics = createDiagnostics(project, output)
    const stopError = new Error('owned process did not stop')
    const host = { close: vi.fn(async () => {}) }
    const closing = closeAutoRoutesTopologyResources({
      host,
      dev: {
        stop: async () => { throw stopError },
        getBuildErrors: () => ['[error] Build failed with 1 error:'],
      },
      diagnostics,
      project,
    })
    await expect(closing).rejects.toMatchObject({ errors: [stopError] })
    expect(host.close).toHaveBeenCalledOnce()
    expect(await readCapturedLog()).toBe(output)
    await expect(readdir(project)).resolves.toEqual([])
  })

  it('keeps original cleanup failures when evidence capture also fails', async () => {
    const hostError = new Error('host close failed')
    const stopError = new Error('stop failed')
    const captureError = new Error('capture failed')
    const stop = vi.fn(async () => {
      throw stopError
    })
    await expect(closeAutoRoutesTopologyResources({
      host: { close: () => { throw hostError } },
      dev: { stop, getBuildErrors: () => ['compile failure'] },
      diagnostics: { captureBuildErrors: async () => { throw captureError } },
    })).rejects.toMatchObject({ errors: [hostError, stopError, captureError] })
    expect(stop).toHaveBeenCalledOnce()
  })

  it('does not replace the cleanup error when the artifact destination is unavailable', async () => {
    const project = await mkdtemp(path.join(directory, 'project-'))
    await writeFile(reportDirectory, 'not a directory')
    const diagnostics = createDiagnostics(project, '[error] failure\n  original detail\n')
    const stopError = new Error('stop failed first')
    await expect(closeAutoRoutesTopologyResources({
      dev: {
        stop: async () => { throw stopError },
        getBuildErrors: () => ['[error] failure'],
      },
      diagnostics,
      project,
    })).rejects.toMatchObject({ errors: [stopError] })
  })
})
