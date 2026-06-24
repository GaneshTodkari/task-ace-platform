import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getCurrentUser, login as apiLogin, logout as apiLogout } from "./api";
import { subscribe } from "./mock-db";
import type { User } from "./types";

interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => User | null;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
    return subscribe(() => setUser(getCurrentUser()));
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        login: (e, p) => {
          const u = apiLogin(e, p);
          setUser(u);
          return u;
        },
        logout: () => {
          apiLogout();
          setUser(null);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("AuthProvider missing");
  return c;
}

export function useDBVersion() {
  const [v, setV] = useState(0);
  useEffect(() => subscribe(() => setV((x) => x + 1)), []);
  return v;
}
