export const AUTH_KEY = "cloud-rpg-auth";

export function readAuth() {
  if (typeof window === "undefined") return null;
  try { 
    const raw = localStorage.getItem(AUTH_KEY); 
    return raw ? JSON.parse(raw) : null; 
  } catch { 
    return null; 
  }
}

export function clearAuth() {
  try { 
    localStorage.removeItem(AUTH_KEY); 
  } catch {}
}

export function saveAuth(user: any, token: string) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ 
      user, 
      token,
      ts: Date.now() 
    }));
    window.dispatchEvent(new Event("cloud-rpg-auth-change"));
  } catch {}
}