/* eslint-disable */
// biome-ignore lint: disable
// oxlint-disable
// ------
// 由 weapp-vite 自动生成，请勿编辑。
import 'wevu/router';

declare module 'weapp-vite/auto-routes' {
    export type AutoRoutesPages = [
        "pages/index/index"
    ];
    export type AutoRoutesEntries = [
        "pages/index/index",
        "packageA/pages/demo/index"
    ];
    export type AutoRoutesSubPackages = [
        {
            readonly root: "packageA";
            readonly pages: [
                "pages/demo/index"
            ];
            [k: string]: unknown;
        }
    ];
    export type AutoRoutesSubPackage = AutoRoutesSubPackages[number];
    export interface AutoRoutes {
        readonly pages: AutoRoutesPages;
        readonly entries: AutoRoutesEntries;
        readonly subPackages: AutoRoutesSubPackages;
    }
    export type AutoRouteEntry = AutoRoutesEntries[number];
    export type AutoRoutesRelativeUrl = `./${string}` | `../${string}`;
    export type AutoRoutesAbsoluteUrl<Path extends string> = Path | `/${Path}` | `${Path}?${string}` | `/${Path}?${string}`;
    export type AutoRoutesUrl = AutoRoutesAbsoluteUrl<AutoRouteEntry> | AutoRoutesRelativeUrl;
    export type AutoRouteNavigateOption = {
        readonly url: AutoRoutesUrl;
    } & Record<string, any>;
    export interface AutoRoutesWxRouter {
        switchTab: (option: AutoRouteNavigateOption) => unknown;
        reLaunch: (option: AutoRouteNavigateOption) => unknown;
        redirectTo: (option: AutoRouteNavigateOption) => unknown;
        navigateTo: (option: AutoRouteNavigateOption) => unknown;
        navigateBack: (option?: Record<string, any>) => unknown;
    }
    export const routes: AutoRoutes;
    export const pages: AutoRoutesPages;
    export const entries: AutoRoutesEntries;
    export const subPackages: AutoRoutesSubPackages;
    export const wxRouter: AutoRoutesWxRouter;
    export default routes;
}

declare module 'wevu/router' {
    interface WevuTypedRouterRouteMap {
        entries: import('weapp-vite/auto-routes').AutoRoutesEntries[number];
    }
}
