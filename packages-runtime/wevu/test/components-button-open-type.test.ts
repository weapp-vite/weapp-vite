import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

interface ComponentAttr {
  name: string
  jsxName?: string
  enum?: Array<{ value: string }>
}

interface ComponentMeta {
  name: string
  attrs?: ComponentAttr[]
}

const componentsPath = path.resolve(import.meta.dirname, '../components.weapp.json')
const intrinsicPath = path.resolve(import.meta.dirname, '../src/weappIntrinsicElements/elements/button.ts')

async function readComponents(): Promise<ComponentMeta[]> {
  const content = await readFile(componentsPath, 'utf8')
  return JSON.parse(content) as ComponentMeta[]
}

function getButtonComponent(components: ComponentMeta[]) {
  const button = components.find(component => component.name === 'button')
  if (!button) {
    throw new Error('button component metadata not found')
  }
  if (!button.attrs) {
    throw new Error('button component attributes not found')
  }
  return button
}

describe('button open-type metadata', () => {
  it('keeps open-type enum in sync with docs', async () => {
    const components = await readComponents()
    const button = getButtonComponent(components)
    const openType = button.attrs?.find(attr => attr.name === 'open-type')

    expect(openType).toBeTruthy()
    const values = openType?.enum?.map(entry => entry.value)
    expect(values).toEqual([
      'contact',
      'liveActivity',
      'share',
      'getPhoneNumber',
      'getRealtimePhoneNumber',
      'getUserInfo',
      'launchApp',
      'openSetting',
      'feedback',
      'chooseAvatar',
      'agreePrivacyAuthorization',
    ])
  })

  it('exposes source event metadata in components.weapp.json', async () => {
    const components = await readComponents()
    const button = getButtonComponent(components)
    const attrsByHostName = new Map(button.attrs?.map(attr => [attr.name, attr]))
    const expected = {
      bindchooseavatar: 'onChooseAvatar',
      bindagreeprivacyauthorization: 'onAgreePrivacyAuthorization',
      bindgetrealtimephonenumber: 'onGetRealtimePhoneNumber',
      bindlaunchapp: 'onLaunchApp',
      createliveactivity: 'onCreateLiveActivity',
    }

    for (const [hostName, sourceName] of Object.entries(expected)) {
      expect(attrsByHostName.get(hostName)?.jsxName).toBe(sourceName)
    }
  })

  it('generates intrinsic elements for open-type values and handlers', async () => {
    const content = await readFile(intrinsicPath, 'utf8')
    const values = [
      'liveActivity',
      'getRealtimePhoneNumber',
      'chooseAvatar',
      'agreePrivacyAuthorization',
    ]
    const handlers = [
      'onChooseAvatar',
      'onAgreePrivacyAuthorization',
      'onGetRealtimePhoneNumber',
      'onLaunchApp',
      'onCreateLiveActivity',
    ]

    for (const value of values) {
      expect(content).toContain(`'${value}'`)
    }
    for (const handler of handlers) {
      expect(content).toContain(`${handler}?:`)
    }
  })
})
