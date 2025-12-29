/**
 * Token Storage Utility
 * Handles auth token storage based on "Remember Me" preference.
 * - Remember Me checked: uses localStorage (persists after browser close)
 * - Remember Me unchecked: uses sessionStorage (cleared on browser close)
 */

const STORAGE_TYPE_KEY = 'auth_storage_type';
const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

function getStorage(): Storage {
  const useLocal = sessionStorage.getItem(STORAGE_TYPE_KEY) === 'local';
  return useLocal ? localStorage : sessionStorage;
}

export const tokenStorage = {
  /**
   * Set the storage preference based on "Remember Me" checkbox
   */
  setRememberMe(remember: boolean) {
    if (remember) {
      sessionStorage.setItem(STORAGE_TYPE_KEY, 'local');
    } else {
      sessionStorage.removeItem(STORAGE_TYPE_KEY);
    }
  },

  /**
   * Get auth token from appropriate storage
   */
  getToken(): string | null {
    // Check both storages (for migration/edge cases)
    return sessionStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY);
  },

  /**
   * Store auth token in appropriate storage
   */
  setToken(token: string) {
    getStorage().setItem(AUTH_TOKEN_KEY, token);
  },

  /**
   * Get refresh token from appropriate storage
   */
  getRefreshToken(): string | null {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Store refresh token in appropriate storage
   */
  setRefreshToken(token: string) {
    getStorage().setItem(REFRESH_TOKEN_KEY, token);
  },

  /**
   * Clear all auth tokens from both storages
   */
  clear() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_TYPE_KEY);
  },
};

export default tokenStorage;
