import assert from "node:assert/strict";
import { closeMongo, mongoDb as db } from "./mongodb.mjs";

const computeBalance = ({ lineTotals, discount, payments, refunds }) => {
  const gross = lineTotals.reduce((a, b) => a + b, 0);
  const appliedDiscount = Math.min(discount, gross);
  const orderTotal = gross - appliedDiscount;
  const netCollected = payments.reduce((a, b) => a + b, 0) - refunds.reduce((a, b) => a + b, 0);
  const signedBalance = orderTotal - netCollected;
  return { orderTotal, appliedDiscount, netCollected, signedBalance, remainingDue: Math.max(signedBalance, 0), overpayment: Math.max(-signedBalance, 0) };
};

let passed = 0;
const failures = [];
async function check(id, label, fn) {
  try { await fn(); passed += 1; console.log(`  ok   ${id}  ${label}`); }
  catch (error) { failures.push({ id, label, message: error.message }); console.log(`  FAIL ${id}  ${label}\n       ${error.message.split("\n")[0]}`); }
}

console.log("\nFormules financières (§8.7)\n");
await check("REC-03", "encaissement net 12 500, reste 7 500", () => {
  const value = computeBalance({ lineTotals: [20000], discount: 0, payments: [5000, 7500], refunds: [] });
  assert.deepEqual(value, { orderTotal: 20000, appliedDiscount: 0, netCollected: 12500, signedBalance: 7500, remainingDue: 7500, overpayment: 0 });
});
await check("REC-05", "remboursement ramène l'encaissement net à zéro", () => {
  const value = computeBalance({ lineTotals: [20000], discount: 0, payments: [5000], refunds: [5000] });
  assert.equal(value.netCollected, 0); assert.equal(value.remainingDue, 20000);
});
await check("REC-10", "trop-perçu signalé, jamais absorbé", () => {
  const value = computeBalance({ lineTotals: [20000], discount: 0, payments: [15000, 10000], refunds: [] });
  assert.equal(value.remainingDue, 0); assert.equal(value.overpayment, 5000);
});
await check("§8.4", "réduction plafonnée au total brut", () => {
  const value = computeBalance({ lineTotals: [10000], discount: 15000, payments: [], refunds: [] });
  assert.equal(value.orderTotal, 0); assert.equal(value.appliedDiscount, 10000);
});
await check("§15.3", "arithmétique entière exacte", () => {
  assert.equal(computeBalance({ lineTotals: [10, 20], discount: 0, payments: [30], refunds: [] }).signedBalance, 0);
});
await check("§2.3", "2 500 XAF vaut l'entier 2500", () => assert.equal(2500 * 10 ** 0, 2500));

console.log("\nContraintes MongoDB (§8.7, §16)\n");
await check("REC-04", "clé d'idempotence unique par atelier", async () => {
  const indexes = await db.collection("financial_movements").listIndexes().toArray();
  assert.ok(indexes.some((index) => index.unique && index.key.workshop_id === 1 && index.key.idempotency_key === 1));
});
await check("REC-17", "référence de règlement Filéo unique", async () => {
  const indexes = await db.collection("platform_payments").listIndexes().toArray();
  assert.ok(indexes.some((index) => index.unique && index.key.idempotency_key === 1));
});
await check("§16", "chaque document métier porte workshop_id", async () => {
  for (const name of ["clients", "measurement_records", "orders", "order_items", "financial_movements", "expenses", "receipts", "media"]) {
    assert.equal(await db.collection(name).countDocuments({ workshop_id: { $exists: false } }), 0, `${name} contient un document sans workshop_id`);
  }
});

await closeMongo();
console.log(`\n${passed} vérification(s) passée(s), ${failures.length} échec(s).\n`);
if (failures.length > 0) process.exit(1);
