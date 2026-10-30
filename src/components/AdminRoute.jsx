import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/authStore";

function AdminRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Se verifică permisiunile...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default AdminRoute;
