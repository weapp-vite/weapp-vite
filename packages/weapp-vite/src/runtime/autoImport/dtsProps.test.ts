import { describe, expect, it } from 'vitest'
import { extractComponentPropsFromDts } from './dtsProps'

describe('extractComponentPropsFromDts', () => {
  it('extracts from class properties type literal', () => {
    const code = `
export default class ActionSheet {
  properties: {
    align?: { type: StringConstructor; value?: "left" | "center" };
    count?: { type: NumberConstructor; value?: number };
    popupProps?: { type: ObjectConstructor; value?: import("../popup").TdPopupProps };
  };
}
`
    expect(Object.fromEntries(extractComponentPropsFromDts(code))).toEqual({
      align: '"left" | "center"',
      count: 'number',
      popupProps: 'Record<string, any>',
    })
  })

  it('extracts from props-like interface members', () => {
    const code = `
import { BadgeProps } from '../badge/index';
export interface TdAvatarProps {
  badgeProps?: { type: ObjectConstructor; value?: BadgeProps };
  bordered?: { type: BooleanConstructor; value?: boolean };
  size?: { type: StringConstructor; value?: 'small' | 'medium' };
}
export interface AvatarItem { label: string }
`
    expect(Object.fromEntries(extractComponentPropsFromDts(code))).toEqual({
      badgeProps: 'BadgeProps',
      bordered: 'boolean',
      size: '\'small\' | \'medium\'',
    })
  })

  it('skips non-config interfaces and finds the next config interface', () => {
    const code = `
export interface Item { label: string; disabled?: boolean }
export interface TdActionSheetProps {
  items: { type: ArrayConstructor; value?: Array<string | Item>; required?: boolean };
  visible?: { type: BooleanConstructor; value?: boolean };
}
`
    expect(Object.fromEntries(extractComponentPropsFromDts(code))).toEqual({
      items: 'Array<string | Item>',
      visible: 'boolean',
    })
  })

  it('prefers interface properties and skips following class declarations', () => {
    const code = `
export interface FirstHit {
  properties: {
    status?: { type: StringConstructor; value?: 'ok' | 'fail' };
  };
}

export default class LaterClass {
  notTarget: { type: NumberConstructor };
  properties: {
    count?: { type: NumberConstructor; value?: number };
  };
}
`

    expect(Object.fromEntries(extractComponentPropsFromDts(code))).toEqual({
      status: '\'ok\' | \'fail\'',
    })
  })

  it('extracts from class properties after skipping methods and non-target fields', () => {
    const code = `
export default class FromClass {
  setup() {}
  data: { type: StringConstructor };
  properties: {
    1?: { type: NumberConstructor; value?: number };
    mode?: { type: StringConstructor | null };
  };
}
`

    expect(Object.fromEntries(extractComponentPropsFromDts(code))).toEqual({
      1: 'number',
      mode: 'string | any',
    })
  })
})
