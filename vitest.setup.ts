import "@testing-library/jest-dom/vitest";

// O sandbox pode entregar um localStorage sem métodos. Garantimos uma
// implementação Map-backed para os testes.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => void store.delete(key),
    setItem: (key: string, value: string) => void store.set(key, String(value)),
  };
}

Object.defineProperty(window, "localStorage", {
  value: createMemoryStorage(),
  writable: false,
  configurable: true,
});

Object.defineProperty(window, "sessionStorage", {
  value: createMemoryStorage(),
  writable: false,
  configurable: true,
});
