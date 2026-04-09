import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import process from 'node:process'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveWevuConfigTempDir } from './wevuTempDir'

function getTempDirKey(fromDir: string) {
  return createHash('sha256')
    .update(path.normalize(fromDir))
    .digest('hex')
    .slice(0, 8)
}

describe('resolveWevuConfigTempDir', () => {
  afterEach(() => {
    delete process.env.WEAPP_VITE_WEVU_CONFIG_DIR
    vi.restoreAllMocks()
  })

  it('uses project cache dir by default when cwd exists', () => {
    const cwd = '/project'
    const projectCacheDir = path.join(cwd, '.weapp-vite', 'wevu-config')
    const fromDir = '/project/src/pages/index'

    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
    vi.spyOn(fs, 'existsSync').mockImplementation(target => target === cwd)

    expect(resolveWevuConfigTempDir(fromDir)).toBe(
      path.join(projectCacheDir, getTempDirKey(fromDir)),
    )
  })

  it('uses WEAPP_VITE_WEVU_CONFIG_DIR env when set', () => {
    const fromDir = '/project/src/pages/index'
    process.env.WEAPP_VITE_WEVU_CONFIG_DIR = '/custom/cache'

    expect(resolveWevuConfigTempDir(fromDir)).toBe(
      path.join('/custom/cache', getTempDirKey(fromDir)),
    )
  })

  it('trims whitespace from WEAPP_VITE_WEVU_CONFIG_DIR', () => {
    const fromDir = '/project/src/pages/index'
    process.env.WEAPP_VITE_WEVU_CONFIG_DIR = '  /custom/cache  '

    expect(resolveWevuConfigTempDir(fromDir)).toBe(
      path.join('/custom/cache', getTempDirKey(fromDir)),
    )
  })

  it('ignores empty WEAPP_VITE_WEVU_CONFIG_DIR', () => {
    const cwd = '/project'
    const fromDir = '/project/src/pages/index'
    process.env.WEAPP_VITE_WEVU_CONFIG_DIR = '   '

    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)

    expect(resolveWevuConfigTempDir(fromDir)).toBe(
      path.join(os.tmpdir(), 'weapp-vite', 'wevu-config', getTempDirKey(fromDir)),
    )
  })

  it('falls back to tmp dir when cwd does not exist', () => {
    const cwd = '/project'
    const fromDir = '/project/src/pages/index'

    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)

    expect(resolveWevuConfigTempDir(fromDir)).toBe(
      path.join(os.tmpdir(), 'weapp-vite', 'wevu-config', getTempDirKey(fromDir)),
    )
  })
})
