/* eslint-disable */
// biome-ignore lint: disable
// oxlint-disable
// ------
// 由 weapp-vite 自动生成，请勿编辑。
import 'wevu/router';

declare module 'weapp-vite/auto-routes' {
    export type AutoRoutesPages = [
        "pages/index/index",
        "pages/native-uses-vue/index",
        "pages/router-coverage/index",
        "pages/router-coverage/main-target/index",
        "pages/router-dynamic/index",
        "pages/router-showcase/index",
        "pages/router-stability/index",
        "pages/router-stability/sub/index",
        "pages/router-stability/sub/target/index",
        "pages/router-stability/target/index",
        "pages/subpath-entries/index",
        "pages/use-attrs/index",
        "pages/use-model/index",
        "pages/use-provide-inject/index",
        "pages/use-slots/index",
        "pages/use-store/index"
    ];
    export type AutoRoutesEntries = [
        "pages/index/index",
        "packages/router-demo-independent/pages/independent-target/index",
        "packages/router-demo/pages/normal-target/index",
        "pages/native-uses-vue/index",
        "pages/router-coverage/index",
        "pages/router-coverage/main-target/index",
        "pages/router-dynamic/index",
        "pages/router-showcase/index",
        "pages/router-stability/index",
        "pages/router-stability/sub/index",
        "pages/router-stability/sub/target/index",
        "pages/router-stability/target/index",
        "pages/subpath-entries/index",
        "pages/use-attrs/index",
        "pages/use-model/index",
        "pages/use-provide-inject/index",
        "pages/use-slots/index",
        "pages/use-store/index"
    ];
    export type AutoRoutesSubPackages = [
        {
            readonly root: "packages/router-demo";
            readonly pages: [
                "pages/normal-target/index"
            ];
            [k: string]: unknown;
        },
        {
            readonly root: "packages/router-demo-independent";
            readonly pages: [
                "pages/independent-target/index"
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
