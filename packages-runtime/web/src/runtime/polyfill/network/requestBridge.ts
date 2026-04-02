import type { DownloadFileOptions, RequestOptions, UploadFileOptions } from '../types/common'
import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from '../async'
import {
  performDownloadByFetch,
  performRequestByFetch,
  performUploadByFetch,
} from './request'

export async function requestByFetchBridge(options?: RequestOptions) {
  try {
    const response = await performRequestByFetch(options)
    return callWxAsyncSuccess(options, {
      errMsg: 'request:ok',
      data: response.data,
      statusCode: response.statusCode,
      header: response.header,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Promise.reject(callWxAsyncFailure(options, `request:fail ${message}`))
  }
}

export async function downloadFileByFetchBridge(options?: DownloadFileOptions) {
  try {
    const response = await performDownloadByFetch(options)
    return callWxAsyncSuccess(options, {
      errMsg: 'downloadFile:ok',
      tempFilePath: response.tempFilePath,
      statusCode: response.statusCode,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Promise.reject(callWxAsyncFailure(options, `downloadFile:fail ${message}`))
  }
}

export async function uploadFileByFetchBridge(options?: UploadFileOptions) {
  try {
    const response = await performUploadByFetch(options)
    return callWxAsyncSuccess(options, {
      errMsg: 'uploadFile:ok',
      data: response.data,
      statusCode: response.statusCode,
      header: response.header,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Promise.reject(callWxAsyncFailure(options, `uploadFile:fail ${message}`))
  }
}
