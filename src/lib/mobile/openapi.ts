export function buildMobileOpenApi(origin?: string) {
  const serverUrl = origin ? `${origin}/api/mobile/v1` : "/api/mobile/v1";

  return {
    openapi: "3.0.3",
    info: {
      title: "Fileo Mobile API",
      version: "1.0.0",
      description:
        "API mobile privee pour les applications Fileo atelier. Les routes protegees utilisent un token Bearer obtenu via /auth/login.",
    },
    servers: [{ url: serverUrl, description: "Serveur courant" }],
    tags: [
      { name: "System", description: "Decouverte et documentation" },
      { name: "Auth", description: "Authentification mobile" },
      { name: "Bootstrap", description: "Contexte initial de l'application" },
      { name: "Clients", description: "Gestion des clients atelier" },
      { name: "Measurements", description: "Mensurations client" },
      { name: "Orders", description: "Commandes et articles" },
      { name: "Attachments", description: "Pieces jointes de commande" },
      { name: "Planning", description: "Planning atelier" },
      { name: "Payments", description: "Encaissements atelier" },
    ],
    paths: {
      "/": {
        get: {
          tags: ["System"],
          summary: "Lister les routes principales",
          operationId: "getMobileApiIndex",
          responses: {
            "200": { description: "Index API", content: json("GenericSuccess") },
          },
        },
      },
      "/openapi.json": {
        get: {
          tags: ["System"],
          summary: "Recuperer la specification OpenAPI",
          operationId: "getOpenApiDocument",
          responses: {
            "200": { description: "Specification OpenAPI" },
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Ouvrir une session mobile",
          operationId: "login",
          requestBody: bodyRef("LoginRequest"),
          responses: {
            "200": { description: "Session creee", content: json("LoginResponse") },
            "400": error("Donnees invalides"),
            "401": error("Identifiants invalides"),
            "403": error("Compte ou atelier indisponible"),
          },
        },
      },
      "/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Fermer la session courante",
          operationId: "logout",
          security: bearer(),
          responses: {
            "200": { description: "Session fermee", content: json("LogoutResponse") },
            "401": error("Token manquant ou invalide"),
          },
        },
      },
      "/me": {
        get: {
          tags: ["Auth"],
          summary: "Lire le profil de session",
          operationId: "getMe",
          security: bearer(),
          responses: {
            "200": { description: "Profil mobile", content: json("SessionResponse") },
            "401": error("Token manquant ou invalide"),
          },
        },
      },
      "/bootstrap": {
        get: {
          tags: ["Bootstrap"],
          summary: "Charger le contexte initial",
          operationId: "getBootstrap",
          security: bearer(),
          responses: {
            "200": { description: "Contexte utilisateur, atelier et dashboard", content: json("BootstrapResponse") },
            "401": error("Token manquant ou invalide"),
          },
        },
      },
      "/clients": {
        get: {
          tags: ["Clients"],
          summary: "Lister les clients",
          operationId: "listClients",
          security: bearer(),
          parameters: [
            query("q", "Recherche nom ou contact"),
            query("includeArchived", "Inclure les clients archives", "boolean"),
            query("page", "Page demandee", "integer"),
            query("pageSize", "Taille de page", "integer"),
            query("sort", "Tri: name, phone, orders, lastOrder, createdAt"),
            query("direction", "Direction: asc ou desc"),
          ],
          responses: {
            "200": { description: "Page de clients", content: json("ClientPageResponse") },
            "401": error("Token manquant ou invalide"),
            "403": error("Permission clients.read manquante"),
          },
        },
        post: {
          tags: ["Clients"],
          summary: "Creer un client",
          operationId: "createClient",
          security: bearer(),
          requestBody: bodyRef("ClientInput"),
          responses: {
            "201": { description: "Client cree", content: json("IdResponse") },
            "400": error("Donnees invalides"),
            "401": error("Token manquant ou invalide"),
            "403": error("Permission clients.write manquante"),
          },
        },
      },
      "/clients/{id}": {
        get: {
          tags: ["Clients"],
          summary: "Lire un client",
          operationId: "getClient",
          security: bearer(),
          parameters: [pathId("id", "Identifiant client")],
          responses: {
            "200": { description: "Client", content: json("ClientResponse") },
            "404": error("Client introuvable"),
          },
        },
        patch: {
          tags: ["Clients"],
          summary: "Modifier un client",
          operationId: "updateClient",
          security: bearer(),
          parameters: [pathId("id", "Identifiant client")],
          requestBody: bodyRef("ClientInput"),
          responses: {
            "200": { description: "Client modifie", content: json("IdResponse") },
            "400": error("Donnees invalides"),
            "404": error("Client introuvable"),
          },
        },
        delete: {
          tags: ["Clients"],
          summary: "Archiver un client",
          operationId: "deleteClient",
          security: bearer(),
          parameters: [pathId("id", "Identifiant client")],
          responses: {
            "200": { description: "Client archive", content: json("DeleteResponse") },
            "404": error("Client introuvable"),
          },
        },
      },
      "/clients/{id}/measurements": {
        get: {
          tags: ["Measurements"],
          summary: "Lister les mensurations d'un client",
          operationId: "listClientMeasurements",
          security: bearer(),
          parameters: [pathId("id", "Identifiant client")],
          responses: {
            "200": { description: "Mensurations", content: json("MeasurementListResponse") },
          },
        },
        post: {
          tags: ["Measurements"],
          summary: "Ajouter une version de mensurations",
          operationId: "createClientMeasurement",
          security: bearer(),
          parameters: [pathId("id", "Identifiant client")],
          requestBody: bodyRef("MeasurementInput"),
          responses: {
            "201": { description: "Mensurations creees", content: json("IdResponse") },
            "400": error("Donnees invalides"),
          },
        },
      },
      "/orders": {
        get: {
          tags: ["Orders"],
          summary: "Lister les commandes",
          operationId: "listOrders",
          security: bearer(),
          parameters: [
            query("page", "Page demandee", "integer"),
            query("pageSize", "Taille de page", "integer"),
          ],
          responses: {
            "200": { description: "Page de commandes", content: json("GenericSuccess") },
          },
        },
        post: {
          tags: ["Orders"],
          summary: "Creer une commande complete",
          description:
            "Accepte soit clientId pour un client existant, soit client pour creer le client pendant la commande.",
          operationId: "createOrder",
          security: bearer(),
          requestBody: bodyRef("CreateOrderRequest"),
          responses: {
            "201": { description: "Commande creee", content: json("CreateOrderResponse") },
            "400": error("Donnees invalides"),
          },
        },
      },
      "/orders/{id}": {
        get: {
          tags: ["Orders"],
          summary: "Lire le detail d'une commande",
          operationId: "getOrder",
          security: bearer(),
          parameters: [pathId("id", "Identifiant commande")],
          responses: {
            "200": { description: "Commande detaillee", content: json("GenericSuccess") },
            "404": error("Commande introuvable"),
          },
        },
      },
      "/orders/{id}/attachments": {
        get: {
          tags: ["Attachments"],
          summary: "Lister les pieces jointes d'une commande",
          operationId: "listOrderAttachments",
          security: bearer(),
          parameters: [pathId("id", "Identifiant commande")],
          responses: {
            "200": { description: "Pieces jointes", content: json("AttachmentListResponse") },
          },
        },
        post: {
          tags: ["Attachments"],
          summary: "Uploader des pieces jointes de commande",
          operationId: "uploadOrderAttachments",
          security: bearer(),
          parameters: [pathId("id", "Identifiant commande")],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    files: {
                      type: "array",
                      items: { type: "string", format: "binary" },
                    },
                    orderFiles: {
                      type: "array",
                      items: { type: "string", format: "binary" },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "Pieces jointes ajoutees", content: json("AttachmentListResponse") },
            "404": error("Commande introuvable"),
          },
        },
      },
      "/planning": {
        get: {
          tags: ["Planning"],
          summary: "Lire le planning atelier",
          operationId: "listPlanning",
          security: bearer(),
          parameters: [
            query("q", "Recherche"),
            query("status", "Statut: active, late, done, all"),
            query("assignee", "Filtre collaborateur"),
          ],
          responses: {
            "200": { description: "Planning", content: json("PlanningResponse") },
          },
        },
      },
      "/payments": {
        get: {
          tags: ["Payments"],
          summary: "Lister les commandes cote encaissement",
          operationId: "listPayments",
          security: bearer(),
          parameters: [
            query("q", "Recherche"),
            query("filter", "Filtre: all, a_encaisser, soldees, en_retard"),
            query("page", "Page demandee", "integer"),
            query("pageSize", "Taille de page", "integer"),
          ],
          responses: {
            "200": { description: "Page paiements", content: json("GenericSuccess") },
            "403": error("Permission money.read manquante"),
          },
        },
      },
      "/payments/record": {
        post: {
          tags: ["Payments"],
          summary: "Declarer un encaissement atelier",
          operationId: "recordPayment",
          security: bearer(),
          requestBody: bodyRef("PaymentRecordInput"),
          responses: {
            "200": { description: "Encaissement enregistre", content: json("GenericSuccess") },
            "400": error("Donnees invalides"),
            "403": error("Permission money.write manquante"),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "opaque",
          description: "Token retourne par POST /auth/login.",
        },
      },
      schemas: {
        ApiError: {
          type: "object",
          required: ["ok", "error"],
          properties: {
            ok: { type: "boolean", example: false },
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string", example: "validation_error" },
                message: { type: "string", example: "Nom du client est obligatoire." },
              },
            },
          },
        },
        GenericSuccess: successSchema({ type: "object", additionalProperties: true }),
        IdResponse: successSchema({
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", example: "018fdc9b-5d85-7b83-9f98-1a2b3c4d5e6f" } },
        }),
        DeleteResponse: successSchema({
          type: "object",
          properties: {
            id: { type: "string" },
            deleted: { type: "boolean", example: true },
          },
        }),
        LoginRequest: {
          type: "object",
          required: ["phone", "password"],
          properties: {
            country: { type: "string", example: "CG" },
            phone: { type: "string", example: "+242061111111" },
            password: { type: "string", format: "password", example: "Atelier2026!" },
            workshopId: { type: "string", nullable: true },
          },
        },
        LoginResponse: successSchema({
          allOf: [
            { $ref: "#/components/schemas/SessionPayload" },
            {
              type: "object",
              required: ["token", "tokenType", "expiresAt"],
              properties: {
                token: { type: "string" },
                tokenType: { type: "string", example: "Bearer" },
                expiresAt: { type: "string", format: "date-time" },
              },
            },
          ],
        }),
        LogoutResponse: successSchema({
          type: "object",
          properties: { loggedOut: { type: "boolean", example: true } },
        }),
        SessionResponse: successSchema({ $ref: "#/components/schemas/SessionPayload" }),
        SessionPayload: {
          type: "object",
          required: ["user", "workshop", "capabilities"],
          properties: {
            user: { type: "object", additionalProperties: true },
            workshop: { type: "object", additionalProperties: true },
            capabilities: {
              type: "object",
              properties: {
                canViewMoney: { type: "boolean" },
                role: { type: "string", example: "owner" },
              },
            },
          },
        },
        BootstrapResponse: successSchema({
          allOf: [
            { $ref: "#/components/schemas/SessionPayload" },
            {
              type: "object",
              properties: {
                dashboard: {
                  type: "object",
                  additionalProperties: true,
                },
              },
            },
          ],
        }),
        ClientInput: {
          type: "object",
          required: ["displayName"],
          properties: {
            displayName: { type: "string", example: "Nadia Nahdi" },
            phone: { type: "string", nullable: true, example: "+242069801234" },
            otherContact: { type: "string", nullable: true },
            guardianName: { type: "string", nullable: true },
            guardianPhone: { type: "string", nullable: true },
            notes: { type: "string", nullable: true },
          },
        },
        Client: {
          type: "object",
          additionalProperties: true,
          properties: {
            id: { type: "string" },
            display_name: { type: "string", example: "Nadia Nahdi" },
            phone_e164: { type: "string", nullable: true, example: "+242069801234" },
          },
        },
        ClientResponse: successSchema({ $ref: "#/components/schemas/Client" }),
        ClientPageResponse: successSchema({
          type: "object",
          properties: {
            items: { type: "array", items: { $ref: "#/components/schemas/Client" } },
            page: { type: "integer", example: 1 },
            pageSize: { type: "integer", example: 20 },
            total: { type: "integer", example: 42 },
          },
        }),
        MeasurementInput: {
          type: "object",
          required: ["category", "values"],
          properties: {
            category: { type: "string", example: "robe" },
            values: {
              type: "object",
              additionalProperties: { type: "number", nullable: true },
              example: { poitrine: 92, taille: 74, bassin: 98 },
            },
            notes: { type: "string", nullable: true },
            takenAt: { type: "string", format: "date", nullable: true },
          },
        },
        MeasurementListResponse: successSchema({
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object", additionalProperties: true } },
          },
        }),
        CreateOrderRequest: {
          type: "object",
          required: ["items"],
          properties: {
            clientId: { type: "string", description: "Client existant" },
            client: {
              type: "object",
              description: "Client a creer si clientId est absent",
              properties: {
                displayName: { type: "string", example: "Carol Denver" },
                phone: { type: "string", nullable: true, example: "+242069901234" },
              },
            },
            promisedDate: { type: "string", format: "date", nullable: true },
            fittingDate: { type: "string", format: "date", nullable: true },
            instructions: { type: "string", nullable: true },
            discountAmount: { type: "integer", minimum: 0, example: 0 },
            discountReason: { type: "string", nullable: true },
            items: {
              type: "array",
              minItems: 1,
              items: { $ref: "#/components/schemas/OrderItemInput" },
            },
            initialPayment: {
              $ref: "#/components/schemas/InitialPaymentInput",
            },
          },
          example: {
            client: { displayName: "Carol Denver", phone: "+242069901234" },
            promisedDate: "2026-10-20",
            fittingDate: "2026-10-18",
            items: [
              {
                category: "Robe",
                description: "Robe ceremonie",
                workType: "creation",
                wearerName: "Carol",
                unitPriceAmount: 12000,
                dueDate: "2026-10-20",
                measurementValues: { poitrine: "92", taille: "74" },
              },
            ],
            initialPayment: {
              amount: 5000,
              method: "cash",
              reference: "RECU-001",
              effectiveDate: "2026-09-15",
              idempotencyKey: "mobile-demo-001",
            },
          },
        },
        OrderItemInput: {
          type: "object",
          required: ["category", "description"],
          properties: {
            category: { type: "string", example: "Pantalon" },
            description: { type: "string", example: "Pantalon droit bleu nuit" },
            workType: { type: "string", enum: ["creation", "retouche"], default: "creation" },
            wearerName: { type: "string", nullable: true },
            wearerRelation: { type: "string", nullable: true },
            quantity: { type: "integer", minimum: 1, default: 1 },
            unitPriceAmount: { type: "integer", minimum: 0, example: 5000 },
            dueDate: { type: "string", format: "date", nullable: true },
            measurementValues: {
              type: "object",
              additionalProperties: { type: "string" },
              example: { longueur: "104", taille: "82" },
            },
            measurementNotes: { type: "string", nullable: true },
          },
        },
        InitialPaymentInput: {
          type: "object",
          nullable: true,
          required: ["amount", "method", "effectiveDate", "idempotencyKey"],
          properties: {
            amount: { type: "integer", minimum: 0, example: 5000 },
            method: { type: "string", enum: ["cash", "mobile_money", "transfer", "other"], example: "cash" },
            reference: { type: "string", nullable: true },
            effectiveDate: { type: "string", format: "date", example: "2026-09-15" },
            idempotencyKey: { type: "string", example: "mobile-demo-001" },
          },
        },
        CreateOrderResponse: successSchema({
          type: "object",
          additionalProperties: true,
          properties: {
            orderId: { type: "string" },
            order: { type: "object", additionalProperties: true },
          },
        }),
        AttachmentListResponse: successSchema({
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object", additionalProperties: true } },
          },
        }),
        PlanningResponse: successSchema({
          type: "object",
          properties: {
            items: { type: "array", items: { type: "object", additionalProperties: true } },
            members: { type: "array", items: { type: "object", additionalProperties: true } },
          },
        }),
        PaymentRecordInput: {
          type: "object",
          required: ["orderId", "amount", "method", "effectiveDate"],
          properties: {
            orderId: { type: "string" },
            amount: { type: "integer", minimum: 0, example: 2500 },
            method: { type: "string", enum: ["cash", "mobile_money", "transfer", "other"], example: "cash" },
            reference: { type: "string", nullable: true, example: "RECU-2026-001" },
            effectiveDate: { type: "string", format: "date", example: "2026-09-15" },
            idempotencyKey: { type: "string", nullable: true, example: "payment-mobile-001" },
            pending: { type: "boolean", default: false },
          },
        },
      },
    },
  };
}

function bearer() {
  return [{ bearerAuth: [] }];
}

function json(schemaName: string) {
  return {
    "application/json": {
      schema: { $ref: `#/components/schemas/${schemaName}` },
    },
  };
}

function error(description: string) {
  return {
    description,
    content: json("ApiError"),
  };
}

function bodyRef(schemaName: string) {
  return {
    required: true,
    content: json(schemaName),
  };
}

function query(name: string, description: string, type = "string") {
  return {
    name,
    in: "query",
    required: false,
    description,
    schema: { type },
  };
}

function pathId(name: string, description: string) {
  return {
    name,
    in: "path",
    required: true,
    description,
    schema: { type: "string" },
  };
}

function successSchema(dataSchema: Record<string, unknown>) {
  return {
    type: "object",
    required: ["ok", "data"],
    properties: {
      ok: { type: "boolean", example: true },
      data: dataSchema,
    },
  };
}
