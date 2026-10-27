import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'

export const group = 'standard'
export const order = 44

export function registerGithubIssuesBuildCase() {
  it('issue #627: compiles class/style defineProps probe', async () => {
    await runBuild()

    const pageWxmlPath = path.join(DIST_ROOT, 'pages/issue-627/index.wxml')
    const pageJsPath = path.join(DIST_ROOT, 'pages/issue-627/index.js')
    const pageJsonPath = path.join(DIST_ROOT, 'pages/issue-627/index.json')
    const nativePageWxmlPath = path.join(DIST_ROOT, 'pages/issue-627-native/index.wxml')
    const nativePageJsPath = path.join(DIST_ROOT, 'pages/issue-627-native/index.js')
    const nativePageJsonPath = path.join(DIST_ROOT, 'pages/issue-627-native/index.json')
    const sfcHostPageWxmlPath = path.join(DIST_ROOT, 'pages/issue-627-sfc-host/index.wxml')
    const sfcHostPageJsPath = path.join(DIST_ROOT, 'pages/issue-627-sfc-host/index.js')
    const sfcHostPageJsonPath = path.join(DIST_ROOT, 'pages/issue-627-sfc-host/index.json')
    const componentWxmlPath = path.join(DIST_ROOT, 'components/issue-627/ReservedPropsProbe/index.wxml')
    const componentJsPath = path.join(DIST_ROOT, 'components/issue-627/ReservedPropsProbe/index.js')
    const nativeComponentWxmlPath = path.join(DIST_ROOT, 'components/issue-627/native-props-probe/index.wxml')
    const nativeComponentJsPath = path.join(DIST_ROOT, 'components/issue-627/native-props-probe/index.js')

    const pageWxml = await fs.readFile(pageWxmlPath, 'utf-8')
    const pageJs = await fs.readFile(pageJsPath, 'utf-8')
    const pageJson = await fs.readJSON(pageJsonPath) as {
      usingComponents?: Record<string, string>
    }
    const nativePageWxml = await fs.readFile(nativePageWxmlPath, 'utf-8')
    const nativePageJs = await fs.readFile(nativePageJsPath, 'utf-8')
    const nativePageJson = await fs.readJSON(nativePageJsonPath) as {
      usingComponents?: Record<string, string>
    }
    const sfcHostPageWxml = await fs.readFile(sfcHostPageWxmlPath, 'utf-8')
    const sfcHostPageJs = await fs.readFile(sfcHostPageJsPath, 'utf-8')
    const sfcHostPageJson = await fs.readJSON(sfcHostPageJsonPath) as {
      usingComponents?: Record<string, string>
    }
    const componentWxml = await fs.readFile(componentWxmlPath, 'utf-8')
    const componentJs = await fs.readFile(componentJsPath, 'utf-8')
    const nativeComponentWxml = await fs.readFile(nativeComponentWxmlPath, 'utf-8')
    const nativeComponentJs = await fs.readFile(nativeComponentJsPath, 'utf-8')

    expect(pageWxml).toContain('issue-627 reserved props')
    expect(pageJson.usingComponents?.['reserved-props-probe']).toBe('/components/issue-627/ReservedPropsProbe/index')
    expect(pageJs).toContain('readProbe("#issue627-sfc-probe-literal")')
    expect(pageJs).toContain('readProbe("#issue627-sfc-probe-dynamic")')
    expect(pageWxml).toContain('class="issue-627-class-prop"')
    expect(pageWxml).toContain('style="color: rgb(22 119 255);"')
    expect(pageWxml).toContain('id="issue627-sfc-probe-literal"')
    expect(pageWxml).toContain('id="issue627-sfc-probe-dynamic"')
    expect(componentWxml).toContain('data-issue627-class="{{props.class}}"')
    expect(componentWxml).toContain('data-issue627-style="{{props.style}}"')
    expect(componentJs).toContain('props: {')
    expect(componentJs).toContain('class: {')
    expect(componentJs).toContain('style: {')
    expect(componentJs).toContain('expose({ _runE2E })')

    expect(nativePageJs).toContain('issue-627 native reserved props')
    expect(nativePageWxml).toContain('issue627-native-title')
    expect(nativePageWxml).toContain('class="issue-627-native-class-prop"')
    expect(nativePageWxml).toContain('style="color: rgb(22, 119, 255);"')
    expect(nativePageJs).toContain('selectComponent?.("#issue627-native-probe")')
    expect(nativePageJson.usingComponents?.['native-props-probe']).toBe('/components/issue-627/native-props-probe/index')
    expect(nativeComponentWxml).toContain('data-issue627-native-class="{{class}}"')
    expect(nativeComponentWxml).toContain('data-issue627-native-style="{{style}}"')
    expect(nativeComponentJs).toContain('"class": String')
    expect(nativeComponentJs).toContain('"style": String')
    expect(nativeComponentJs).toContain('"hidden": Boolean')
    expect(nativeComponentJs).toContain('"dataFoo": String')
    expect(nativeComponentJs).toContain('"data-foo": String')
    expect(nativeComponentJs).toContain('"markFoo": String')
    expect(nativeComponentJs).toContain('"mark:foo": String')
    expect(nativeComponentJs).toContain('"slot": String')

    expect(sfcHostPageJs).toContain('issue-627 sfc host reserved props')
    expect(sfcHostPageJs).toContain('selectComponent?.("#issue627-sfc-host-literal")')
    expect(sfcHostPageJson.usingComponents?.ReservedPropsProbe).toBe('/components/issue-627/ReservedPropsProbe/index')
    expect(sfcHostPageWxml).toContain('class="issue-627-sfc-host-class-prop"')
    expect(sfcHostPageWxml).toContain('style="color: rgb(22, 119, 255);"')
    expect(sfcHostPageWxml).toContain('class="issue-627-sfc-host-dynamic-class"')
    expect(sfcHostPageWxml).toContain('style="font-size: 32rpx;"')
  })
}
