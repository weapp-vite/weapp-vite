import type { WeapiMethodMappingRule } from '../types'
import { MY_METHOD_MAPPINGS_PART_1 } from './myPart1'
import { MY_METHOD_MAPPINGS_PART_2 } from './myPart2'
import { MY_METHOD_MAPPINGS_PART_3 } from './myPart3'
import { MY_METHOD_MAPPINGS_PART_4 } from './myPart4'

export const MY_METHOD_MAPPINGS: Readonly<Record<string, WeapiMethodMappingRule>> = {
  ...MY_METHOD_MAPPINGS_PART_1,
  ...MY_METHOD_MAPPINGS_PART_2,
  ...MY_METHOD_MAPPINGS_PART_3,
  ...MY_METHOD_MAPPINGS_PART_4,
}
