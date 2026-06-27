import { Route } from "react-router-dom";
import { ModuleRoute } from "@/components/routing/ModuleRoute";
import TestPilotPage from "./pages/TestPilotPage";

export const testpilotRoutes = (
  <Route element={<ModuleRoute module="testpilot" requiresFeatureFlag="enableTestPilot" />}>
    <Route path="/testpilot" element={<TestPilotPage />} />
  </Route>
);

export { TestPilotPage };
