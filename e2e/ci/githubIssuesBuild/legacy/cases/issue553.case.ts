import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 22

export function registerGithubIssuesBuildCase() {
  it('issue #553: maps component v-model arguments to the matching prop and update event', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-553/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-553/index.js')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-553/ModelArgumentProbe/index.wxml')
    const componentJsPath = path.join(DIST_ROOT, 'components/issue-553/ModelArgumentProbe/index.js')
    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')
    const componentJs = await fs.readFile(componentJsPath, 'utf-8')

    expect(pageWxml).toContain('<model-argument-probe')
    expect(pageWxml).toContain('abc="{{abc}}"')
    expect(pageWxml).toContain('model-value="{{modelValue}}"')
    expect(pageWxml).toContain('bind:update-abc="__weapp_vite_inline"')
    expect(pageWxml).toContain('bind:update-modelvalue="__weapp_vite_inline"')
    expect(pageWxml).not.toContain('abc="{{modelValue}}"')
    expect(pageWxml).not.toContain('model-value="{{abc}}"')
    expect(pageJs).toContain('_runE2E')
    expect(pageJs).toContain('abc-seed')
    expect(pageJs).toContain('model-seed')
    expect(componentWxml).toContain('child abc = {{abcModel}}')
    expect(componentWxml).toContain('child model = {{defaultModel}}')
    expect(componentWxml).toContain('issue553-update-abc')
    expect(componentWxml).toContain('issue553-update-model')
    expect(componentWxml).toContain('bindtap="__weapp_vite_inline"')
    expect(componentWxml).toContain('data-wi-tap=')
    expect(componentJs).toContain('updateAbc')
    expect(componentJs).toContain('updateModelValue')
  })
}
