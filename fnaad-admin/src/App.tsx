import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ReviewHub from "./pages/ReviewHub";
import Moderation from "./pages/Moderation";
import Artists from "./pages/Artists";
import Subscriptions from "./pages/Subscriptions";
import Reports from "./pages/Reports";
import Registrations from "./pages/Registrations";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/review" element={<ReviewHub />} />
            <Route path="/moderation" element={<Moderation />} />
            <Route path="/artists" element={<Artists />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/registrations" element={<Registrations />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
