import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MainLayout from "./layouts/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import Administrare from "./pages/Administrare";
import { AuthProvider } from "./context/AuthContext";
import Telegrame from "./pages/Telegrame";
import TelegramDetails from "./pages/TelegramDetails";
import EditTelegram from "./pages/EditTelegram";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />

          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
  <Route element={<MainLayout />}>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/telegrame" element={<Telegrame />} />
    <Route path="/telegrame/:id" element={<TelegramDetails />} />
    <Route path="/telegrame/:id/edit" element={<EditTelegram />} />
    
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