export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const specUrl = `${origin}/api/mobile/v1/openapi.json`;
  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fileo Mobile API</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      :root {
        color-scheme: dark;
        --fileo-bg: #10063a;
        --fileo-panel: #08001f;
        --fileo-border: #2b1a68;
        --fileo-text: #b9c2ff;
        --fileo-accent: #f257b8;
      }

      body {
        margin: 0;
        background: var(--fileo-bg);
      }

      .topbar {
        display: none;
      }

      .swagger-ui {
        color: var(--fileo-text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .swagger-ui .info {
        margin: 28px 0;
      }

      .swagger-ui .info .title,
      .swagger-ui .opblock-tag,
      .swagger-ui label,
      .swagger-ui table thead tr td,
      .swagger-ui table thead tr th {
        color: var(--fileo-text);
      }

      .swagger-ui .scheme-container,
      .swagger-ui .opblock,
      .swagger-ui section.models {
        background: var(--fileo-panel);
        border: 1px solid var(--fileo-border);
        box-shadow: none;
      }

      .swagger-ui .btn.authorize,
      .swagger-ui .btn.execute {
        border-color: var(--fileo-accent);
        color: var(--fileo-accent);
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(specUrl)},
        dom_id: "#swagger-ui",
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true,
        tryItOutEnabled: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
