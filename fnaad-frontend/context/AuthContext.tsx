import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { isLoggedIn as checkLoggedIn, logoutUser as clearToken, getMe, restoreSession } from "../services/api";

type UserInfo = {
  id: number;
  username: string;
  email: string;
  phone_number: string;
  profile_photo?: string | null;
  role: string;
  is_staff: boolean;
  is_artist: boolean;
};

type AuthContextType = {
  loggedIn: boolean;
  setLoggedIn: (value: boolean) => void;
  user: UserInfo | null;
  refreshUser: () => Promise<void>;
  logout: () => void;
  initializing: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [initializing, setInitializing] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await getMe();
      setUser(res.data);
    } catch (err) {
      setUser(null);
    }
  };

  const logout = async () => {
    await clearToken();
    setLoggedIn(false);
    setUser(null);
  };

  useEffect(() => {
    // On app start, restore saved session from local storage (instant),
    // then fetch user details in the background without blocking the UI.
    restoreSession().then((hadSession) => {
      if (hadSession) {
        setLoggedIn(true);
        // Don't await — let the UI render immediately while /me loads in bg
        refreshUser();
      }
      // Unblock the UI as soon as we know the session state (no network needed)
      setInitializing(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ loggedIn, setLoggedIn, user, refreshUser, logout, initializing }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
