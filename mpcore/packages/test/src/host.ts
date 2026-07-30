import type { HeadlessSession } from '@mpcore/simulator'
import type { WxHostMock } from './types'

function asList<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

export function createWxMock(definition: WxHostMock = {}): WxHostMock {
  return definition
}

export function applyWxMock(session: HeadlessSession, definition: WxHostMock = {}) {
  asList(definition.actionSheet).forEach(item => session.mockActionSheet(item))
  asList(definition.downloadFile).forEach(item => session.mockDownloadFile(item))
  asList(definition.modal).forEach(item => session.mockModal(item))
  asList(definition.request).forEach(item => session.mockRequest(item))
  asList(definition.uploadFile).forEach(item => session.mockUploadFile(item))
}
