
import { useEffect, useState } from "react";
import api from "../services/api";
import { AuthContext } from "./authStore";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const updateUser = (updatedUser) => {
    if (!updatedUser || typeof updatedUser !== "object") {
      return;
    }

    setUser((previousUser) =>
      previousUser
        ? { ...previousUser, ...updatedUser }
        : previousUser,
    );
  };

  const checkAuth = async () => {
    try {
      const response = await api.get("/auth/me");
      setUser(response.data?.user || null);
    } catch (error) {
      console.error("CHECK AUTH ERROR:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (username, password) => {
    const response = await api.post("/auth/login", {
      username,
      password,
    });

    const authenticatedUser = response.data?.user;

    if (!authenticatedUser) {
      throw new Error(
        "Serverul nu a returnat datele utilizatorului.",
      );
    }

    setUser(authenticatedUser);

    return response.data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("LOGOUT ERROR:", error);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        checkAuth,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
