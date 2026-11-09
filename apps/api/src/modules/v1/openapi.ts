type TemplateView = {
  slug: string;
  name: string;
  description: string | null;
  version: number | null;
  schema: unknown;
};

const problemResponse = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } } },
});

/** OpenAPI 3.1 document limited to what the calling key may use; per-template request bodies. */
export function buildOpenApi(projectName: string, templates: TemplateView[]) {
  const paths: Record<string, unknown> = {
    "/v1/templates": {
      get: {
        summary: "List templates available to this key",
        responses: {
          "200": { description: "Templates with their JSON Schema" },
          "401": problemResponse("Invalid key"),
        },
      },
    },
    "/v1/documents/{id}": {
      get: {
        summary: "Document status",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "queued | processing | ok | failed | expired" },
          "404": problemResponse("Unknown document"),
        },
      },
    },
    "/v1/documents/{id}/file": {
      get: {
        summary: "Download the PDF",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "PDF",
            content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
          },
          "409": problemResponse("Not ready"),
          "410": problemResponse("Expired, generate again"),
        },
      },
    },
  };

  for (const t of templates) {
    if (!t.schema) continue;
    paths[`/v1/templates/${t.slug}/generate`] = {
      post: {
        summary: `Generate "${t.name}" (v${t.version})`,
        description: t.description ?? undefined,
        parameters: [
          {
            name: "response",
            in: "query",
            schema: { enum: ["json"] },
            description: "Return JSON metadata instead of the PDF",
          },
          { name: "version", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "Prefer", in: "header", schema: { enum: ["respond-async"] } },
          { name: "Idempotency-Key", in: "header", schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["data"],
                additionalProperties: false,
                properties: { data: t.schema },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "PDF",
            content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
          },
          "202": { description: "Still rendering; poll the Location header" },
          "401": problemResponse("Invalid key"),
          "403": problemResponse("Key has no access to this template"),
          "413": problemResponse("Payload too large"),
          "422": problemResponse("Data does not match the schema"),
          "429": problemResponse("Rate limited"),
          "504": problemResponse("Render timeout"),
        },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: { title: `${projectName} documents API`, version: "1.0.0" },
    servers: [{ url: "/" }],
    security: [{ bearer: [] }],
    paths,
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "dk_live_… key" } },
      schemas: {
        Problem: {
          type: "object",
          properties: {
            type: { type: "string" },
            title: { type: "string" },
            status: { type: "integer" },
            detail: { type: "string" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  code: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}
