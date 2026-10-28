import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";

import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

// AUTENTIFICARE
import Login from "./pages/Login";
import ActivateAccount from "./pages/ActivateAccount";

// PAGINI PRINCIPALE
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Administrare from "./pages/Administrare";

// TELEGRAME
import Telegrame from "./pages/Telegrame";
import AdaugaTelegrama from "./pages/AdaugaTelegrama";
import EditTelegram from "./pages/EditTelegram";

// ORDINE
import Ordine from "./pages/Ordine";
import AdaugaOrdin from "./pages/AdaugaOrdin";
import EditOrder from "./pages/EditOrder";

// LEGISLAȚIE
import Legislatie from "./pages/Legislatie";
import LegislationDetails from "./pages/LegislationDetails";
import AdaugaLegislation from "./pages/AdaugaLegislation";
import EditLegislation from "./pages/EditLegislation";

// INFORMAȚII UTILE
import InformatiiUtile from "./pages/InformatiiUtile";
import UsefulInfoDetails from "./pages/UsefulInfoDetails";
import AdaugaInformatiiUtile from "./pages/AdaugaInformatiiUtile";
import EditInformatiiUtile from "./pages/EditInformatiiUtile";

// ȘTIRI
import AdaugaStire from "./pages/AdaugaStire";
import EditStire from "./pages/EditStire";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* REDIRECȚIONARE INIȚIALĂ */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* RUTE PUBLICE */}
          <Route path="/login" element={<Login />} />

          <Route path="/activate" element={<ActivateAccount />} />

          {/* RUTE PROTEJATE */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              {/* DASHBOARD */}
              <Route path="/dashboard" element={<Dashboard />} />

              {/* TELEGRAME */}
              <Route path="/telegrame" element={<Telegrame />} />

              <Route path="/telegrame/adauga" element={<AdaugaTelegrama />} />

              <Route path="/telegrame/:id/edit" element={<EditTelegram />} />

              {/* ORDINE */}
              <Route path="/ordine" element={<Ordine />} />

              <Route path="/ordine/adauga" element={<AdaugaOrdin />} />

              <Route path="/ordine/:id/edit" element={<EditOrder />} />

              {/* LEGISLAȚIE */}
              <Route path="/legislatie" element={<Legislatie />} />

              <Route
                path="/legislatie/adauga"
                element={<AdaugaLegislation />}
              />

              <Route
                path="/legislatie/:id/edit"
                element={<EditLegislation />}
              />

              <Route path="/legislatie/:id" element={<LegislationDetails />} />

              {/* INFORMAȚII UTILE */}
              <Route path="/informatii-utile" element={<InformatiiUtile />} />

              <Route
                path="/informatii-utile/adauga"
                element={<AdaugaInformatiiUtile />}
              />

              <Route
                path="/informatii-utile/:id/edit"
                element={<EditInformatiiUtile />}
              />

              <Route
                path="/informatii-utile/:id"
                element={<UsefulInfoDetails />}
              />

              {/* ȘTIRI */}
              <Route path="/stiri/adauga" element={<AdaugaStire />} />

              <Route path="/stiri/:id/edit" element={<EditStire />} />

              {/* PROFIL */}
              <Route path="/profil" element={<Profile />} />

              {/* ADMINISTRARE */}
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<Administrare />} />
              </Route>
            </Route>
          </Route>

          {/* PAGINĂ INEXISTENTĂ */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
