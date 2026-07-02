import { execSync } from "child_process";
import https from "https";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const content = readFileSync(join(root, file), "utf-8");
      for (const line of content.split("\n")) {
        const m = line.match(/^([^#=]+)=["']?(.+?)["']?\s*$/);
        if (m) process.env[m[1].trim()] = m[2].trim();
      }
      return;
    } catch {}
  }
}

loadEnv();

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error("Erro: VERCEL_TOKEN não encontrado em .env.local");
  console.error("Adicione: VERCEL_TOKEN=vcp_... no arquivo .env.local");
  process.exit(1);
}

const sha = execSync("git rev-parse HEAD").toString().trim();

const body = JSON.stringify({
  name: "financas-casa",
  project: "financas-casa",
  target: "production",
  gitSource: {
    type: "github",
    repoId: "1286642465",
    ref: "main",
    sha,
  },
});

const req = https.request(
  {
    hostname: "api.vercel.com",
    path: "/v13/deployments",
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  },
  (res) => {
    let data = "";
    res.on("data", (c) => (data += c));
    res.on("end", () => {
      const d = JSON.parse(data);
      if (d.url) {
        console.log(`\nDeploy iniciado: https://${d.url}`);
        console.log(`Produção:        https://financas-casa-felipevkw.vercel.app`);
        console.log(`Dashboard:       https://vercel.com/felipevkw/financas-casa\n`);
      } else {
        console.error("Erro no deploy:", d.error?.message ?? JSON.stringify(d));
        process.exit(1);
      }
    });
  },
);

req.write(body);
req.end();
