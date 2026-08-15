export const STORAGE_KEYS = {
  WORDS: 'spacedrep_vocab_data',
  SETTINGS: 'spacedrep_settings',
  HISTORY: 'spacedrep_review_history',
  TOPICS: 'spacedrep_topics',
  FOLDERS: 'spacedrep_folders',
  BACKUP_DATE: 'spacedrep_last_backup_date',
  FULL_BACKUP: 'spacedrep_full_backup',
  LEGACY_BACKUP: 'spacedrep_vocab_backup',
};

/**
 * Safely parse JSON from string with fallback.
 */
export const safeParse = (str, fallback) => {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

/**
 * Get localStorage reference safely across environments.
 */
const getStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // In restricted sandbox / cookies disabled
    return null;
  }
  return null;
};

/**
 * Safely get item from localStorage without throwing.
 */
export const safeGetItem = (key, fallback = null) => {
  try {
    const storage = getStorage();
    if (!storage) return fallback;
    const val = storage.getItem(key);
    return val !== null ? val : fallback;
  } catch (e) {
    console.warn(`[storage] Error reading key "${key}":`, e);
    return fallback;
  }
};

/**
 * Safely remove item from localStorage without throwing.
 */
export const safeRemoveItem = (key) => {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(key);
  } catch (e) {
    console.warn(`[storage] Error removing key "${key}":`, e);
  }
};

/**
 * Check if an error is a QuotaExceededError across browsers.
 */
export const isQuotaExceededError = (err) => {
  return Boolean(
    err &&
      (err instanceof DOMException || err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
      (err.code === 22 ||
        err.code === 1014 ||
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        (typeof err.message === 'string' && err.message.toLowerCase().includes('quota')))
  );
};

/**
 * Safely set item in localStorage with quota management and fallback cleanup.
 * @param {string} key
 * @param {string} value
 * @param {boolean} isCritical If true and quota exceeded, tries clearing non-critical keys (like legacy backup, full backup) to prioritize saving critical user data.
 * @returns {boolean} True if saved successfully, false otherwise.
 */
export const safeSetItem = (key, value, isCritical = false) => {
  const storage = getStorage();
  if (!storage) return false;

  try {
    storage.setItem(key, value);
    return true;
  } catch (err) {
    if (isQuotaExceededError(err)) {
      console.warn(`[storage] Quota exceeded while saving key "${key}".`);

      if (isCritical) {
        // Step 1: Clean up legacy redundant backup key
        try {
          safeRemoveItem(STORAGE_KEYS.LEGACY_BACKUP);
          storage.setItem(key, value);
          console.info(`[storage] Saved critical key "${key}" after clearing legacy backup.`);
          return true;
        } catch {
          // Step 2: Clean up full backup cache to protect user's current session / words
          try {
            safeRemoveItem(STORAGE_KEYS.FULL_BACKUP);
            storage.setItem(key, value);
            console.warn(`[storage] Saved critical key "${key}" after clearing full backup cache.`);
            return true;
          } catch (cleanupErr2) {
            console.error(`[storage] Failed to save critical key "${key}" even after clearing backup cache:`, cleanupErr2);
            return false;
          }
        }
      }
    } else {
      console.error(`[storage] Unexpected error saving key "${key}":`, err);
    }
    return false;
  }
};
