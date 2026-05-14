"use client";

import { useEffect, useState, Fragment } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { collection, onSnapshot, query, getDocs, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { formatCurrency } from "@/lib/utils/formatters";
import { BarChart2, Store, ArrowLeft, Loader2, ChevronDown, ChevronUp, Wallet, Banknote, Users, MoreHorizontal, CreditCard, QrCode } from "lucide-react";
import Link from "next/link";
import AuthGuard from "@/components/auth/AuthGuard";
import type { StallDoc, ProductDoc } from "@/lib/types";

interface StallWithProducts extends StallDoc {
  id: string;
  products: ProductDoc[];
}

export default function AdminRelatorioPage() {
  return (
    <AuthGuard allowedRoles={["admin"]}>
      <AdminRelatorioContent />
    </AuthGuard>
  );
}

function AdminRelatorioContent() {
  const { user, userDoc } = useAuth();
  const [stalls, setStalls] = useState<StallWithProducts[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStall, setExpandedStall] = useState<string | null>(null);

  const [totalRecharges, setTotalRecharges] = useState(0);
  const [totalRetido, setTotalRetido] = useState(0);
  const [caixas, setCaixas] = useState<{name: string, total: number, lastAt: number}[]>([]);

  // Breakdown de recargas por forma de pagamento.
  // - dinheiro/debito/credito vêm do rechargeBalance manual feito pelo caixa
  // - pix vem do creditPixPayment (webhook Asaas)
  // - "outros" cobre transações antigas (sem payment_method) ou valores não previstos
  const [methodBreakdown, setMethodBreakdown] = useState({
    dinheiro: 0,
    debito: 0,
    credito: 0,
    pix: 0,
    outros: 0,
  });

  // Diagnóstico: quais valores brutos de payment_method existem no banco e
  // quanto cada um soma. Útil pra detectar se a Cloud Function ainda está
  // gravando "manual" (deploy não rolou) ou outro valor inesperado.
  const [methodRawCounts, setMethodRawCounts] = useState<Record<string, { count: number; total: number }>>({});

  useEffect(() => {
    if (!user || (userDoc?.role !== "admin" && userDoc?.role !== "desenvolvedor")) return;

    const fetchMetrics = async () => {
      try {
        // 1. Total Recargas & Fechamento por Caixa
        const qRecharges = query(collection(db, "transactions"), where("type", "==", "recharge"));
        const rechargesSnap = await getDocs(qRecharges);

        let sumRecharges = 0;
        // Por operador: agregamos total e última atividade (timestamp ms)
        const caixasMap: Record<string, { total: number; lastAt: number }> = {};
        // Por método de pagamento
        const methodTotals = { dinheiro: 0, debito: 0, credito: 0, pix: 0, outros: 0 };
        // Diagnóstico: contar todos os valores brutos
        const rawCounts: Record<string, { count: number; total: number }> = {};

        rechargesSnap.forEach(d => {
          const data = d.data();
          const amount = data.amount_cents || 0;
          sumRecharges += amount;
          const op = data.operator_name || "Desconhecido";
          const ts = data.created_at?.toMillis ? data.created_at.toMillis() : 0;
          if (!caixasMap[op]) caixasMap[op] = { total: 0, lastAt: 0 };
          caixasMap[op].total += amount;
          if (ts > caixasMap[op].lastAt) caixasMap[op].lastAt = ts;

          // Agregar por método. Tolerante a variações de string e a transações
          // antigas sem o campo (vão pra "outros").
          const rawMethod = String(data.payment_method || "").toLowerCase();

          // Contar valor bruto pra debug
          const rawKey = data.payment_method == null ? "(null/sem campo)" : String(data.payment_method);
          if (!rawCounts[rawKey]) rawCounts[rawKey] = { count: 0, total: 0 };
          rawCounts[rawKey].count += 1;
          rawCounts[rawKey].total += amount;

          if (rawMethod === "dinheiro") methodTotals.dinheiro += amount;
          else if (rawMethod === "debito" || rawMethod === "débito") methodTotals.debito += amount;
          else if (rawMethod === "credito" || rawMethod === "crédito") methodTotals.credito += amount;
          else if (rawMethod === "pix") methodTotals.pix += amount;
          else methodTotals.outros += amount;
        });

        setTotalRecharges(sumRecharges);
        setMethodBreakdown(methodTotals);
        setMethodRawCounts(rawCounts);
        // Ordem cronológica reversa: o caixa que registrou venda mais recente vem primeiro
        setCaixas(
          Object.entries(caixasMap)
            .map(([name, agg]) => ({ name, total: agg.total, lastAt: agg.lastAt }))
            .sort((a, b) => b.lastAt - a.lastAt)
        );

        // 2. Saldo Retido
        const usersSnap = await getDocs(collection(db, "users"));
        let sumRetido = 0;
        usersSnap.forEach(d => {
          sumRetido += (d.data().balance || 0);
        });
        
        const tempSnap = await getDocs(collection(db, "temp_accounts"));
        tempSnap.forEach(d => {
          sumRetido += (d.data().balance || 0);
        });
        
        setTotalRetido(sumRetido);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMetrics();

    const qStalls = query(collection(db, "stalls"));
    const unsub = onSnapshot(qStalls, async (snap) => {
      const stallsData: StallWithProducts[] = [];

      for (const stallDoc of snap.docs) {
        const stallData = stallDoc.data() as StallDoc;
        
        // Buscar produtos da barraca
        const qProducts = query(
          collection(db, "stalls", stallDoc.id, "products"),
          orderBy("name", "asc") 
        );
        
        const productsSnap = await getDocs(qProducts);
        // Ordenar localmente (JS) pelos produtos que mais faturaram para não depender de índices complexos agora
        const products = productsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as ProductDoc))
          .sort((a, b) => (b.revenue_cents || 0) - (a.revenue_cents || 0));

        stallsData.push({
          id: stallDoc.id,
          ...stallData,
          products,
        });
      }
      
      // Ordenar barracas por faturamento total
      stallsData.sort((a, b) => b.total_sales_cents - a.total_sales_cents);
      
      setStalls(stallsData);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [user, userDoc]);

  if (!user || (userDoc?.role !== "admin" && userDoc?.role !== "desenvolvedor")) return null;

  const eventTotalCents = stalls.reduce((sum, s) => sum + s.total_sales_cents, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in pb-24">
      <header className="flex items-center gap-3">
        <Link href="/admin" className="p-2 -ml-2 rounded-xl hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
          <BarChart2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--text-primary))]">Relatório Geral</h1>
        </div>
      </header>

      <div className="glass-card p-6 text-center">
        <p className="text-sm font-medium text-[hsl(var(--text-secondary))] uppercase tracking-wider mb-2">Total Vendas (Consumido)</p>
        <h2 className="text-5xl font-black tracking-tight text-emerald-500">{formatCurrency(eventTotalCents)}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card p-4 text-center">
          <p className="text-[10px] font-bold text-[hsl(var(--text-secondary))] uppercase tracking-wider mb-1 flex justify-center items-center gap-1">
            <Banknote className="w-3 h-3" /> Total Recargas
          </p>
          <p className="text-xl font-black text-primary">{formatCurrency(totalRecharges)}</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-[10px] font-bold text-[hsl(var(--text-secondary))] uppercase tracking-wider mb-1 flex justify-center items-center gap-1">
            <Wallet className="w-3 h-3" /> Saldo Retido
          </p>
          <p className="text-xl font-black text-warning">{formatCurrency(totalRetido)}</p>
        </div>
      </div>

      {/* Breakdown de recargas por forma de pagamento.
          Útil pro admin reconciliar caixa físico (cédulas) vs maquininha vs PIX. */}
      <section className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[hsl(var(--text-primary))] text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" /> Recargas por Forma de Pagamento
          </h3>
          <span className="text-[10px] text-[hsl(var(--text-muted))] uppercase tracking-wide font-semibold">
            {totalRecharges > 0 ? formatCurrency(totalRecharges) : "—"}
          </span>
        </div>

        {totalRecharges === 0 ? (
          <p className="text-sm text-[hsl(var(--text-muted))] text-center py-4">
            Nenhuma recarga registrada ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {[
              { key: "dinheiro" as const, label: "Dinheiro", color: "emerald", icon: Banknote },
              { key: "debito" as const, label: "Débito", color: "blue", icon: CreditCard },
              { key: "credito" as const, label: "Crédito", color: "violet", icon: CreditCard },
              { key: "pix" as const, label: "PIX", color: "cyan", icon: QrCode },
              { key: "outros" as const, label: "Outros / Não classificado", color: "gray", icon: MoreHorizontal },
            ].map(({ key, label, color, icon: Icon }) => {
              const value = methodBreakdown[key];
              const pct = totalRecharges > 0 ? (value / totalRecharges) * 100 : 0;
              if (value === 0 && key === "outros") return null; // esconde "outros" se zero

              const colorMap: Record<string, { text: string; bg: string; bar: string }> = {
                emerald: { text: "text-emerald-500", bg: "bg-emerald-500/10", bar: "bg-emerald-500" },
                blue:    { text: "text-blue-500",    bg: "bg-blue-500/10",    bar: "bg-blue-500" },
                violet:  { text: "text-violet-500",  bg: "bg-violet-500/10",  bar: "bg-violet-500" },
                cyan:    { text: "text-cyan-500",    bg: "bg-cyan-500/10",    bar: "bg-cyan-500" },
                gray:    { text: "text-[hsl(var(--text-muted))]", bg: "bg-[hsl(var(--bg))]", bar: "bg-[hsl(var(--text-muted))]" },
              };
              const c = colorMap[color];

              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center`}>
                        <Icon className={`w-3.5 h-3.5 ${c.text}`} />
                      </div>
                      <span className="font-medium text-[hsl(var(--text-primary))]">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[hsl(var(--text-muted))]">{pct.toFixed(0)}%</span>
                      <span className={`font-bold ${c.text} text-sm tabular-nums min-w-[80px] text-right`}>
                        {formatCurrency(value)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[hsl(var(--bg))]/60 rounded-full overflow-hidden">
                    <div className={`h-full ${c.bar} transition-all duration-300`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Diagnóstico: lista os valores brutos de payment_method que existem
            no banco. Útil pra detectar casos como CF antiga gravando "manual"
            ou recargas vindas de versões anteriores sem o campo. */}
        {Object.keys(methodRawCounts).length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-primary))] py-2 select-none">
              🔍 Diagnóstico (valores brutos no banco)
            </summary>
            <div className="mt-2 space-y-1 bg-[hsl(var(--bg))]/40 rounded-lg p-3 font-mono">
              {Object.entries(methodRawCounts)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([raw, info]) => (
                  <div key={raw} className="flex items-center justify-between gap-2">
                    <span className="text-[hsl(var(--text-primary))]">
                      <span className="text-[hsl(var(--text-muted))]">payment_method:</span>{" "}
                      <span className={raw === "manual" || raw === "(null/sem campo)" ? "text-warning font-bold" : "text-emerald-500"}>
                        {raw}
                      </span>
                    </span>
                    <span className="text-[hsl(var(--text-muted))]">
                      {info.count}× = {formatCurrency(info.total)}
                    </span>
                  </div>
                ))}
              <p className="text-[10px] text-[hsl(var(--text-muted))] mt-2 pt-2 border-t border-[hsl(var(--border))]/30 font-sans">
                Se aparece <strong className="text-warning">manual</strong> ou <strong className="text-warning">(null)</strong>:
                a Cloud Function rechargeBalance ainda está na versão antiga. Rode <code className="bg-[hsl(var(--bg))] px-1 rounded">firebase deploy --only functions:rechargeBalance</code> e teste de novo.
              </p>
            </div>
          </details>
        )}
      </section>

      {/* Barracas em grid 2x2 com painel inline na fileira (mesma UX do cardápio do user). */}
      <section className="space-y-4">
        <h3 className="font-semibold text-[hsl(var(--text-primary))] flex items-center gap-2">
          <Store className="w-4 h-4 text-primary" /> Desempenho das Barracas
        </h3>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : stalls.length === 0 ? (
          <div className="glass-card p-6 text-center text-[hsl(var(--text-muted))]">
            <p>Nenhuma barraca registrada.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(() => {
              // Divide as barracas em fileiras de 2 e renderiza o painel
              // logo abaixo da fileira que contém a barraca selecionada.
              const rows: typeof stalls[] = [];
              for (let i = 0; i < stalls.length; i += 2) {
                rows.push(stalls.slice(i, i + 2));
              }

              return rows.map((row, rowIdx) => {
                const expandedInRow = row.find(s => s.id === expandedStall);
                return (
                  <Fragment key={rowIdx}>
                    {/* Fileira de até 2 barracas */}
                    <div className="grid grid-cols-2 gap-3">
                      {row.map(stall => {
                        const isSelected = expandedStall === stall.id;
                        return (
                          <button
                            key={stall.id}
                            onClick={() => setExpandedStall(isSelected ? null : stall.id)}
                            className={`relative glass-card p-4 flex flex-col items-center text-center gap-1.5 transition-all duration-200 rounded-2xl border ${
                              isSelected
                                ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10"
                                : "border-transparent hover:border-primary/20 hover:bg-[hsl(var(--card))]/60"
                            }`}
                          >
                            {/* Status dot + ícone */}
                            <div className="relative">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                                isSelected ? "bg-primary/20" : "bg-primary/10"
                              }`}>
                                <Store className={`w-6 h-6 transition-colors ${isSelected ? "text-primary" : "text-primary/70"}`} />
                              </div>
                              <div
                                className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[hsl(var(--card))] ${stall.is_active ? "bg-emerald-500" : "bg-danger"}`}
                                title={stall.is_active ? "Ativa" : "Inativa"}
                              />
                            </div>

                            {/* Nome */}
                            <p className={`font-bold text-sm leading-tight transition-colors ${
                              isSelected ? "text-primary" : "text-[hsl(var(--text-primary))]"
                            }`}>
                              {stall.name}
                            </p>

                            {/* Faturamento — destaque principal num relatório */}
                            <p className="font-black text-emerald-500 text-base">
                              {formatCurrency(stall.total_sales_cents)}
                            </p>

                            {/* Quantidade de produtos */}
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                              isSelected
                                ? "bg-primary/15 text-primary"
                                : "bg-[hsl(var(--bg))] text-[hsl(var(--text-muted))]"
                            }`}>
                              {stall.products.length} {stall.products.length !== 1 ? "produtos" : "produto"}
                            </span>

                            {/* Chevron */}
                            <div className={`absolute bottom-2 right-2 transition-transform duration-200 ${isSelected ? "rotate-180" : ""}`}>
                              <ChevronDown className={`w-4 h-4 ${isSelected ? "text-primary" : "text-[hsl(var(--text-muted))]"}`} />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Painel inline com produtos (units_sold + revenue_cents) */}
                    {expandedInRow && (
                      <div className="glass-card overflow-hidden animate-slide-down rounded-2xl border border-primary/20">
                        {/* Cabeçalho */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))]/40 bg-primary/5">
                          <div className="flex items-center gap-2">
                            <Store className="w-4 h-4 text-primary" />
                            <p className="font-bold text-[hsl(var(--text-primary))] text-sm">{expandedInRow.name}</p>
                            <span className="text-xs text-[hsl(var(--text-muted))]">
                              · {formatCurrency(expandedInRow.total_sales_cents)} faturado
                            </span>
                          </div>
                          <button
                            onClick={() => setExpandedStall(null)}
                            className="p-1 rounded-full hover:bg-[hsl(var(--bg))] text-[hsl(var(--text-muted))]"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Tabela de produtos */}
                        {expandedInRow.products.length === 0 ? (
                          <p className="text-sm text-center text-[hsl(var(--text-muted))] py-6">
                            Nenhum produto cadastrado nesta barraca.
                          </p>
                        ) : (
                          <div className="divide-y divide-[hsl(var(--border))]/30">
                            {/* Cabeçalho da tabela (visível só em telas maiores) */}
                            <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 bg-[hsl(var(--bg))]/30 text-[10px] font-semibold text-[hsl(var(--text-muted))] uppercase tracking-wide">
                              <span>Produto</span>
                              <span className="text-center w-16">Vendidos</span>
                              <span className="text-right w-24">Faturamento</span>
                            </div>

                            {expandedInRow.products.map(p => {
                              const sold = p.units_sold || 0;
                              const revenue = p.revenue_cents || 0;
                              return (
                                <div
                                  key={p.id}
                                  className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 hover:bg-[hsl(var(--bg))]/30 transition-colors items-center"
                                >
                                  {/* Produto */}
                                  <div className="flex items-center gap-2 min-w-0">
                                    {p.emoji ? (
                                      <span className="text-xl shrink-0">{p.emoji}</span>
                                    ) : (
                                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <Store className="w-3.5 h-3.5 text-primary/50" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="font-medium text-[hsl(var(--text-primary))] text-sm truncate">{p.name}</p>
                                      <p className="text-[10px] text-[hsl(var(--text-muted))]">
                                        {formatCurrency(p.price_cents)} cada
                                      </p>
                                    </div>
                                  </div>

                                  {/* Unidades vendidas */}
                                  <div className="text-center w-16">
                                    <p className={`font-bold text-sm ${sold > 0 ? "text-[hsl(var(--text-primary))]" : "text-[hsl(var(--text-muted))]"}`}>
                                      {sold}
                                    </p>
                                    <p className="text-[10px] text-[hsl(var(--text-muted))] sm:hidden">unid.</p>
                                  </div>

                                  {/* Faturamento */}
                                  <div className="text-right w-24">
                                    <p className={`font-bold text-sm ${revenue > 0 ? "text-emerald-500" : "text-[hsl(var(--text-muted))]"}`}>
                                      {formatCurrency(revenue)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </Fragment>
                );
              });
            })()}
          </div>
        )}
      </section>

      {/* Fechamento por Caixa — agora abaixo das barracas, ordenado por chegada
          (mais recente primeiro) e limitado a 3 com link "ver tudo". */}
      <section className="space-y-4">
        <h3 className="font-semibold text-[hsl(var(--text-primary))] flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Fechamento por Caixa
        </h3>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : caixas.length === 0 ? (
          <div className="glass-card p-6 text-center text-[hsl(var(--text-muted))]">
            <p>Nenhuma recarga registrada.</p>
          </div>
        ) : (
          <>
            <div className="glass-card overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[hsl(var(--bg))]/50">
                    <th className="py-3 px-4 text-xs font-semibold text-[hsl(var(--text-secondary))] uppercase">Operador</th>
                    <th className="py-3 px-4 text-xs font-semibold text-[hsl(var(--text-secondary))] uppercase text-right">Arrecadado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]/30">
                  {caixas.slice(0, 3).map((c, i) => (
                    <tr key={i} className="hover:bg-[hsl(var(--bg))]/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-[hsl(var(--text-primary))] text-sm">{c.name}</td>
                      <td className="py-3 px-4 text-right font-bold text-primary">{formatCurrency(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {caixas.length > 3 && (
              <Link
                href="/admin/relatorio/caixas"
                className="block w-full py-3 px-4 rounded-xl border border-dashed border-[hsl(var(--border))] hover:border-primary/60 hover:bg-primary/5 transition-colors text-center group"
              >
                <div className="flex items-center justify-center gap-2 text-[hsl(var(--text-secondary))] group-hover:text-primary transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Ver fechamento de todos os caixas ({caixas.length})
                  </span>
                </div>
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  );
}
