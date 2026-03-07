import type { WeapiMethodSupportMatrixItem } from '../types'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_4 } from './methodMatrixAddPhoneContactToOpenOfficialAccountChat'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_9 } from './methodMatrixCreateMediaContainerToSetInnerAudioOption'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_6 } from './methodMatrixCropImageToStartHCE'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_3 } from './methodMatrixGetLogManagerToAddPhoneCalendar'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_5 } from './methodMatrixOpenOfficialAccountProfileToCreateBLEConnection'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_2 } from './methodMatrixRequestSubscribeEmployeeMessageToGetBatteryInfoSync'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_1 } from './methodMatrixShowToastToRequestSubscribeDeviceMessage'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_7 } from './methodMatrixStartLocalServiceDiscoveryToUpdateVoIPChatMuteConfig'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_8 } from './methodMatrixUpdateWeChatAppToCreateMediaAudioPlayer'

export const WEAPI_METHOD_SUPPORT_MATRIX: readonly WeapiMethodSupportMatrixItem[] = [
  ...WEAPI_METHOD_SUPPORT_MATRIX_PART_1,
  ...WEAPI_METHOD_SUPPORT_MATRIX_PART_2,
  ...WEAPI_METHOD_SUPPORT_MATRIX_PART_3,
  ...WEAPI_METHOD_SUPPORT_MATRIX_PART_4,
  ...WEAPI_METHOD_SUPPORT_MATRIX_PART_5,
  ...WEAPI_METHOD_SUPPORT_MATRIX_PART_6,
  ...WEAPI_METHOD_SUPPORT_MATRIX_PART_7,
  ...WEAPI_METHOD_SUPPORT_MATRIX_PART_8,
  ...WEAPI_METHOD_SUPPORT_MATRIX_PART_9,
]
