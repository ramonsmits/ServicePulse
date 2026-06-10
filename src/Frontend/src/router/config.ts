import DashboardView from "@/views/DashboardView.vue";
import type { RouteComponent } from "vue-router";
import FailedMessagesView from "@/views/FailedMessagesView.vue";
import MonitoringView from "@/views/MonitoringView.vue";
import EventsView from "@/views/EventsView.vue";
import ConfigurationView from "@/views/ConfigurationView.vue";
import routeLinks from "@/router/routeLinks";
import CustomChecksView from "@/views/CustomChecksView.vue";
import HeartbeatsView from "@/views/HeartbeatsView.vue";
import ThroughputReportView from "@/views/ThroughputReportView.vue";
import AuditView from "@/views/AuditView.vue";
import LoggedOutView from "@/views/LoggedOutView.vue";

export interface RouteItem {
  path: string;
  alias?: string;
  redirect?: string;
  title: string;
  component?: RouteComponent | (() => Promise<RouteComponent>);
  children?: RouteItem[];
  allowAnonymous?: boolean;
  /** Gate this route behind a single permission — user must hold it to navigate here. */
  requiredPermission?: string;
  /** Gate this route behind any of these permissions — user must hold at least one. */
  requiredAnyPermission?: string[];
}

const config: RouteItem[] = [
  {
    path: routeLinks.loggedOut,
    component: LoggedOutView,
    title: "Signed Out",
    allowAnonymous: true,
  },
  {
    path: routeLinks.dashboard,
    component: DashboardView,
    title: "Dashboard",
  },
  {
    path: routeLinks.diagnostics,
    component: () => import("@/views/DiagnosticsView.vue"),
    title: "My Diagnostics",
    // No requiredPermission — any authenticated user can view their own diagnostics.
    // No allowAnonymous — must be authenticated.
  },
  {
    path: routeLinks.filteredMessages,
    component: () => import("@/views/FilteredMessagesView.vue"),
    title: "Filtered Failed Messages",
    requiredPermission: "messages:view",
  },
  {
    path: routeLinks.heartbeats.instances.template,
    component: () => import("@/components/heartbeats/EndpointInstances.vue"),
    title: "Endpoint Instances",
    requiredPermission: "heartbeats:view",
  },
  {
    path: routeLinks.heartbeats.root,
    component: HeartbeatsView,
    title: "Heartbeats",
    redirect: routeLinks.heartbeats.unhealthy.link,
    requiredPermission: "heartbeats:view",
    children: [
      {
        title: "Unhealthy Endpoints",
        path: routeLinks.heartbeats.unhealthy.link,
        component: () => import("@/components/heartbeats/UnhealthyEndpoints.vue"),
      },
      {
        title: "Healthy Endpoints",
        path: routeLinks.heartbeats.healthy.link,
        component: () => import("@/components/heartbeats/HealthyEndpoints.vue"),
      },
      {
        title: "Heartbeat Configuration",
        path: routeLinks.heartbeats.configuration.link,
        component: () => import("@/components/heartbeats/HeartbeatConfiguration.vue"),
      },
    ],
  },
  {
    path: routeLinks.messages.root,
    component: AuditView,
    title: "All Messages",
    requiredPermission: "messages:view",
  },
  {
    path: routeLinks.failedMessage.root,
    component: FailedMessagesView,
    title: "Failed Messages",
    redirect: routeLinks.failedMessage.failedMessagesGroups.link,
    requiredPermission: "messages:view",
    children: [
      {
        title: "Failed Message Groups",
        path: routeLinks.failedMessage.failedMessagesGroups.template,
        component: () => import("@/components/failedmessages/FailedMessageGroups.vue"),
      },
      {
        path: routeLinks.failedMessage.failedMessages.template,
        title: "All Failed Messages",
        component: () => import("@/components/failedmessages/FailedMessages.vue"),
      },
      {
        path: routeLinks.failedMessage.deletedMessagesGroup.template,
        title: "Deleted Message Groups",
        component: () => import("@/components/failedmessages/DeletedMessageGroups.vue"),
      },
      {
        path: routeLinks.failedMessage.deletedMessages.template,
        title: "All Deleted Messages",
        component: () => import("@/components/failedmessages/DeletedMessages.vue"),
      },
      {
        path: routeLinks.failedMessage.pendingRetries.template,
        title: "Pending Retries",
        component: () => import("@/components/failedmessages/PendingRetries.vue"),
      },
      {
        title: "Failed Messages",
        path: routeLinks.failedMessage.group.template,
        component: () => import("@/components/failedmessages/FailedMessages.vue"),
      },
      {
        title: "Deleted Messages",
        path: routeLinks.failedMessage.deletedGroup.template,
        component: () => import("@/components/failedmessages/DeletedMessages.vue"),
      },
      {
        path: routeLinks.failedMessage.message.template,
        title: "Message",
        redirect: routeLinks.messages.failedMessage.template,
      },
    ],
  },
  {
    path: routeLinks.messages.failedMessage.template,
    title: "Message",
    component: () => import("@/components/messages/MessageView.vue"),
    requiredPermission: "messages:view",
  },
  {
    path: routeLinks.messages.successMessage.template,
    title: "Message",
    component: () => import("@/components/messages/MessageView.vue"),
    requiredPermission: "messages:view",
  },
  {
    path: routeLinks.monitoring.root,
    component: MonitoringView,
    title: "Monitored Endpoints",
    requiredPermission: "monitoring:view",
  },
  {
    path: routeLinks.monitoring.endpointDetails.template,
    component: () => import("@/components/monitoring/EndpointDetails.vue"),
    title: "Endpoint Details",
    requiredPermission: "monitoring:view",
  },
  {
    path: routeLinks.customChecks,
    title: "Custom checks",
    component: CustomChecksView,
    requiredPermission: "customchecks:view",
  },
  {
    path: routeLinks.events,
    component: EventsView,
    title: "Events",
    requiredPermission: "eventlog:view",
  },
  {
    path: routeLinks.throughput.root,
    component: ThroughputReportView,
    title: "Usage",
    redirect: routeLinks.throughput.endpoints.root,
    requiredPermission: "throughput:view",
    children: [
      {
        title: "Endpoints",
        path: routeLinks.throughput.endpoints.root,
        redirect: routeLinks.throughput.endpoints.detectedEndpoints.link,
        component: () => import("@/views/throughputreport/EndpointsView.vue"),
        children: [
          {
            title: "Detected Endpoints",
            path: routeLinks.throughput.endpoints.detectedEndpoints.template,
            component: () => import("@/views/throughputreport/endpoints/DetectedEndpointsView.vue"),
          },
          {
            title: "Detected Broker Queues",
            path: routeLinks.throughput.endpoints.detectedBrokerQueues.template,
            component: () => import("@/views/throughputreport/endpoints/DetectedBrokerQueuesView.vue"),
          },
        ],
      },
    ],
  },
  {
    path: routeLinks.configuration.root,
    title: "Configuration",
    component: ConfigurationView,
    redirect: routeLinks.configuration.license.link,
    requiredAnyPermission: ["licensing:view", "notifications:view", "redirects:view", "connections:view", "endpoints:view"],
    children: [
      {
        title: "License",
        path: routeLinks.configuration.license.template,
        component: () => import("@/components/configuration/PlatformLicense.vue"),
        requiredPermission: "licensing:view",
      },
      {
        title: "MassTransit Connector",
        path: routeLinks.configuration.massTransitConnector.template,
        component: () => import("@/components/configuration/MassTransitConnector.vue"),
        requiredPermission: "connections:view",
      },
      {
        title: "Health Check Notifications",
        path: routeLinks.configuration.healthCheckNotifications.template,
        component: () => import("@/components/configuration/HealthCheckNotifications.vue"),
        requiredPermission: "notifications:view",
      },
      {
        title: "Retry Redirects",
        path: routeLinks.configuration.retryRedirects.template,
        component: () => import("@/components/configuration/RetryRedirects.vue"),
        requiredPermission: "redirects:view",
      },
      {
        title: "Connections",
        path: routeLinks.configuration.connections.template,
        component: () => import("@/components/configuration/PlatformConnections.vue"),
        requiredPermission: "connections:view",
      },
      {
        title: "Endpoint Connection",
        path: routeLinks.configuration.endpointConnection.template,
        component: () => import("@/components/configuration/EndpointConnection.vue"),
        requiredPermission: "endpoints:view",
      },
      {
        title: "Custom indexes (spike)",
        path: routeLinks.configuration.customIndexes.template,
        component: () => import("@/views/CustomIndexesView.vue"),
        // No requiredPermission — any authenticated user can view the configured indexes today.
        // When POST/DELETE land, gate with a new "indexes:manage" permission.
      },
      {
        title: "Usage Setup",
        path: routeLinks.throughput.setup.root,
        redirect: routeLinks.throughput.setup.connectionSetup.link,
        requiredPermission: "throughput:manage",
        component: () => import("@/views/throughputreport/SetupView.vue"),
        children: [
          {
            title: "Connection Setup",
            path: routeLinks.throughput.setup.connectionSetup.template,
            component: () => import("@/views/throughputreport/setup/ConnectionSetupView.vue"),
          },
          {
            title: "Mask Report Data",
            path: routeLinks.throughput.setup.mask.template,
            component: () => import("@/views/throughputreport/setup/MasksView.vue"),
          },
          {
            title: "Diagnostics",
            path: routeLinks.throughput.setup.diagnostics.template,
            component: () => import("@/views/throughputreport/setup/DiagnosticsView.vue"),
          },
        ],
      },
    ],
  },
];

export default config;
