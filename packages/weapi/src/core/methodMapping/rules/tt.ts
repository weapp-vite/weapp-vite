import type { WeapiMethodMappingRule } from '../types'
import { TT_METHOD_MAPPINGS_PART_2 } from './ttCanvasGetImageDataToSetTopBarText'
import { TT_METHOD_MAPPINGS_PART_4 } from './ttJoinVoIPChatToOffBLEConnectionStateChange'
import { TT_METHOD_MAPPINGS_PART_3 } from './ttSetWindowSizeToGetShareInfo'
import { TT_METHOD_MAPPINGS_PART_1 } from './ttShowToastToCanAddSecureElementPass'

export const TT_METHOD_MAPPINGS: Readonly<Record<string, WeapiMethodMappingRule>> = {
  ...TT_METHOD_MAPPINGS_PART_1,
  ...TT_METHOD_MAPPINGS_PART_2,
  ...TT_METHOD_MAPPINGS_PART_3,
  ...TT_METHOD_MAPPINGS_PART_4,
}
