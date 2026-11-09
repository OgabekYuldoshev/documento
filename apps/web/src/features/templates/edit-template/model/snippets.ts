export type SnippetInput = { baseUrl: string; slug: string; data: Record<string, unknown> };

export type Snippet = { id: string; label: string; language: string; code: string };

const indent = (text: string, spaces: number) =>
  text
    .split("\n")
    .map((line, i) => (i === 0 ? line : " ".repeat(spaces) + line))
    .join("\n");

/** Ready-to-paste examples for `POST /v1/templates/:slug/generate`. */
export function buildSnippets({ baseUrl, slug, data }: SnippetInput): Snippet[] {
  const url = `${baseUrl}/v1/templates/${slug}/generate`;
  const body = JSON.stringify({ data }, null, 2);
  return [
    {
      id: "curl",
      label: "cURL",
      language: "bash",
      code: `curl -X POST '${url}' \\
  -H 'Authorization: Bearer $DOCUMENTO_API_KEY' \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: '"$(uuidgen)" \\
  -d '${JSON.stringify({ data })}' \\
  --output document.pdf`,
    },
    {
      id: "node",
      label: "Node.js",
      language: "javascript",
      code: `import { writeFile } from "node:fs/promises";

const res = await fetch("${url}", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.DOCUMENTO_API_KEY}\`,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify(${indent(body, 2)}),
});

if (res.status === 200) {
  await writeFile("document.pdf", Buffer.from(await res.arrayBuffer()));
} else if (res.status === 202) {
  // still rendering: poll the Location header (GET /v1/documents/:id)
  console.log("Processing:", res.headers.get("location"));
} else {
  console.error(res.status, await res.json()); // application/problem+json
}`,
    },
    {
      id: "python",
      label: "Python",
      language: "python",
      code: `import os
import uuid

import requests

res = requests.post(
    "${url}",
    headers={
        "Authorization": f"Bearer {os.environ['DOCUMENTO_API_KEY']}",
        "Idempotency-Key": str(uuid.uuid4()),
    },
    json=${indent(
      JSON.stringify({ data }, null, 4)
        .replace(/\btrue\b/g, "True")
        .replace(/\bfalse\b/g, "False")
        .replace(/\bnull\b/g, "None"),
      4,
    )},
    timeout=60,
)

if res.status_code == 200:
    with open("document.pdf", "wb") as f:
        f.write(res.content)
elif res.status_code == 202:
    print("Processing:", res.headers["Location"])  # poll GET /v1/documents/:id
else:
    print(res.status_code, res.json())  # application/problem+json`,
    },
  ];
}
