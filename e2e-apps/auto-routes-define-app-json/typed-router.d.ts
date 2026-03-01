/* eslint-disable */
// biome-ignore lint: disable
// oxlint-disable
// ------
// 由 weapp-vite 自动生成，请勿编辑。
declare module 'weapp-vite/auto-routes' {
    export type AutoRoutesPages = [
        "pages/dashboard/index",
        "pages/detail/index",
        "pages/home/index",
        "pages/logs/index"
    ];
    export type AutoRoutesEntries = [
        "pages/dashboard/index",
        "pages/detail/index",
        "pages/home/index",
        "pages/logs/index",
        "subpackages/lab/pages/state-playground/index",
        "subpackages/marketing/pages/campaign/index"
    ];
    export type AutoRoutesSubPackages = [
        {
            readonly root: "subpackages/lab";
            readonly pages: [
                "pages/state-playground/index"
            ];
        },
        {
            readonly root: "subpackages/marketing";
            readonly pages: [
                "pages/campaign/index"
            ];
        }
    ];
    export type AutoRoutesSubPackage = AutoRoutesSubPackages[number];
    export interface AutoRoutes {
        readonly pages: AutoRoutesPages;
        readonly entries: AutoRoutesEntries;
        readonly subPackages: AutoRoutesSubPackages;
    }
    export const routes: AutoRoutes;
    export const pages: AutoRoutesPages;
    export const entries: AutoRoutesEntries;
    export const subPackages: AutoRoutesSubPackages;
    export default routes;
}
