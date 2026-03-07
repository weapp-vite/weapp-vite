import type { WeapiMethodMappingRule } from '../types'
import { TT_METHOD_MAPPINGS_PART_1 } from './ttPart1'
import { TT_METHOD_MAPPINGS_PART_2 } from './ttPart2'
import { TT_METHOD_MAPPINGS_PART_3 } from './ttPart3'
import { TT_METHOD_MAPPINGS_PART_4 } from './ttPart4'

export const TT_METHOD_MAPPINGS: Readonly<Record<string, WeapiMethodMappingRule>> = {
  ...TT_METHOD_MAPPINGS_PART_1,
  ...TT_METHOD_MAPPINGS_PART_2,
  ...TT_METHOD_MAPPINGS_PART_3,
  ...TT_METHOD_MAPPINGS_PART_4,
}
