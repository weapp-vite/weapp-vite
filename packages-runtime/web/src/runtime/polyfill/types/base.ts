export interface MiniProgramBaseResult {
  errMsg: string
}

export interface MiniProgramAsyncOptions<SuccessResult extends MiniProgramBaseResult> {
  success?: (result: SuccessResult) => void
  fail?: (result: MiniProgramBaseResult) => void
  complete?: (result: SuccessResult | MiniProgramBaseResult) => void
}

export type WxBaseResult = MiniProgramBaseResult
export type WxAsyncOptions<SuccessResult extends WxBaseResult> = MiniProgramAsyncOptions<SuccessResult>
