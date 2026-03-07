import type { WeapiMethodSupportMatrixItem } from '../types'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_1 } from './methodMatrixPart1'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_2 } from './methodMatrixPart2'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_3 } from './methodMatrixPart3'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_4 } from './methodMatrixPart4'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_5 } from './methodMatrixPart5'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_6 } from './methodMatrixPart6'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_7 } from './methodMatrixPart7'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_8 } from './methodMatrixPart8'
import { WEAPI_METHOD_SUPPORT_MATRIX_PART_9 } from './methodMatrixPart9'

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
