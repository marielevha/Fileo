import { randomUUID } from "node:crypto";
import { closeMongo, mongoDb as db } from "./mongodb.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const cookies = new Map();
let createdId = null;
const paginationIds = [];

function decodeHtml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

function visibleText(html) {
  return decodeHtml(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");
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
  for (const [key, value] of Object.entries(values)) body.append(key, value);
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
  console.log("\nClients - ajout, modification et suppression logique\n");
  const loginPage = await get("/fr/connexion");
  const loginResponse = await submit(
    "/fr/connexion",
    findForm(loginPage.html, "Se connecter"),
    { country: "CG", phone: "+242061111111", password: "Atelier2026!" },
  );
  check("connexion responsable", loginResponse.status === 303 && loginResponse.headers.get("location") === "/atelier");

  const createPage = await get("/fr/atelier/clients/nouveau");
  check("formulaire d'ajout accessible", createPage.response.status === 200);
  const uniqueName = `Client test ${Date.now()}`;
  const createResponse = await submit(
    "/fr/atelier/clients/nouveau",
    findForm(createPage.html, "Ajouter le client"),
    {
      displayName: uniqueName,
      phone: "061234567",
      otherContact: "contact test",
      guardianName: "",
      guardianPhone: "",
      notes: "Créé par check:clients",
    },
  );
  const location = createResponse.headers.get("location") ?? "";
  createdId = /\/atelier\/clients\/([^/?]+)/.exec(location)?.[1] ?? null;
  check("création redirige vers la fiche", createResponse.status === 303 && Boolean(createdId));
  check(
    "client créé en base",
    Boolean(await db.collection("clients").findOne({ id: createdId, deleted_at: null })),
  );

  const editPath = `/fr/atelier/clients/${createdId}/modifier`;
  const editPage = await get(editPath);
  const updatedName = `${uniqueName} modifié`;
  const updateResponse = await submit(editPath, findForm(editPage.html, "Enregistrer les modifications"), {
    displayName: updatedName,
    phone: "061234567",
    otherContact: "contact modifié",
    guardianName: "",
    guardianPhone: "",
    notes: "Fiche modifiée",
  });
  check("modification redirige vers la fiche", updateResponse.status === 303);
  check(
    "modification persistée",
    (await db.collection("clients").findOne({ id: createdId }))?.display_name === updatedName,
  );

  const searchPage = await get(`/fr/atelier/clients?q=${encodeURIComponent(updatedName)}`);
  check("recherche directe filtre la liste", searchPage.html.includes(updatedName) && !searchPage.html.includes("Grâce B"));

  const owner = await db.collection("clients").findOne({ id: createdId }, { projection: { workshop_id: 1, created_by: 1 } });
  const paginationPrefix = `Pagination test ${Date.now()}`;
  const paginationRows = [];
  for (let index = 1; index <= 11; index += 1) {
    const id = randomUUID();
    const now = new Date().toISOString();
    paginationIds.push(id);
    paginationRows.push({ id, workshop_id: owner.workshop_id, display_name: `${paginationPrefix} ${String(index).padStart(2, "0")}`, phone_e164: null, phone_search: null, other_contact: null, guardian_name: null, guardian_phone: null, notes: null, archived_at: null, deleted_at: null, created_by: owner.created_by, created_at: now, updated_at: now, row_version: 1 });
  }
  await db.collection("clients").insertMany(paginationRows);

  const encodedPrefix = encodeURIComponent(paginationPrefix);
  const firstPage = await get(`/fr/atelier/clients?q=${encodedPrefix}&sort=name&dir=asc&taille=10&page=1`);
  check("pagination annonce deux pages", /11\s+fiche\s*s?\s+-\s+page\s+1\s+sur\s+2/.test(visibleText(firstPage.html)));
  check(
    "tri croissant et limite de page appliqués",
    firstPage.html.indexOf(`${paginationPrefix} 01`) < firstPage.html.indexOf(`${paginationPrefix} 10`) &&
      !firstPage.html.includes(`${paginationPrefix} 11`),
  );
  const secondPage = await get(`/fr/atelier/clients?q=${encodedPrefix}&sort=name&dir=asc&taille=10&page=2`);
  check(
    "deuxième page accessible",
    /11\s+fiche\s*s?\s+-\s+page\s+2\s+sur\s+2/.test(visibleText(secondPage.html)) && secondPage.html.includes(`${paginationPrefix} 11`),
  );
  const descendingPage = await get(`/fr/atelier/clients?q=${encodedPrefix}&sort=name&dir=desc&taille=10&page=1`);
  check("tri décroissant appliqué", descendingPage.html.includes(`${paginationPrefix} 11`) && !descendingPage.html.includes(`${paginationPrefix} 01`));

  const detailPath = `/fr/atelier/clients/${createdId}`;
  const detailPage = await get(detailPath);
  const deleteResponse = await submit(detailPath, findForm(detailPage.html, "Supprimer"), {});
  check("suppression redirige vers la liste", deleteResponse.status === 303);
  check(
    "deleted_at renseigné",
    Boolean((await db.collection("clients").findOne({ id: createdId }))?.deleted_at),
  );
  const listPage = await get("/fr/atelier/clients");
  check("client supprimé absent de la liste", !listPage.html.includes(updatedName));

  console.log("\nTout est conforme.\n");
} finally {
  await db.collection("clients").deleteMany({ id: { $in: paginationIds } });
  if (createdId) {
    await db.collection("audit_log").deleteMany({ entity_id: createdId });
    await db.collection("clients").deleteOne({ id: createdId });
  }
  await closeMongo();
}
