import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/authStore";

function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Se verifică autentificarea...</div>;
  }

  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
