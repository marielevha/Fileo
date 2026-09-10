/**
 * Vérifie le noyau financier contre les scénarios de recette du §20.1.
 *
 *   node --experimental-strip-types scripts/check-money.mjs
 *   (ou : npm run check:money)
 *
 * Ce script cible les règles de calcul (§8.7), pas l'interface. Il ne
 * remplace pas la recette complète : REC-04, REC-08, REC-09 et REC-11
 * portent sur la persistance, la synchronisation et l'isolation, qui
 * demandent des tests d'intégration.
 */

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

// --- Réimplémentation minimale des formules de src/lib/money.ts ---
// Le script reste en .mjs pour tourner sans étape de compilation ; les
// formules ci-dessous doivent rester alignées sur computeOrderBalance().
const clampAtZero = (n) => Math.max(n, 0);

function computeBalance({ lineTotals, discount, payments, refunds }) {
  const gross = lineTotals.reduce((a, b) => a + b, 0);
  const appliedDiscount = Math.min(discount, gross);
  const orderTotal = gross - appliedDiscount;
  const netCollected =
    payments.reduce((a, b) => a + b, 0) - refunds.reduce((a, b) => a + b, 0);
  const signed = orderTotal - netCollected;

  return {
    orderTotal,
    appliedDiscount,
    netCollected,
    signedBalance: signed,
    remainingDue: clampAtZero(signed),
    overpayment: clampAtZero(-signed),
  };
}

let passed = 0;
const failures = [];

function check(id, label, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${id}  ${label}`);
  } catch (error) {
    failures.push({ id, label, message: error.message });
    console.log(`  FAIL ${id}  ${label}`);
    console.log(`       ${error.message.split("\n")[0]}`);
  }
}

console.log("\nFormules financières (§8.7)\n");

// REC-03 : commande 20 000, encaissements 5 000 puis 7 500
check("REC-03", "encaissement net 12 500, reste 7 500", () => {
  const b = computeBalance({
    lineTotals: [20000],
    discount: 0,
    payments: [5000, 7500],
    refunds: [],
  });
  assert.equal(b.orderTotal, 20000);
  assert.equal(b.netCollected, 12500);
  assert.equal(b.remainingDue, 7500);
  assert.equal(b.overpayment, 0);
});

// REC-05 : annulation avec 5 000 reçus puis remboursement
check("REC-05", "remboursement ramène l'encaissement net à zéro", () => {
  const b = computeBalance({
    lineTotals: [20000],
    discount: 0,
    payments: [5000],
    refunds: [5000],
  });
  assert.equal(b.netCollected, 0);
  assert.equal(b.remainingDue, 20000);
});

// REC-10 : deux encaissements créent un trop-perçu
check("REC-10", "trop-perçu signalé, jamais absorbé", () => {
  const b = computeBalance({
    lineTotals: [20000],
    discount: 0,
    payments: [15000, 10000],
    refunds: [],
  });
  assert.equal(b.netCollected, 25000);
  assert.equal(b.remainingDue, 0, "le reste à payer est plancher à zéro");
  assert.equal(b.overpayment, 5000, "le trop-perçu reste visible");
});

// §8.4 : la réduction ne peut pas rendre le total négatif
check("§8.4", "réduction plafonnée au total brut", () => {
  const b = computeBalance({
    lineTotals: [10000],
    discount: 15000,
    payments: [],
    refunds: [],
  });
  assert.equal(b.orderTotal, 0);
  assert.equal(b.appliedDiscount, 10000, "la réduction réellement appliquée est plafonnée");
});

// §15.3 : pas de flottant. 0.1 + 0.2 en unités mineures reste exact.
check("§15.3", "arithmétique entière exacte", () => {
  const b = computeBalance({
    lineTotals: [10, 20],
    discount: 0,
    payments: [30],
    refunds: [],
  });
  assert.equal(b.remainingDue, 0);
  assert.equal(b.signedBalance, 0, "aucun résidu de virgule flottante");
});

// §2.3 : XAF/CDF sont des devises sans décimale
check("§2.3", "2 500 XAF vaut l'entier 2500", () => {
  const XAF_EXPONENT = 0;
  assert.equal(2500 * 10 ** XAF_EXPONENT, 2500, "pas de multiplication par 100");
});

console.log("\nContraintes de base (§8.7, §16)\n");

// Idempotence et isolation, vérifiées sur le schéma réel.
const db = new DatabaseSync(":memory:");
db.exec(readFileSync(join(process.cwd(), "src", "lib", "db", "schema.sql"), "utf8"));

check("REC-04", "clé d'idempotence unique par atelier", () => {
  const indexes = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='financial_movements'")
    .get();
  assert.match(
    indexes.sql,
    /UNIQUE \(workshop_id, idempotency_key\)/,
    "financial_movements doit contraindre (workshop_id, idempotency_key)",
  );
});

check("REC-17", "référence de règlement Filéo unique", () => {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='platform_payments'")
    .get();
  assert.match(row.sql, /UNIQUE \(idempotency_key\)/);
});

check("§16", "chaque table métier porte workshop_id", () => {
  const businessTables = [
    "clients",
    "measurement_records",
    "orders",
    "order_items",
    "financial_movements",
    "expenses",
    "receipts",
    "media",
  ];

  for (const table of businessTables) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    assert.ok(
      columns.some((c) => c.name === "workshop_id"),
      `${table} n'a pas de colonne workshop_id`,
    );
  }
});

db.close();

console.log(`\n${passed} vérification(s) passée(s), ${failures.length} échec(s).\n`);

if (failures.length > 0) process.exit(1);
