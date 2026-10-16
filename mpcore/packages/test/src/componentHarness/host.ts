import type { HeadlessProjectDescriptor } from '@mpcore/simulator'
import type { RenderComponentOptions } from '../types'
import type { createComponentEvents } from './events'
import path from 'node:path'
import { createMemoryArtifactSource, createOverlayArtifactSource, createProjectDescriptor } from '@mpcore/simulator'
import { createComponentOverrides, normalizeComponentPath } from '../overrides'
import { serializeComponentData } from './data'

export const COMPONENT_HOST_ROUTE = 'mpcore-test/component-host/index'
export const COMPONENT_SUBJECT_SELECTOR = '#mpcore-subject'

function createSlotMarkup(slots: Record<string, string>) {
  return Object.entries(slots).map(([name, content]) => {
    if (!/^[a-z_]\w*(?:-\w+)*$/i.test(name)) {
      throw new TypeError('Component slot names must be valid WXML attribute names.')
    }
    return name === 'default' ? content : `<block slot="${name}">${content}</block>`
  }).join('')
}

/** 宿主模板读取每轮订阅和属性名称，主体节点位置保持不变。 */
export function createComponentHostProject(
  project: HeadlessProjectDescriptor,
  componentPath: string,
  options: RenderComponentOptions,
  events: ReturnType<typeof createComponentEvents>,
) {
  const root = project.miniprogramRootPath
  const hostRoot = path.resolve(root, COMPONENT_HOST_ROUTE)
  const templatePath = `${hostRoot}.wxml`
  const propertyNames = new Set<string>()
  const addPropertyNames = (names: string[]) => {
    for (const name of names) {
      if (!/^[a-z_]\w*(?:-\w+)*$/i.test(name)) {
        throw new TypeError('Component property names must be valid WXML attribute names.')
      }
    }
    names.forEach(name => propertyNames.add(name))
  }
  addPropertyNames(Object.keys(options.properties ?? {}))
  const slots = createSlotMarkup(options.slots ?? {})
  const fixed = createMemoryArtifactSource([
    [path.resolve(root, 'app.json'), JSON.stringify({ pages: [COMPONENT_HOST_ROUTE] })],
    [path.resolve(root, 'app.js'), 'App({})\n'],
    [`${hostRoot}.json`, JSON.stringify({
      usingComponents: { 'mpcore-subject': `/${normalizeComponentPath(componentPath)}` },
    })],
    [`${hostRoot}.js`, `Page({
  data: { __mpcoreMounted: true, __mpcoreProperties: ${serializeComponentData(options.properties ?? {}, 'Component properties').replaceAll('<', '\\u003c')} },
  __mpcoreRecordEvent(event) { globalThis.__mpcoreRecordEvent(event.type, event.detail, event) }
})\n`],
  ])
  const hostSource = {
    has: (filePath: string) => filePath === templatePath || fixed.has(filePath),
    readText(filePath: string) {
      if (filePath !== templatePath) {
        return fixed.readText(filePath)
      }
      const propertyBindings = [...propertyNames].map(key => `${key}='{{__mpcoreProperties[${JSON.stringify(key)}]}}'`).join(' ')
      const eventBindings = events.names().map(name => `bind:${name}="__mpcoreRecordEvent"`).join(' ')
      return `<mpcore-subject wx:if="{{__mpcoreMounted}}" id="mpcore-subject" ${propertyBindings} ${eventBindings}>${slots}</mpcore-subject>`
    },
  }
  return {
    addPropertyNames,
    project: createProjectDescriptor({
      appConfig: { pages: [COMPONENT_HOST_ROUTE] },
      appConfigPath: path.resolve(root, 'app.json'),
      artifactSource: createOverlayArtifactSource(hostSource, createComponentOverrides(project, options.usingComponents)),
      miniprogramRoot: project.miniprogramRoot,
      miniprogramRootPath: root,
      plugins: project.plugins,
      projectConfigFiles: project.projectConfigFiles,
      projectPath: project.projectPath,
    }),
  }
}
