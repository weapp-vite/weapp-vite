export interface HeadlessWxLoginSuccessResult {
  code: string
  errMsg: string
}

export interface HeadlessWxLoginFailResult {
  errMsg: string
}

export interface HeadlessWxLoginOption {
  timeout?: number
  success?: (result: HeadlessWxLoginSuccessResult) => void
  fail?: (result: HeadlessWxLoginFailResult) => void
  complete?: (result: HeadlessWxLoginSuccessResult | HeadlessWxLoginFailResult) => void
}

export interface HeadlessWxAccountInfo {
  miniProgram: {
    appId: string
    envVersion: 'develop' | 'trial' | 'release'
    version: string
  }
}
