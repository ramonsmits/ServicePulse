// This can be directly added to any of your `.ts` files like `router.ts`
// It can also be added to a `.d.ts` file. Make sure it's included in
// project's tsconfig.json "files"
import "vue-router";

// To ensure it is treated as a module, add at least one `export` statement
export {};

declare module "vue-router" {
  interface RouteMeta {
    title: string;
    allowAnonymous?: boolean;
    /** Gate this route behind a single permission — user must hold it to navigate here. */
    requiredPermission?: string;
    /** Gate this route behind any of these permissions — user must hold at least one. */
    requiredAnyPermission?: string[];
  }
}
