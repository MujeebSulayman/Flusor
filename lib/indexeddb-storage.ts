/**
 * IndexedDB Storage Utility for Solmix File System
 * 
 * This utility provides a clean interface for storing and retrieving
 * file system data using IndexedDB instead of localStorage for better
 * performance and storage capacity.
 */

export interface StorageOptions {
  dbName?: string;
  dbVersion?: number;
  storeName?: string;
}

export class IndexedDBStorage {
  private dbName: string;
  private dbVersion: number;
  private storeName: string;
  private db: IDBDatabase | null = null;

  constructor(options: StorageOptions = {}) {
    this.dbName = options.dbName || 'solmix-file-system';
    this.dbVersion = options.dbVersion || 1;
    this.storeName = options.storeName || 'files';
  }

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (typeof window === 'undefined') {
      // SSR environment - skip initialization
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('IndexedDB initialization failed:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log(`IndexedDB ${this.dbName} initialized successfully`);
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'key'
          });
          
          // Create index for faster queries
          store.createIndex('timestamp', 'timestamp', { unique: false });
          
          console.log(`Created IndexedDB object store: ${this.storeName}`);
        }
      };
    });
  }

  /**
   * Store data in IndexedDB
   */
  async setItem(key: string, value: any): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      throw new Error('IndexedDB not available');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const data = {
        key,
        value: JSON.stringify(value),
        timestamp: Date.now()
      };

      const request = store.put(data);

      request.onerror = () => {
        console.error(`Failed to store item ${key}:`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Retrieve data from IndexedDB
   */
  async getItem(key: string): Promise<any> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => {
        console.error(`Failed to get item ${key}:`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          try {
            resolve(JSON.parse(result.value));
          } catch (error) {
            console.error(`Failed to parse stored data for ${key}:`, error);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
    });
  }

  /**
   * Remove data from IndexedDB
   */
  async removeItem(key: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      throw new Error('IndexedDB not available');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => {
        console.error(`Failed to remove item ${key}:`, request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Clear all data from IndexedDB
   */
  async clear(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      throw new Error('IndexedDB not available');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => {
        console.error('Failed to clear IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('IndexedDB cleared successfully');
        resolve();
      };
    });
  }

  /**
   * Get all keys from IndexedDB
   */
  async getAllKeys(): Promise<string[]> {
    if (!this.db) {
      await this.init();
    }

    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => {
        console.error('Failed to get all keys:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve(request.result as string[]);
      };
    });
  }

  /**
   * Check if IndexedDB is available
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('IndexedDB connection closed');
    }
  }
}

// Export a lazy singleton instance
let fileStorageInstance: IndexedDBStorage | null = null;

export function getFileStorage(): IndexedDBStorage {
  if (!fileStorageInstance) {
    fileStorageInstance = new IndexedDBStorage({
      dbName: 'solmix-file-system',
      dbVersion: 1,
      storeName: 'files'
    });
  }
  return fileStorageInstance;
}

// Export fileStorage that's safe for SSR
export const fileStorage = {
  async init() {
    if (typeof window === 'undefined') return;
    return getFileStorage().init();
  },
  async setItem(key: string, value: any) {
    if (typeof window === 'undefined') return;
    return getFileStorage().setItem(key, value);
  },
  async getItem(key: string) {
    if (typeof window === 'undefined') return null;
    return getFileStorage().getItem(key);
  },
  async removeItem(key: string) {
    if (typeof window === 'undefined') return;
    return getFileStorage().removeItem(key);
  },
  async clear() {
    if (typeof window === 'undefined') return;
    return getFileStorage().clear();
  },
  async getAllKeys() {
    if (typeof window === 'undefined') return [];
    return getFileStorage().getAllKeys();
  },
  close() {
    if (typeof window === 'undefined') return;
    return getFileStorage().close();
  }
};

// Migration utility from localStorage to IndexedDB
export async function migrateFromLocalStorage(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const STORAGE_KEY = 'solmix-files';
    const existingData = localStorage.getItem(STORAGE_KEY);
    
    if (existingData) {
      console.log('Migrating files from localStorage to IndexedDB...');
      
      // Parse the existing localStorage data
      const parsedData = JSON.parse(existingData);
      
      // Store in IndexedDB
      await fileStorage.setItem(STORAGE_KEY, parsedData);
      
      // Remove from localStorage
      localStorage.removeItem(STORAGE_KEY);
      
      console.log('Migration from localStorage to IndexedDB completed successfully');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Migration from localStorage to IndexedDB failed:', error);
    return false;
  }
}
