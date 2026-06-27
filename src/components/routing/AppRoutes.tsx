import { Loader2 } from "lucide-react";
import { Routes, Route } from "react-router-dom";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { SpaceLayout } from "@/components/layout/SpaceLayout";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { publicRoutes, coreProtectedRoutes, catchAllRoute } from "@/modules/platform";
import { meetingsRoutes } from "@/modules/meetings";
import { actionsRoutes } from "@/modules/actions";
import { knowledgeRoutes } from "@/modules/knowledge";
import { businessDevRoutes } from "@/modules/business-dev";
import { eosRoutes } from "@/modules/eos";
import { projectsRoutes } from "@/modules/projects";
import { productivityRoutes } from "@/modules/productivity";
import { automationRoutes } from "@/modules/automation";
import { testpilotRoutes } from "@/modules/testpilot";
import { adminRoutes } from "@/modules/admin";
import { spaceRoutes, globalSpaceRoutes } from "@/modules/spaces";
import ClientPortalDashboard from "@/pages/client/ClientPortalDashboard";
import ProjectDashboard from "@/pages/client/ProjectDashboard";
import MFAEnroll from "@/pages/MFAEnroll";

function RouteLoading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

/**
 * Full application route tree. Must render <Route> elements as direct children
 * of <Routes> — React Router v6 does not pick up routes returned from a
 * component nested inside another <Route>.
 */
export function AppRoutes() {
  const { features, isLoading } = useFeatureFlags();
  const fourSpaces = features?.enableFourSpaces === true;

  if (isLoading) {
    return (
      <Routes>
        {publicRoutes}
        <Route path="*" element={<RouteLoading />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {publicRoutes}

      <Route
        path="/projects/:slug/client-portal/:token"
        element={<ClientPortalDashboard />}
      />
      <Route path="/client/project/:token" element={<ProjectDashboard />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/mfa/enroll" element={<MFAEnroll />} />
        {fourSpaces ? (
          <>
            <Route element={<SpaceLayout />}>
              {globalSpaceRoutes}
              {testpilotRoutes}
              {spaceRoutes}
            </Route>
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>{adminRoutes}</Route>
            </Route>
          </>
        ) : (
          <>
            <Route element={<DashboardLayout />}>
              {coreProtectedRoutes}
              {businessDevRoutes}
              {meetingsRoutes}
              {actionsRoutes}
              {knowledgeRoutes}
              {eosRoutes}
              {projectsRoutes}
              {productivityRoutes}
              {automationRoutes}
              {testpilotRoutes}
            </Route>
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>{adminRoutes}</Route>
            </Route>
          </>
        )}
      </Route>

      {catchAllRoute}
    </Routes>
  );
}
