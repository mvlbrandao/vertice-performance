import "server-only";

/**
 * Wrapper fino sobre a API REST do Asaas. Server-only: a chave de API
 * nunca deve chegar ao client. Autenticação do Asaas é pelo header
 * "access_token" (não é Bearer).
 */
import type { AsaasCredentials } from "@/lib/asaas/credentials";

/**
 * A credencial vem por parâmetro, não do ambiente. Antes era uma constante
 * de módulo — a nossa chave, usada para todo mundo. Num sistema com vários
 * clubes isso mandaria o dinheiro dos responsáveis de um clube pra conta de
 * outro; passar a credencial explicitamente torna impossível esquecer de
 * qual conta se está falando.
 */
export class AsaasNotConnectedError extends Error {
  constructor() {
    super("Este clube ainda não conectou uma conta Asaas.");
    this.name = "AsaasNotConnectedError";
  }
}

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

async function asaasFetch<T>(
  creds: AsaasCredentials | null,
  path: string,
  init?: RequestInit,
): Promise<T> {
  if (!creds) throw new AsaasNotConnectedError();

  const res = await fetch(`${creds.baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: creds.apiKey,
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

export async function getMyAccount(creds: AsaasCredentials) {
  return asaasFetch<AsaasAccount>(creds, "/myAccount");
}

export type AsaasCustomer = { id: string; name: string; cpfCnpj: string; email: string | null };

export async function findCustomerByCpf(creds: AsaasCredentials, cpfCnpj: string) {
  const res = await asaasFetch<{ data: AsaasCustomer[] }>(
    creds,
    `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`,
  );
  return res.data[0] ?? null;
}

export async function createCustomer(creds: AsaasCredentials, input: {
  name: string;
  cpfCnpj: string;
  email?: string;
  externalReference?: string;
}) {
  return asaasFetch<AsaasCustomer>(creds, "/customers", {
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

export async function createSubscription(creds: AsaasCredentials, input: {
  customer: string;
  billingType: "CREDIT_CARD" | "PIX" | "BOLETO" | "UNDEFINED";
  value: number;
  nextDueDate: string;
  cycle: "MONTHLY";
  description: string;
}) {
  return asaasFetch<AsaasSubscription>(creds, "/subscriptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function cancelSubscription(creds: AsaasCredentials, subscriptionId: string) {
  return asaasFetch<{ deleted: boolean }>(creds, `/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });
}

export async function getSubscriptionPaymentLink(creds: AsaasCredentials, subscriptionId: string) {
  const res = await asaasFetch<{ data: { invoiceUrl: string }[] }>(
    creds,
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
export async function listFinancialTransactions(
  creds: AsaasCredentials,
  startDate: string,
  finishDate: string,
) {
  const all: AsaasFinancialTransaction[] = [];
  let offset = 0;
  for (;;) {
    const res = await asaasFetch<{ data: AsaasFinancialTransaction[]; hasMore: boolean }>(
      creds,
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

export type AsaasNotification = {
  id: string;
  customer: string;
  enabled: boolean;
  emailEnabledForCustomer: boolean;
  smsEnabledForCustomer: boolean;
  phoneCallEnabledForCustomer: boolean;
  whatsappEnabledForCustomer: boolean;
  event:
    | "PAYMENT_CREATED"
    | "PAYMENT_DUEDATE_WARNING"
    | "PAYMENT_OVERDUE"
    | "PAYMENT_RECEIVED"
    | string;
  scheduleOffset: number;
};

/** Régua de cobrança: regras de lembrete (e-mail/SMS/WhatsApp/ligação) configuradas para o cliente no Asaas. */
export async function getCustomerNotifications(creds: AsaasCredentials, customerId: string) {
  const res = await asaasFetch<{ data: AsaasNotification[] }>(
    creds,
    `/customers/${customerId}/notifications`,
  );
  return res.data;
}
