import "server-only";

import { existsSync, readFileSync } from "node:fs";
import type { Money } from "@/lib/money";

const CONFIG_FILE = "config-momo.env";
const DEFAULT_BASE_URL = "https://sandbox.momodeveloper.mtn.com";

export type MtnMomoRequestToPayInput = {
  referenceId: string;
  amount: string;
  currency: string;
  externalId: string;
  payerMsisdn: string;
  payerMessage: string;
  payeeNote: string;
};

export type MtnMomoPaymentStatus = "PENDING" | "SUCCESSFUL" | "FAILED";

export type MtnMomoStatus = {
  amount?: string;
  currency?: string;
  financialTransactionId?: string;
  externalId?: string;
  status: MtnMomoPaymentStatus;
  reason?: unknown;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

export function providerMoneyFor(value: Money): { amount: string; currency: string } {
  const env = config().env;
  if (env === "sandbox") {
    return {
      amount: readOptional("MOMO_SANDBOX_AMOUNT") || "1",
      currency: readOptional("MOMO_SANDBOX_CURRENCY") || "EUR",
    };
  }
  return { amount: String(value.amount), currency: value.currency };
}

export async function requestToPay(input: MtnMomoRequestToPayInput): Promise<void> {
  const cfg = config();
  const token = await accessToken();
  const response = await fetch(`${cfg.baseUrl}/collection/v1_0/requesttopay`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Reference-Id": input.referenceId,
      "X-Target-Environment": cfg.targetEnvironment,
      "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      externalId: input.externalId,
      payer: {
        partyIdType: "MSISDN",
        partyId: input.payerMsisdn,
      },
      payerMessage: input.payerMessage,
      payeeNote: input.payeeNote,
    }),
  });
  if (response.status !== 202) {
    throw new MtnMomoError("MTN MoMo a refusé la demande de paiement.", response.status, await safeBody(response));
  }
}

export async function getRequestToPayStatus(referenceId: string): Promise<MtnMomoStatus> {
  const cfg = config();
  const token = await accessToken();
  const response = await fetch(`${cfg.baseUrl}/collection/v1_0/requesttopay/${referenceId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Target-Environment": cfg.targetEnvironment,
      "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
    },
  });
  const body = await safeBody(response);
  const data = asRecord(body);
  if (!response.ok || typeof data.status !== "string") {
    throw new MtnMomoError("Statut MTN MoMo indisponible.", response.status, body);
  }
  return data as MtnMomoStatus;
}

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;
  const cfg = config();
  const basic = Buffer.from(`${cfg.apiUser}:${cfg.apiKey}`, "ascii").toString("base64");
  const response = await fetch(`${cfg.baseUrl}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
    },
  });
  const body = await safeBody(response);
  const data = asRecord(body);
  if (!response.ok || typeof data.access_token !== "string") {
    throw new MtnMomoError("Token MTN MoMo indisponible.", response.status, body);
  }
  const expiresIn = Number(data.expires_in ?? 3600);
  cachedToken = {
    token: String(data.access_token),
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  };
  return cachedToken.token;
}

function config() {
  loadConfigFile();
  return {
    env: readOptional("MOMO_ENV") || "sandbox",
    baseUrl: readOptional("MOMO_BASE_URL") || DEFAULT_BASE_URL,
    targetEnvironment: readOptional("MOMO_TARGET_ENV") || "sandbox",
    subscriptionKey: required("MOMO_COLLECTION_SUBSCRIPTION_KEY"),
    apiUser: required("MOMO_API_USER"),
    apiKey: required("MOMO_API_KEY"),
  };
}

function loadConfigFile() {
  if (!existsSync(CONFIG_FILE)) return;
  for (const rawLine of readFileSync(CONFIG_FILE, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function required(name: string): string {
  const value = readOptional(name);
  if (!value || value.startsWith("replace-")) {
    throw new MtnMomoError(`Configuration ${name} manquante.`, 0, null);
  }
  return value;
}

function readOptional(name: string): string | undefined {
  return process.env[name]?.trim();
}

async function safeBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export class MtnMomoError extends Error {
  constructor(message: string, public status: number, public body: unknown) {
    super(message);
    this.name = "MtnMomoError";
  }
}
