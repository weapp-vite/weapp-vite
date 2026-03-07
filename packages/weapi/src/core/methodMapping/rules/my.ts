import type { WeapiMethodMappingRule } from '../types'
import { MY_METHOD_MAPPINGS_PART_2 } from './myBindEmployeeRelationToSendHCEMessage'
import { MY_METHOD_MAPPINGS_PART_4 } from './myCreateVKSessionToOffBLEConnectionStateChange'
import { MY_METHOD_MAPPINGS_PART_3 } from './mySendSmsToOpenCustomerServiceChat'
import { MY_METHOD_MAPPINGS_PART_1 } from './myShowToastToAuthPrivateMessage'

export const MY_METHOD_MAPPINGS: Readonly<Record<string, WeapiMethodMappingRule>> = {
  ...MY_METHOD_MAPPINGS_PART_1,
  ...MY_METHOD_MAPPINGS_PART_2,
  ...MY_METHOD_MAPPINGS_PART_3,
  ...MY_METHOD_MAPPINGS_PART_4,
}
