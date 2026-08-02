import { useMemo, useState } from "react";
import { useSession } from "../components/auth/AuthGate";
import { AUTH_CONFIGURED } from "../lib/auth/config";

import { t } from "../lib/i18n";
// ─────────────────────────────────────────────────────────────────────────────
// Console d'administration (mode Admin, accessible selon le rôle).
// Données de démonstration ; en production, brancher sur Supabase (auth.users +
// table `subscriptions`) via une session admin (RLS) ou une edge function.
// ─────────────────────────────────────────────────────────────────────────────

type Status = "active" | "trialing" | "past_due" | "canceled";
interface Row {
  email: string;
  plan: string;
  status: Status;
  mrr: string;
  since: string;
}

const DEMO_USERS: Row[] = [
  { email: "antonin.estanie@icloud.com", plan: t("annuel"), status: "active", mrr: "15,80 €", since: t("12 janv.") },
  { email: "lucas.martin@gmail.com", plan: t("mensuel"), status: "active", mrr: "12,99 €", since: t("3 févr.") },
  { email: "sophie.durand@outlook.fr", plan: t("annuel"), status: "active", mrr: "15,80 €", since: t("21 févr.") },
  { email: "kevin.blanc@proton.me", plan: t("mensuel"), status: "trialing", mrr: "0,00 €", since: t("24 juil.") },
  { email: "amine.k@gmail.com", plan: t("mensuel"), status: "past_due", mrr: "12,99 €", since: t("9 mars") },
  { email: "julie.roy@gmail.com", plan: t("annuel"), status: "active", mrr: "15,80 €", since: t("14 avr.") },
  { email: "hugo.petit@gmail.com", plan: t("mensuel"), status: "active", mrr: "12,99 €", since: t("6 juin") },
  { email: "clara.moreau@proton.me", plan: t("annuel"), status: "trialing", mrr: "0,00 €", since: t("22 juil.") },
];

const statusMeta = (): Record<Status, { label: string; color: string }> => ({
  active: { label: "Actif", color: "var(--color-green)" },
  trialing: { label: "Essai", color: "var(--color-blue)" },
  past_due: { label: t("Impayé"), color: "var(--color-red)" },
  canceled: { label: t("Résilié"), color: "var(--color-text-dim)" },
});

function StatusPill({ status }: { status: Status }) {
  const m = statusMeta()[status];
  return (
    <span
      className="pill inline-flex items-center gap-1.5 border px-2.5 py-0.5 text-[12px] font-medium"
      style={{
        color: m.color,
        borderColor: `color-mix(in srgb, ${m.color} 40%, transparent)`,
        background: `color-mix(in srgb, ${m.color} 12%, transparent)`,
      }}
    >
      {m.label}
    </span>
  );
}

const SPARK = [12, 15, 11, 18, 22, 19, 24, 21, 27, 25, 30, 33, 31, 35, 40, 43, 48, 52, 49, 55];

function Sparkline() {
  const W = 220;
  const H = 44;
  const min = Math.min(...SPARK);
  const max = Math.max(...SPARK);
  const d = SPARK.map((v, i) => {
    const x = (i / (SPARK.length - 1)) * W;
    const y = H - ((v - min) / (max - min)) * (H - 6) - 3;
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-11 w-full" preserveAspectRatio="none">
      <path
        d={`${d} L${W} ${H} L0 ${H} Z`}
        fill="color-mix(in srgb, var(--color-blue) 18%, transparent)"
      />
      <path d={d} fill="none" stroke="var(--color-blue)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function ConsoleView() {
  const { session } = useSession();
  const [users, setUsers] = useState<Row[]>(DEMO_USERS);
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () => users.filter((u) => u.email.toLowerCase().includes(q.trim().toLowerCase())),
    [users, q],
  );

  const activeCount = users.filter((u) => u.status === "active" || u.status === "trialing").length;

  const toggleSuspend = (email: string) =>
    setUsers((list) =>
      list.map((u) =>
        u.email === email
          ? { ...u, status: u.status === "canceled" ? "active" : "canceled" }
          : u,
      ),
    );

  const kpis = [
    { label: "Utilisateurs", value: "1 284", delta: "+86" },
    { label: t("Abonnés actifs"), value: "1 043", delta: "+41" },
    { label: "MRR", value: "16 240 €", delta: "+12,4 %" },
    { label: "Churn 30 j", value: "2,7 %", delta: "−0,4 pt" },
  ];

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="hud-label">administration</p>
          <h1 className="mt-1 text-3xl text-text">Console</h1>
        </div>
        <span className="pill inline-flex items-center gap-2 border border-border bg-surface-2 px-3 py-1 text-[12px] text-text-dim">
          <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-green" />
          {session?.user.email}
        </span>
      </div>

      {/* KPI */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <p className="hud-label">{k.label}</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <span className="text-2xl font-bold tabular-nums text-text">{k.value}</span>
              <span className="text-[12px] font-semibold text-green">{k.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Inscriptions */}
      <div className="mt-3 card p-5">
        <div className="flex items-center justify-between">
          <p className="hud-label">inscriptions · 30 j</p>
          <span className="text-sm font-semibold text-green">+619</span>
        </div>
        <div className="mt-3">
          <Sparkline />
        </div>
      </div>

      {/* Utilisateurs */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-text">Utilisateurs</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Rechercher un e-mail…")}
          className="w-full max-w-xs rounded-[var(--radius-field)] border border-border bg-surface-2 px-3.5 py-2 text-sm text-text outline-none focus:border-blue/60"
        />
      </div>

      <div className="mt-3 card overflow-hidden p-0">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-text-dim">
                <th className="px-4 py-3 font-medium">Utilisateur</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">MRR</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.email} className="border-b border-border/60 transition-colors hover:bg-overlay">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold uppercase text-text-dim">
                        {u.email.slice(0, 2)}
                      </span>
                      <span className="text-text">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-dim">{u.plan}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={u.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-text-dim">{u.mrr}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleSuspend(u.email)}
                      className="pill border border-border px-3 py-1.5 text-[12px] text-text-dim transition-colors hover:border-red/50 hover:text-red"
                    >
                      {u.status === "canceled" ? t("Réactiver") : "Suspendre"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-text-dim">
                    {t("Aucun utilisateur.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-[12px] text-text-dim">
        {AUTH_CONFIGURED
          ? t("Astuce : branche cette console sur la table Supabase « subscriptions » (session admin / RLS) pour des données réelles.")
          : t("Données de démonstration (mode démo). En production, elles viennent de Supabase + Stripe.")}{" "}
        {activeCount} abonnés actifs affichés.
      </p>
    </div>
  );
}
