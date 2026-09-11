import { closeMongo, mongoDb as db } from "./mongodb.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const cookies = new Map();

function decodeHtml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

function rememberCookies(response) {
  const values = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie")];
  for (const value of values) {
    if (!value) continue;
    const [pair] = value.split(";");
    const separator = pair.indexOf("=");
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function cookieHeader() {
  return [...cookies].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function get(path) {
  const response = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookieHeader() ? { cookie: cookieHeader() } : {},
  });
  rememberCookies(response);
  return { response, html: await response.text() };
}

function findForm(html, buttonText) {
  const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map((match) => match[0]);
  const form = forms.find((candidate) => decodeHtml(candidate).includes(buttonText));
  if (!form) throw new Error(`Formulaire introuvable: ${buttonText}`);
  return form;
}

async function submit(path, formHtml, values) {
  const body = new FormData();
  for (const match of formHtml.matchAll(/<input\s+type="hidden"\s+name="([^"]+)"(?:\s+value="([^"]*)")?\s*\/>/g)) {
    body.append(match[1], decodeHtml(match[2]));
  }
  for (const [key, value] of Object.entries(values)) body.set(key, value);

  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    body,
    redirect: "manual",
    headers: { cookie: cookieHeader(), origin: BASE },
  });
  rememberCookies(response);
  return response;
}

function check(label, condition) {
  console.log(`  ${condition ? "ok  " : "FAIL"} ${label}`);
  if (!condition) throw new Error(label);
}

try {
  console.log("\nEquipe atelier - gestion des membres\n");

  const loginPage = await get("/fr/connexion");
  const loginResponse = await submit(
    "/fr/connexion",
    findForm(loginPage.html, "Se connecter"),
    { country: "CG", phone: "+242061111111", password: "Atelier2026!" },
  );
  check("connexion responsable", loginResponse.status === 303);

  const page = await get("/fr/atelier/equipe");
  check("page equipe accessible", page.response.status === 200);
  check("formulaire ajout visible", page.html.includes("Téléphone du compte"));
  check("table membres visible", page.html.includes("Droit financier") && page.html.includes("Actions"));
  check("action retirer visible", page.html.includes("Retirer"));

  const owner = await db.collection("users").findOne({ phone_e164: "+242061111111" }, { projection: { id: 1 } });
  const membership = await db.collection("memberships").findOne(
    { user_id: { $ne: owner.id }, status: "active" },
    { projection: { id: 1, workshop_id: 1, role: 1, can_view_money: 1 } },
  );
  if (!membership) throw new Error("Aucun collaborateur disponible pour le test.");

  const original = { role: membership.role, can_view_money: membership.can_view_money };
  const updateForm = findForm(page.html, "Mettre à jour");
  const response = await submit("/fr/atelier/equipe", updateForm, {
    membershipId: membership.id,
    role: "collaborator",
    status: "active",
    canViewMoney: "on",
  });
  check("mise a jour acceptee", response.status === 200);
  const updated = await db.collection("memberships").findOne({ id: membership.id }, { projection: { can_view_money: 1 } });
  check("droit financier modifie", updated.can_view_money === 1 || updated.can_view_money === true);

  await db.collection("memberships").updateOne(
    { id: membership.id },
    { $set: { role: original.role, can_view_money: original.can_view_money } },
  );

  const addForm = findForm(page.html, "Ajouter");
  const blocked = await submit("/fr/atelier/equipe", addForm, {
    phone: "+242062222205",
    role: "collaborator",
  });
  check("limite abonnement bloque l'ajout", blocked.status === 200);
  const blockedPage = await get("/fr/atelier/equipe");
  check(
    "message limite visible",
    blockedPage.html.includes("Limite d'abonnement atteinte") ||
      blockedPage.html.includes("dépasse la limite") ||
      blockedPage.html.includes("0 place"),
  );

  console.log("\nTout est conforme.\n");
} finally {
  await closeMongo();
}
