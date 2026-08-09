import "server-only";

/**
 * Wrapper fino sobre a API REST do Asaas. Server-only: a chave de API
 * nunca deve chegar ao client. Autenticação do Asaas é pelo header
 * "access_token" (não é Bearer).
 */
const BASE_URL = process.env.ASAAS_API_BASE_URL;
const API_KEY = process.env.ASAAS_API_KEY;

export class AsaasError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
    this.name = "AsaasError";
  }
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE_URL || !API_KEY) {
    throw new AsaasError("Integração Asaas não configurada (faltam variáveis de ambiente).", 0, null);
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: API_KEY,
      ...init?.headers,
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      (body as { errors?: { description?: string }[] })?.errors?.[0]?.description ??
      `Asaas retornou ${res.status}`;
    throw new AsaasError(message, res.status, body);
  }
  return body as T;
}

export type AsaasAccount = { name: string; email: string; walletId: string };

export async function getMyAccount() {
  return asaasFetch<AsaasAccount>("/myAccount");
}

export type AsaasCustomer = { id: string; name: string; cpfCnpj: string; email: string | null };

export async function findCustomerByCpf(cpfCnpj: string) {
  const res = await asaasFetch<{ data: AsaasCustomer[] }>(
    `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`,
  );
  return res.data[0] ?? null;
}

export async function createCustomer(input: {
  name: string;
  cpfCnpj: string;
  email?: string;
  externalReference?: string;
}) {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type AsaasSubscription = {
  id: string;
  customer: string;
  billingType: "CREDIT_CARD" | "PIX" | "BOLETO" | "UNDEFINED";
  value: number;
  cycle: string;
  status: string;
};

export async function createSubscription(input: {
  customer: string;
  billingType: "CREDIT_CARD" | "PIX" | "BOLETO" | "UNDEFINED";
  value: number;
  nextDueDate: string;
  cycle: "MONTHLY";
  description: string;
}) {
  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function cancelSubscription(subscriptionId: string) {
  return asaasFetch<{ deleted: boolean }>(`/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });
}

export async function getSubscriptionPaymentLink(subscriptionId: string) {
  const res = await asaasFetch<{ data: { invoiceUrl: string }[] }>(
    `/subscriptions/${subscriptionId}/payments`,
  );
  return res.data[0]?.invoiceUrl ?? null;
}

export type AsaasFinancialTransaction = {
  id: string;
  type: string;
  value: number;
  date: string;
  description: string;
};

const FEE_TYPES = new Set([
  "TRANSFER_FEE",
  "PAYMENT_FEE",
  "PIX_TRANSACTION_DEBIT_FEE",
  "BILL_PAYMENT_FEE",
  "INVOICE_FEE",
  "POSTAL_SERVICE_FEE",
]);

/** Busca todas as páginas de extrato do período (limit máximo do Asaas é 100/página). */
export async function listFinancialTransactions(startDate: string, finishDate: string) {
  const all: AsaasFinancialTransaction[] = [];
  let offset = 0;
  for (;;) {
    const res = await asaasFetch<{ data: AsaasFinancialTransaction[]; hasMore: boolean }>(
      `/financialTransactions?startDate=${startDate}&finishDate=${finishDate}&limit=100&offset=${offset}`,
    );
    all.push(...res.data);
    if (!res.hasMore) break;
    offset += 100;
  }
  return all;
}

export function isAsaasFeeTransaction(type: string) {
  return FEE_TYPES.has(type);
}
