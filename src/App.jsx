import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import Login from "./pages/Login";
import ActivateAccount from "./pages/ActivateAccount";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Administrare from "./pages/Administrare";
import MonitorizareUtilizatori from "./pages/MonitorizareUtilizatori";
import Telegrame from "./pages/Telegrame";
import AdaugaTelegrama from "./pages/AdaugaTelegrama";
import EditTelegram from "./pages/EditTelegram";
import Ordine from "./pages/Ordine";
import AdaugaOrdin from "./pages/AdaugaOrdin";
import EditOrder from "./pages/EditOrder";
import Legislatie from "./pages/Legislatie";
import AdaugaLegislation from "./pages/AdaugaLegislation";
import EditLegislation from "./pages/EditLegislation";
import InformatiiUtile from "./pages/InformatiiUtile";
import AdaugaInformatiiUtile from "./pages/AdaugaInformatiiUtile";
import EditInformatiiUtile from "./pages/EditInformatiiUtile";
import AdaugaStire from "./pages/AdaugaStire";
import EditStire from "./pages/EditStire";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/activate" element={<ActivateAccount />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/telegrame" element={<Telegrame />} />
              <Route path="/telegrame/adauga" element={<AdaugaTelegrama />} />
              <Route path="/telegrame/:id/edit" element={<EditTelegram />} />
              <Route path="/ordine" element={<Ordine />} />
              <Route path="/ordine/adauga" element={<AdaugaOrdin />} />
              <Route path="/ordine/:id/edit" element={<EditOrder />} />
              <Route path="/legislatie" element={<Legislatie />} />
              <Route
                path="/legislatie/adauga"
                element={<AdaugaLegislation />}
              />
              <Route
                path="/legislatie/:id/edit"
                element={<EditLegislation />}
              />
              <Route path="/informatii-utile" element={<InformatiiUtile />} />
              <Route
                path="/informatii-utile/adauga"
                element={<AdaugaInformatiiUtile />}
              />
              <Route
                path="/informatii-utile/:id/edit"
                element={<EditInformatiiUtile />}
              />
              <Route path="/stiri/adauga" element={<AdaugaStire />} />
              <Route path="/stiri/:id/edit" element={<EditStire />} />
              <Route path="/profil" element={<Profile />} />
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<Administrare />} />
                <Route
                  path="/monitorizare-utilizatori"
                  element={<MonitorizareUtilizatori />}
                />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
