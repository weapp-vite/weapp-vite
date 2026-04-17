import type { DownloadFileOptions, RequestOptions, UploadFileOptions } from '../types/common'
import {
  callMiniProgramAsyncFailure,
  callMiniProgramAsyncSuccess,
} from '../async'
import {
  performDownloadByFetch,
  performRequestByFetch,
  performUploadByFetch,
} from './request'

export async function requestByFetchBridge(options?: RequestOptions) {
  try {
    const response = await performRequestByFetch(options)
    return callMiniProgramAsyncSuccess(options, {
      errMsg: 'request:ok',
      data: response.data,
      statusCode: response.statusCode,
      header: response.header,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Promise.reject(callMiniProgramAsyncFailure(options, `request:fail ${message}`))
  }
}

export async function downloadFileByFetchBridge(options?: DownloadFileOptions) {
  try {
    const response = await performDownloadByFetch(options)
    return callMiniProgramAsyncSuccess(options, {
      errMsg: 'downloadFile:ok',
      tempFilePath: response.tempFilePath,
      statusCode: response.statusCode,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Promise.reject(callMiniProgramAsyncFailure(options, `downloadFile:fail ${message}`))
  }
}

export async function uploadFileByFetchBridge(options?: UploadFileOptions) {
  try {
    const response = await performUploadByFetch(options)
    return callMiniProgramAsyncSuccess(options, {
      errMsg: 'uploadFile:ok',
      data: response.data,
      statusCode: response.statusCode,
      header: response.header,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Promise.reject(callMiniProgramAsyncFailure(options, `uploadFile:fail ${message}`))
  }
}
