import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOrUpdateProjectConfig } from '@/projectConfig'
import * as fsUtils from '@/utils/fs'
import { logger } from '../vitest.setup'

const defaultRelation = {
  packageJsonPath: './package.json',
  miniprogramNpmDistDir: './dist',
}

describe('projectConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates default project.config when missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-project-'))
    const config = await createOrUpdateProjectConfig({ root })
    const saved = await fs.readJSON(path.join(root, 'project.config.json'))

    expect(config.miniprogramRoot).toBe('dist/')
    expect(saved.setting.packNpmRelationList).toContainEqual(defaultRelation)
    expect(saved.setting.packNpmManually).toBe(true)
  })

  it('applies defaults to existing plugin project and fills missing relations', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-project-existing-'))
    await fs.outputJSON(path.join(root, 'project.config.json'), {
      compileType: 'plugin',
      setting: { packNpmRelationList: [] },
    })

    const updated = await createOrUpdateProjectConfig({
      root,
      cb(set) {
        set('appid', 'demo-appid')
      },
    })

    expect(updated.pluginRoot).toBe('dist-plugin')
    expect(updated.setting.packNpmRelationList).toContainEqual(defaultRelation)
    expect(updated.appid).toBe('demo-appid')
  })

  it('does not duplicate existing relations', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-project-relations-'))
    await fs.outputJSON(path.join(root, 'project.config.json'), {
      compileType: 'miniprogram',
      setting: {
        packNpmRelationList: [defaultRelation],
      },
    })

    const updated = await createOrUpdateProjectConfig({ root })
    expect(updated.setting.packNpmRelationList).toEqual([defaultRelation])
  })

  it('adds default relations when missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-project-missing-relations-'))
    await fs.outputJSON(path.join(root, 'project.config.json'), {
      setting: {},
    })

    const updated = await createOrUpdateProjectConfig({ root })
    expect(updated.setting.packNpmRelationList).toContainEqual(defaultRelation)
  })

  it('rethrows and logs on read failure', async () => {
    vi.spyOn(fsUtils, 'readJsonIfExists').mockRejectedValue(new Error('boom'))
    await expect(createOrUpdateProjectConfig({ root: os.tmpdir() })).rejects.toThrow('boom')
    expect(logger.error).toHaveBeenCalled()
  })
})
