import { Route } from "react-router-dom";
import TestPilotPage from "./pages/TestPilotPage";

export const testpilotRoutes = (
  <Route path="/testpilot" element={<TestPilotPage />} />
);

export { TestPilotPage };
