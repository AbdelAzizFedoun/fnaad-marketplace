import { createContext, useContext, useState, ReactNode } from "react";
import { login as loginRequest, getMe } from "../services/api";

type AuthContextType = {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("fnaad_admin_access")
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await loginRequest(email, password);
      localStorage.setItem("fnaad_admin_access", res.data.access);
      localStorage.setItem("fnaad_admin_refresh", res.data.refresh);

      const meRes = await getMe();
      const user = meRes.data;
      if (user.role !== "superadmin" && !user.is_staff) {
        localStorage.removeItem("fnaad_admin_access");
        localStorage.removeItem("fnaad_admin_refresh");
        throw new Error("Access denied: This account does not have admin privileges (staff or superadmin).");
      }
      setIsAuthenticated(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Incorrect email or password.";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("fnaad_admin_access");
    localStorage.removeItem("fnaad_admin_refresh");
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}