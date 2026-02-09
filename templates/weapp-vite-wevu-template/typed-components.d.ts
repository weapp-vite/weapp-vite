/* eslint-disable */
// @ts-nocheck
// biome-ignore lint: disable
// oxlint-disable
// ------
// 由 weapp-vite 自动生成，请勿编辑。
declare module 'weapp-vite/typed-components' {
  export interface ComponentProps {
    HelloWorld: {
      readonly compact?: boolean;
      readonly features?: any[];
      readonly highlights?: any[];
      readonly subtitle?: string;
      readonly title?: string;
    };
    Navbar: {
      readonly dense?: boolean;
      readonly pills?: any[];
      readonly status?: string;
      readonly subtitle?: string;
      readonly title?: string;
    };
  }
  export type ComponentPropName = keyof ComponentProps;
  export type ComponentProp<Name extends string> = Name extends ComponentPropName ? ComponentProps[Name] : Record<string, any>;
  export const componentProps: ComponentProps;
}
