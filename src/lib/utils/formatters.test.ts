import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  parseCentavos,
  centavosToReais,
  truncateName,
} from "./formatters";

describe("formatCurrency", () => {
  it("formata centavos como BRL com R$ e 2 casas", () => {
    //   é o non-breaking space que Intl usa entre R$ e o número
    expect(formatCurrency(0)).toBe("R$ 0,00");
    expect(formatCurrency(100)).toBe("R$ 1,00");
    expect(formatCurrency(1234)).toBe("R$ 12,34");
    expect(formatCurrency(100000)).toBe("R$ 1.000,00");
  });

  it("aceita valores negativos (estorno)", () => {
    expect(formatCurrency(-500)).toMatch(/-.*5,00/);
  });
});

describe("parseCentavos", () => {
  it("converte string em reais para inteiro de centavos", () => {
    expect(parseCentavos("10")).toBe(1000);
    expect(parseCentavos("10,50")).toBe(1050);
    expect(parseCentavos("10.50")).toBe(1050);
    expect(parseCentavos("R$ 99,99")).toBe(9999);
  });

  it("retorna 0 para entradas inválidas", () => {
    expect(parseCentavos("")).toBe(0);
    expect(parseCentavos("abc")).toBe(0);
    expect(parseCentavos("R$")).toBe(0);
  });

  it("arredonda para o centavo mais próximo (sem perda por float)", () => {
    expect(parseCentavos("0,1")).toBe(10);
    expect(parseCentavos("0,01")).toBe(1);
    expect(parseCentavos("99,995")).toBe(10000);
  });
});

describe("centavosToReais", () => {
  it("formata centavos como string com vírgula", () => {
    expect(centavosToReais(0)).toBe("0,00");
    expect(centavosToReais(1234)).toBe("12,34");
    expect(centavosToReais(100000)).toBe("1000,00");
  });
});

describe("truncateName", () => {
  it("não trunca nomes curtos", () => {
    expect(truncateName("João")).toBe("João");
    expect(truncateName("Maria Silva", 20)).toBe("Maria Silva");
  });

  it("trunca nomes longos com reticências", () => {
    expect(truncateName("Maria Aparecida das Dores Silva", 10)).toBe("Maria Apa…");
    expect(truncateName("Maria Aparecida das Dores Silva", 10).length).toBe(10);
  });
});
