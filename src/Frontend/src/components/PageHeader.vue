<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import routeLinks from "@/router/routeLinks";
import CustomChecksMenuItem from "@/components/customchecks/CustomChecksMenuItem.vue";
import HeartbeatsMenuItem from "@/components/heartbeats/HeartbeatsMenuItem.vue";
import ConfigurationMenuItem from "@/components/configuration/ConfigurationMenuItem.vue";
import FailedMessagesMenuItem from "@/components/failedmessages/FailedMessagesMenuItem.vue";
import MonitoringMenuItem from "@/components/monitoring/MonitoringMenuItem.vue";
import EventsMenuItem from "@/components/events/EventsMenuItem.vue";
import DashboardMenuItem from "@/components/dashboard/DashboardMenuItem.vue";
import FeedbackButton from "@/components/FeedbackButton.vue";
import ThroughputMenuItem from "@/views/throughputreport/ThroughputMenuItem.vue";
import AuditMenuItem from "./audit/AuditMenuItem.vue";
import monitoringClient from "@/components/monitoring/monitoringClient";
import UserProfileMenuItem from "@/components/UserProfileMenuItem.vue";
import { useAuthStore } from "@/stores/AuthStore";
import { storeToRefs } from "pinia";
import { usePermissions } from "@/composables/usePermissions";

const isMonitoringEnabled = monitoringClient.isMonitoringEnabled;

const authStore = useAuthStore();
const { authEnabled, isAuthenticated } = storeToRefs(authStore);

const { can, canAny } = usePermissions();

// Reactive nav-item visibility — re-evaluates whenever the permissions store updates.
const showHeartbeats = computed(() => can("heartbeats:view"));
const showAudit = computed(() => can("messages:view"));
const showFailedMessages = computed(() => can("messages:view"));
const showMonitoring = computed(() => isMonitoringEnabled && can("monitoring:view"));
const showCustomChecks = computed(() => can("customchecks:view"));
const showEvents = computed(() => can("eventlog:view"));
const showThroughput = computed(() => can("throughput:view"));
const showConfiguration = computed(() => canAny(["licensing:view", "notifications:view", "redirects:view", "connections:view", "endpoints:view"]));
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-inverse navbar-dark">
    <div class="container-fluid">
      <div class="navbar-header">
        <RouterLink class="navbar-brand" :to="routeLinks.dashboard">
          <img alt="Service Pulse" src="@/assets/logo.svg" />
        </RouterLink>
      </div>

      <div id="navbar" class="navbar navbar-expand-lg">
        <ul class="nav navbar-nav navbar-inverse">
          <li>
            <DashboardMenuItem />
          </li>
          <li v-if="showHeartbeats">
            <HeartbeatsMenuItem />
          </li>
          <li v-if="showMonitoring">
            <MonitoringMenuItem />
          </li>
          <li v-if="showAudit">
            <AuditMenuItem />
          </li>
          <li v-if="showFailedMessages">
            <FailedMessagesMenuItem />
          </li>
          <li v-if="showCustomChecks">
            <CustomChecksMenuItem />
          </li>
          <li v-if="showEvents">
            <EventsMenuItem />
          </li>
          <li v-if="showThroughput">
            <ThroughputMenuItem />
          </li>
          <li v-if="showConfiguration">
            <ConfigurationMenuItem />
          </li>
          <li>
            <FeedbackButton />
          </li>
          <li v-if="authEnabled && isAuthenticated">
            <UserProfileMenuItem />
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>

<style scoped>
@import "@/assets/navbar.css";
@import "@/assets/header-menu-item.css";
</style>
