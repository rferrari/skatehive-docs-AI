export class Cache {
  private store: Map<string, any>;

  constructor() {
    this.store = new Map();
  }

  set<T>(key: string, value: T, ttl?: number): void {
    this.store.set(key, {
      value,
      expires: ttl ? Date.now() + (ttl * 1000) : null
    });
  }

  get<T>(key: string): T | null {
    const item = this.store.get(key);
    if (!item) return null;

    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }
}