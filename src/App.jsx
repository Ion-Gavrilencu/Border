import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import Administrare from "./pages/Administrare";
import { AuthProvider } from "./context/AuthContext";
import Telegrame from "./pages/Telegrame";

import EditTelegram from "./pages/EditTelegram";
import Ordine from "./pages/Ordine";

import EditOrder from "./pages/EditOrder";
import Legislatie from "./pages/Legislatie";
import LegislationDetails from "./pages/LegislationDetails";
import EditLegislation from "./pages/EditLegislation";
import InformatiiUtile from "./pages/InformatiiUtile";
import EditInformatiiUtile from "./pages/EditInformatiiUtile";
import UsefulInfoDetails from "./pages/UsefulInfoDetails";
import ActivateAccount from "./pages/ActivateAccount";
import Profile from "./pages/Profile";
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />

          <Route path="/login" element={<Login />} />
          <Route path="/activate" element={<ActivateAccount />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/telegrame" element={<Telegrame />} />

              <Route path="/telegrame/:id/edit" element={<EditTelegram />} />
              <Route path="/ordine" element={<Ordine />} />
              
              <Route path="/ordine/:id/edit" element={<EditOrder />} />
              <Route path="/legislatie" element={<Legislatie />} />
              <Route path="/legislatie/:id" element={<LegislationDetails />} />
              <Route path="/informatii-utile" element={<InformatiiUtile />} />
              <Route
                path="/informatii-utile/:id"
                element={<UsefulInfoDetails />}
              />
              <Route
                path="/informatii-utile/:id/edit"
                element={<EditInformatiiUtile />}
              />
              <Route
                path="/legislatie/:id/edit"
                element={<EditLegislation />}
              />
              <Route path="/profil" element={<Profile />} />
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<Administrare />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
