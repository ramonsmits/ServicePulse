import { createApp } from "vue";
import type { Router } from "vue-router";
import logger from "@/logger";
import AuthApp from "./AuthApp.vue";
import Toast, { TYPE, type PluginOptions, POSITION } from "vue-toastification";
import VueTippy from "vue-tippy";
import { createPinia } from "pinia";
import SimpleTypeahead from "vue3-simple-typeahead";
import { usePermissions } from "@/composables/usePermissions";
import { useShowToast } from "@/composables/toast";
import routeLinks from "@/router/routeLinks";

const toastOptions: PluginOptions = {
  position: POSITION.BOTTOM_RIGHT,
  timeout: 5000,
  transition: "Vue-Toastification__fade",
  hideProgressBar: true,
  containerClassName: "toast-container",
  toastClassName: "vue-toast",
  closeButtonClassName: "toast-close-button",
};

export function mount({ router }: { router: Router }) {
  router.beforeEach((to) => {
    document.title = to.meta.title || "ServicePulse";
  });

  // Permission guard — runs after the title guard so we always have a title to use in the toast.
  router.beforeEach(async (to) => {
    // Pre-auth routes (logged-out page, etc.) are always allowed.
    if (to.matched.some((r) => r.meta.allowAnonymous)) {
      return true;
    }

    const { can, canAny, ready } = usePermissions();

    // Wait for the descriptor to be loaded on the very first navigation.
    await ready;

    // Walk matched records from outermost → innermost; if any ancestor is gated and denied,
    // the child navigation is also blocked (parent permission gates the whole section).
    for (const record of to.matched) {
      const { requiredPermission, requiredAnyPermission } = record.meta;

      if (requiredPermission !== undefined) {
        if (!can(requiredPermission)) {
          const pageTitle = record.meta.title ?? "this page";
          useShowToast(TYPE.ERROR, "Access denied", `You do not have permission to access ${pageTitle}.`);
          logger.warn(`Navigation to "${record.path}" denied: missing permission "${requiredPermission}"`);
          return { path: routeLinks.dashboard };
        }
      }

      if (requiredAnyPermission !== undefined) {
        if (!canAny(requiredAnyPermission)) {
          const pageTitle = record.meta.title ?? "this page";
          useShowToast(TYPE.ERROR, "Access denied", `You do not have permission to access ${pageTitle}.`);
          logger.warn(`Navigation to "${record.path}" denied: missing any of permissions [${requiredAnyPermission.join(", ")}]`);
          return { path: routeLinks.dashboard };
        }
      }
    }

    return true;
  });

  const app = createApp(AuthApp);
  app.use(router).use(Toast, toastOptions).use(SimpleTypeahead).use(createPinia()).use(VueTippy);
  app.mount(`#app`);

  app.config.errorHandler = (err, instance) => {
    logger.error(instance, err);
  };

  return app;
}
