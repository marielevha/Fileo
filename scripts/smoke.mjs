/**
 * Contrôle de bout en bout des routes, par rôle.
 *
 *   node scripts/smoke.mjs            (serveur sur http://localhost:3000)
 *
 * Vérifie surtout REC-11 et REC-12 : l'isolation des ateliers et le fait
 * qu'aucun montant n'est transmis à un collaborateur sans droit financier.
 */

import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const db = new DatabaseSync(join(process.cwd(), "data", "fileo.db"));

function mintSession(phone) {
  const user = db.prepare("SELECT id FROM users WHERE phone_e164 = ?").get(phone);
  if (!user) throw new Error(`Utilisateur inconnu: ${phone}`);

  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    user.id,
    createHash("sha256").update(token).digest("hex"),
    now,
    now,
    new Date(Date.now() + 86_400_000).toISOString(),
  );

  return token;
}

async function get(path, token) {
  const response = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: token ? { cookie: `fileo_session=${token}` } : {},
  });

  return {
    status: response.status,
    location: response.headers.get("location"),
    body: response.status === 200 ? await response.text() : "",
  };
}

let failures = 0;

function report(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label.padEnd(46)} ${actual}${ok ? "" : `  (attendu ${expected})`}`);
}

const owner = mintSession("+242061111111");
const collaborator = mintSession("+242062222222");
const staff = mintSession("+242060000001");

console.log("\nPages publiques\n");
for (const path of ["/fr", "/en", "/lg", "/fr/connexion", "/fr/inscription", "/fr/mentions-legales", "/fr/cgv"]) {
  report(path, (await get(path)).status, 200);
}

console.log("\nOffres localisées\n");
for (const locale of ["fr", "en", "lg"]) {
  const pricing = await get(`/${locale}`);
  report(`/${locale} affiche Filéo Pro`, pricing.body.includes("Filéo Pro"), true);
  report(`/${locale} affiche 5 000 FCFA`, /5[\s  ]000\s*FCFA/.test(pricing.body), true);
  report(
    `/${locale} transmet l'offre Pro`,
    pricing.body.includes(`/${locale}/inscription?offre=pro`),
    true,
  );

  if (locale === "en") {
    report(
      "/en ne mélange pas le lingala",
      !/Makoki|Ntalo|Kobanda|Mituna|Sango|Kokota|Fungola atelier/.test(pricing.body),
      true,
    );
  }
  if (locale === "lg") {
    report(
      "/lg ne mélange pas l'anglais",
      !/Explore features|Remaining to collect|Create my workshop|All rights reserved/.test(pricing.body),
      true,
    );
  }
}

const proSignup = await get("/fr/inscription?offre=pro");
report(
  "inscription conserve le code offre",
  /name="planCode" value="pro"/.test(proSignup.body),
  true,
);

console.log("\nSans session — redirection attendue\n");
for (const path of ["/fr/atelier", "/fr/atelier/clients", "/fr/admin"]) {
  const res = await get(path);
  report(`${path} → ${res.location ?? "?"}`, res.status, 307);
}

console.log("\nResponsable d'atelier (droit financier)\n");
for (const path of ["/fr/atelier", "/fr/atelier/clients", "/fr/atelier/commandes"]) {
  report(path, (await get(path, owner)).status, 200);
}

const ownerOrders = await get("/fr/atelier/commandes", owner);
const hasColumn = /Reste . payer/.test(ownerOrders.body);
const hasAmount = /7[\s  ]500/.test(ownerOrders.body);
report("colonne « Reste à payer » visible", hasColumn, true);
report("montant 7 500 transmis", hasAmount, true);

console.log("\nCollaborateur sans droit financier — REC-12\n");
const collabOrders = await get("/fr/atelier/commandes", collaborator);
report("/atelier/commandes accessible", collabOrders.status, 200);
report(
  "aucune colonne « Reste à payer »",
  !/Reste . payer/.test(collabOrders.body),
  true,
);
report("aucun montant dans la réponse", !/7[\s  ]500/.test(collabOrders.body), true);
report("/admin refusé", (await get("/fr/admin", collaborator)).status, 307);

console.log("\nÉquipe Filéo — back-office\n");
for (const path of ["/fr/admin", "/fr/admin/ateliers", "/fr/admin/reglements"]) {
  report(path, (await get(path, staff)).status, 200);
}

console.log(`\n${failures === 0 ? "Tout est conforme." : `${failures} échec(s).`}\n`);
db.close();
process.exit(failures === 0 ? 0 : 1);
