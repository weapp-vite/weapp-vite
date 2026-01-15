/* eslint-disable */
// @ts-nocheck
// biome-ignore lint: disable
// oxlint-disable
// ------
// 由 weapp-vite 自动生成，请勿编辑。
declare module 'weapp-vite/typed-components' {
  export interface ComponentProps {
    HelloWorld: {
      readonly description?: string;
      readonly docs?: string;
      readonly links?: any[];
      readonly title?: string;
    };
    OrderMetrics: {
      readonly metrics?: any[];
      readonly subtitle?: string;
      readonly title?: string;
    };
  }
  export type ComponentPropName = keyof ComponentProps;
  export type ComponentProp<Name extends string> = Name extends ComponentPropName ? ComponentProps[Name] : Record<string, any>;
  export const componentProps: ComponentProps;
}
