/* eslint-disable */
// @ts-nocheck
// biome-ignore lint: disable
// oxlint-disable
// ------
// 由 weapp-vite 自动生成，请勿编辑。
declare module 'weapp-vite/typed-components' {
  export interface ComponentProps {
    AutoCard: {
      readonly customProp?: string;
      readonly enabled?: boolean;
      readonly mode?: string | number;
      readonly payload?: Record<string, any>;
      readonly score?: number | string;
      readonly tags?: any[];
      readonly title?: string;
    };
    NativeCard: {
      readonly anyValue?: any;
      readonly 'custom-prop'?: string;
      readonly items?: any[];
      readonly level?: number | string;
      readonly meta?: Record<string, any>;
      readonly title?: string;
      readonly visible?: boolean;
    };
    ResolverCard: Record<string, any>;
  }
  export type ComponentPropName = keyof ComponentProps;
  export type ComponentProp<Name extends string> = Name extends ComponentPropName ? ComponentProps[Name] : Record<string, any>;
  export const componentProps: ComponentProps;
}
