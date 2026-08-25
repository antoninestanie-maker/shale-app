// Fabriques de lignes Finance pour les tests. Chaque champ a un défaut
// plausible : un test ne mentionne que ce qui lui importe, et se lit donc comme
// l'énoncé du cas qu'il couvre.
import type {
  FinanceAccount,
  FinanceBalance,
  FinanceFxRate,
  FinanceHolding,
  FinanceQuote,
  FinanceRecurring,
  Trade,
} from "../types";

let seq = 0;
const prochainId = () => ++seq;

export function compte(p: Partial<FinanceAccount> = {}): FinanceAccount {
  return {
    id: prochainId(),
    label: "Compte courant",
    kind: "courant",
    currency: "EUR",
    institution: null,
    is_liquid: 1,
    archived: 0,
    position: 0,
    created_at: "2026-01-01 00:00:00",
    updated_at: "2026-01-01 00:00:00",
    ...p,
  };
}

export function releve(p: Partial<FinanceBalance> = {}): FinanceBalance {
  return {
    id: prochainId(),
    account_id: 1,
    date: "2026-08-01",
    amount_cents: 100_000,
    created_at: "2026-08-01 00:00:00",
    ...p,
  };
}

export function recurrent(p: Partial<FinanceRecurring> = {}): FinanceRecurring {
  return {
    id: prochainId(),
    label: "Loyer",
    amount_cents: 95_000,
    direction: "sortie",
    frequency: "mensuel",
    day_of_period: 5,
    category_id: null,
    account_id: null,
    active_from: "2026-01-01",
    active_to: null,
    created_at: "2026-01-01 00:00:00",
    updated_at: "2026-01-01 00:00:00",
    ...p,
  };
}

export function position(p: Partial<FinanceHolding> = {}): FinanceHolding {
  return {
    id: prochainId(),
    account_id: 1,
    symbol: "CW8.PA",
    quantity_e8: 100_000_000, // 1 part
    cost_basis_cents: null,
    source: "yahoo",
    created_at: "2026-01-01 00:00:00",
    updated_at: "2026-01-01 00:00:00",
    ...p,
  };
}

export function cotation(p: Partial<FinanceQuote> = {}): FinanceQuote {
  return {
    symbol: "CW8.PA",
    price_e8: 5_000_000_000, // 50,00
    currency: "EUR",
    source: "yahoo",
    fetched_at: "2026-08-25T08:00:00.000Z",
    ...p,
  };
}

export function taux(p: Partial<FinanceFxRate> = {}): FinanceFxRate {
  return {
    base: "USD",
    quote: "EUR",
    rate_e8: 92_000_000, // 0,92
    fetched_at: "2026-08-25T08:00:00.000Z",
    ...p,
  };
}

export function trade(p: Partial<Trade> = {}): Trade {
  return {
    id: prochainId(),
    date: "2026-08-10",
    instrument: "NQ",
    direction: "long",
    setup: null,
    risk_r: 1,
    result_r: 1,
    screenshot_path: null,
    notes: null,
    created_at: "2026-08-10 10:00:00",
    mode: "live",
    ...p,
  };
}
