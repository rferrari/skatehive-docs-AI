export interface ICache {
    set(key: string, value: any, ttl?: number): void;
    get(key: string): any;
    delete(key: string): void;
    clear(): void;
  }