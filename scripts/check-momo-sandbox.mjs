import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const CONFIG_FILE = "config-momo.env";
const DEFAULT_BASE_URL = "https://sandbox.momodeveloper.mtn.com";
const DEFAULT_TARGET_ENV = "sandbox";
const DEFAULT_CURRENCY = "EUR";
const DEFAULT_AMOUNT = "1";
const DEFAULT_PAYER_MSISDN = "46733123453";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function required(name) {
  const value = process.env[name];
  if (!value || value.startsWith("replace-")) {
    throw new Error(`${name} manquant dans ${CONFIG_FILE} ou dans l'environnement.`);
  }
  return value;
}

function check(label, condition) {
  console.log(`  ${condition ? "ok  " : "FAIL"} ${label}`);
  if (!condition) throw new Error(label);
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  return { response, body };
}

loadEnvFile(CONFIG_FILE);

const baseUrl = process.env.MOMO_BASE_URL || DEFAULT_BASE_URL;
const targetEnvironment = process.env.MOMO_TARGET_ENV || DEFAULT_TARGET_ENV;
const subscriptionKey = required("MOMO_COLLECTION_SUBSCRIPTION_KEY");
const apiUser = required("MOMO_API_USER");
const apiKey = required("MOMO_API_KEY");
const currency = process.env.MOMO_SANDBOX_CURRENCY || DEFAULT_CURRENCY;
const amount = process.env.MOMO_SANDBOX_AMOUNT || DEFAULT_AMOUNT;
const payerMsisdn = process.env.MOMO_SANDBOX_PAYER_MSISDN || DEFAULT_PAYER_MSISDN;

console.log("\nMTN MoMo sandbox - Collection Request to Pay\n");

const basic = Buffer.from(`${apiUser}:${apiKey}`, "ascii").toString("base64");
const tokenResult = await requestJson(`${baseUrl}/collection/token/`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${basic}`,
    "Ocp-Apim-Subscription-Key": subscriptionKey,
  },
});
check("token recu", tokenResult.response.ok && Boolean(tokenResult.body?.access_token));
check("token type valide", tokenResult.body?.token_type === "access_token");
console.log(`  ok   expiration token: ${tokenResult.body.expires_in}s`);

const referenceId = randomUUID();
const externalId = `fileo-sandbox-${Date.now()}`;
const paymentPayload = {
  amount,
  currency,
  externalId,
  payer: {
    partyIdType: "MSISDN",
    partyId: payerMsisdn,
  },
  payerMessage: "Test Fileo abonnement",
  payeeNote: "Test Fileo sandbox",
};

const requestToPayResult = await requestJson(`${baseUrl}/collection/v1_0/requesttopay`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${tokenResult.body.access_token}`,
    "X-Reference-Id": referenceId,
    "X-Target-Environment": targetEnvironment,
    "Ocp-Apim-Subscription-Key": subscriptionKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(paymentPayload),
});
check("requesttopay accepte", requestToPayResult.response.status === 202);
console.log(`  ok   reference paiement: ${referenceId}`);

const statusResult = await requestJson(`${baseUrl}/collection/v1_0/requesttopay/${referenceId}`, {
  method: "GET",
  headers: {
    Authorization: `Bearer ${tokenResult.body.access_token}`,
    "X-Target-Environment": targetEnvironment,
    "Ocp-Apim-Subscription-Key": subscriptionKey,
  },
});
check("statut requesttopay lisible", statusResult.response.ok && Boolean(statusResult.body?.status));
console.log(`  ok   statut: ${statusResult.body.status}`);
console.log(`  ok   montant: ${statusResult.body.amount} ${statusResult.body.currency}`);
if (statusResult.body.financialTransactionId) {
  console.log(`  ok   transaction MTN: ${statusResult.body.financialTransactionId}`);
}

console.log("\nTout est conforme. Aucun secret n'a ete affiche.\n");
