import { wpi } from '@weapp-core/api'
import { expectError, expectType } from 'tsd'

async function verifyWechat53Methods() {
  expectType<WechatMiniprogram.CopyRealnameSuccessCallbackResult>(await wpi.copyRealname({ extraData: { orderId: 'order' } }))
  const trace = await wpi.getStoreTraceId()
  expectType<WechatMiniprogram.GetStoreTraceIdSuccessCallbackResult>(trace)
  expectType<string>(trace.traceId)
  expectType<number>(trace.requireOrder)
  expectType<number>(trace.requiredFundType)
  expectType<WechatMiniprogram.OpenPhotoTopicViewSuccessCallbackResult>(await wpi.openPhotoTopicView({ queryString: 'topic=example' }))
  expectType<WechatMiniprogram.GeneralCallbackResult>(await wpi.requestAutomaticRepayment({ presignToken: 'token' }))
  expectType<WechatMiniprogram.GeneralCallbackResult>(await wpi.saveMediaToPhotosAlbum({ filePaths: ['media/image.png'], mediaTypes: ['image'] }))
  expectType<WechatMiniprogram.GeneralCallbackResult>(await wpi.verifyHKPaymentPassword({ package: '{}' }))
}
void verifyWechat53Methods

expectType<void>(wpi.getStoreTraceId({
  success: result => expectType<WechatMiniprogram.GetStoreTraceIdSuccessCallbackResult>(result),
}))
expectError(wpi.copyRealname({}))
expectError(wpi.requestAutomaticRepayment({ presignToken: 1 }))
expectError(wpi.saveMediaToPhotosAlbum({ mediaTypes: ['audio'] }))
expectError(wpi.verifyHKPaymentPassword({}))
