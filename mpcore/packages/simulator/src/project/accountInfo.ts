import type { HeadlessWxAccountInfo } from '../host/wx/account'
import type { HeadlessProjectDescriptor } from './createProjectDescriptor'

export function createDefaultAccountInfo(project: Pick<HeadlessProjectDescriptor, 'projectConfigFiles'>): HeadlessWxAccountInfo {
  let appId = ''
  for (const config of [...project.projectConfigFiles].reverse()) {
    const value = config.value.appid
    if (typeof value === 'string' && value.trim()) {
      appId = value.trim()
      break
    }
  }
  return { miniProgram: { appId, envVersion: 'develop', version: '' } }
}
