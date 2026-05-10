import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  DevImpersonationProvider,
  useDevImpersonation,
  IMPERSONABLE_ROLES,
} from "./useDevImpersonation";

const STORAGE_KEY = "dev:viewAsRole";

function wrapper({ children }: { children: React.ReactNode }) {
  return <DevImpersonationProvider>{children}</DevImpersonationProvider>;
}

describe("useDevImpersonation", () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it("começa sem role impersonada", () => {
    const { result } = renderHook(() => useDevImpersonation(), { wrapper });
    expect(result.current.viewAsRole).toBe(null);
  });

  it("seta e persiste role no localStorage", () => {
    const { result } = renderHook(() => useDevImpersonation(), { wrapper });
    act(() => result.current.setViewAsRole("vendedor"));
    expect(result.current.viewAsRole).toBe("vendedor");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("vendedor");
  });

  it("clear remove a role e limpa o localStorage", () => {
    const { result } = renderHook(() => useDevImpersonation(), { wrapper });
    act(() => result.current.setViewAsRole("admin"));
    act(() => result.current.clear());
    expect(result.current.viewAsRole).toBe(null);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(null);
  });

  it("hidrata do localStorage no mount", () => {
    window.localStorage.setItem(STORAGE_KEY, "caixa");
    const { result } = renderHook(() => useDevImpersonation(), { wrapper });
    // Hidratação acontece no useEffect; precisamos esperar um tick.
    expect(result.current.viewAsRole).toBe("caixa");
  });

  it("ignora valores inválidos no localStorage", () => {
    window.localStorage.setItem(STORAGE_KEY, "papel-fake");
    const { result } = renderHook(() => useDevImpersonation(), { wrapper });
    expect(result.current.viewAsRole).toBe(null);
  });

  it("expõe a lista de roles que dev pode impersonar", () => {
    expect(IMPERSONABLE_ROLES).toEqual([
      "admin",
      "caixa",
      "gerente_barraca",
      "vendedor",
      "user",
    ]);
    // Importante: não inclui "desenvolvedor" (impersonar a si mesmo não faz sentido)
    expect(IMPERSONABLE_ROLES).not.toContain("desenvolvedor");
  });
});
