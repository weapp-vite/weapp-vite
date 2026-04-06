import { mockIp, mockReqId } from '../../../utils/mock'

export interface TrackingCompany {
  name: string
  code: string
}

export interface TrackingSubmitParams {
  rightsNo: string
  logisticsCompanyCode: string
  logisticsCompanyName: string
  logisticsNo: string
  remark: string
}

interface BasicResponse<T> {
  data: T
  code: string
  msg: string | null
  requestId: string
  clientIp: string
  rt: number
  success: boolean
}

export function create(_params?: TrackingSubmitParams) {
  const _resq = {
    data: null,
    code: 'Success',
    msg: null,
    requestId: mockReqId(),
    clientIp: mockIp(),
    rt: 79,
    success: true,
  }
  return Promise.resolve(_resq satisfies BasicResponse<null>)
}

export function update(_params?: TrackingSubmitParams) {
  const _resq = {
    data: null,
    code: 'Success',
    msg: null,
    requestId: mockReqId(),
    clientIp: mockIp(),
    rt: 79,
    success: true,
  }
  return Promise.resolve(_resq satisfies BasicResponse<null>)
}

export function getDeliverCompanyList() {
  const _resq = {
    data: [
      {
        name: '中通快递',
        code: '0001',
      },
      {
        name: '申通快递',
        code: '0002',
      },
      {
        name: '圆通快递',
        code: '0003',
      },
      {
        name: '顺丰快递',
        code: '0004',
      },
      {
        name: '百世快递',
        code: '0005',
      },
      {
        name: '韵达快递',
        code: '0006',
      },
      {
        name: '邮政快递',
        code: '0007',
      },
      {
        name: '丰网快递',
        code: '0008',
      },
      {
        name: '顺丰直邮',
        code: '0009',
      },
    ],
  }
  return Promise.resolve(_resq satisfies { data: TrackingCompany[] })
}
