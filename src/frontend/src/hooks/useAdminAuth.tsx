import { useCallback, useState } from "react";

const ADMIN_ACCOUNTS = [
  { username: "dr.armankabir011@gmail.com", password: "01197247219" },
  { username: "admin2", password: "admin2" },
];

const STORAGE_KEY = "adminSession";

function loadSession(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState<boolean>(loadSession);

  const adminLogin = useCallback(
    (username: string, password: string): boolean => {
      const match = ADMIN_ACCOUNTS.find(
        (a) => a.username === username && a.password === password,
      );
      if (match) {
        localStorage.setItem(STORAGE_KEY, "true");
        setIsAdmin(true);
        return true;
      }
      return false;
    },
    [],
  );

  const adminLogout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIsAdmin(false);
  }, []);

  return { isAdmin, adminLogin, adminLogout };
}
