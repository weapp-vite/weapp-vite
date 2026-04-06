import type { RightsListResult } from '../after-service-list/api'
import dayjs from 'dayjs'
import { mockIp, mockReqId } from '../../../utils/mock'
import { resp } from '../after-service-list/api'

export function formatTime(date: string | number | Date, template: string) {
  return dayjs(date).format(template)
}

export function getRightsDetail({ rightsNo }: { rightsNo?: string }) {
  const _resq = {
    data: [] as RightsListResult['data']['dataList'],
    code: 'Success',
    msg: null,
    requestId: mockReqId(),
    clientIp: mockIp(),
    rt: 79,
    success: true,
  }
  _resq.data
    = resp.data.dataList.filter(item => item.rights.rightsNo === rightsNo)
      || {}
  return Promise.resolve(_resq)
}

export type RightsDetailResult = Awaited<ReturnType<typeof getRightsDetail>>

export function cancelRights(_params?: { rightsNo?: string }) {
  const _resq = {
    data: {},
    code: 'Success',
    msg: null,
    requestId: mockReqId(),
    clientIp: mockIp(),
    rt: 79,
    success: true,
  }
  return Promise.resolve(_resq)
}
