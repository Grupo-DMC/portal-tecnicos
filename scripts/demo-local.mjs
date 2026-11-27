// Levanta la app con build de producción (next build + next start) en el puerto 3200 contra la base LOCAL de comparación con la demo
// (dmc_test_demo0001, creada con `RESEMBRAR=1 npx playwright test -c playwright.demo.config.ts capturas -g menú`).
// Lee las credenciales de .env.test (TEST_DB_*). Nunca apunta a producción.
import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { freemem } from "node:os";

// Reglas para no tumbar el equipo: un solo servidor, Node a 2 GB, y no arrancar con poca memoria.
// `--sin-build` reutiliza el último build de .next-demo.
const MINIMO_MB = 2500;
const libreMb = Math.round(freemem() / 1024 / 1024);
if (libreMb < MINIMO_MB) {
  console.error(`Memoria libre: ${libreMb} MB (mínimo ${MINIMO_MB}). No se levanta el servidor; cierra programas y vuelve a intentar.`);
  process.exit(2);
}

const env = Object.fromEntries(
  readFileSync(".env.test", "utf8").split(/\r?\n/).filter((l) => /^\s*[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
if (!/^(localhost|127\.0\.0\.1)$/.test(env.TEST_DB_SERVER ?? "")) throw new Error("La base de comparación tiene que ser local.");
const entorno = {
    ...process.env,
    DB_SERVER: env.TEST_DB_SERVER, DB_PORT: env.TEST_DB_PORT ?? "1433", DB_USER: env.TEST_DB_USER, DB_PASSWORD: env.TEST_DB_PASSWORD,
    DB_NAME: "dmc_test_demo0001", DB_SCHEMA: "tecnico", DB_SCHEMA_CLIENTES: "clientes", DB_SCHEMA_SEGURIDAD: "seguridad",
    DB_ENCRYPT: "true", DB_TRUST_SERVER_CERT: "true", SESSION_SECRET: "demo-local-".padEnd(64, "0"),
    NEXT_DIST_DIR: ".next-demo", NEXT_TELEMETRY_DISABLED: "1", NODE_OPTIONS: "--max-old-space-size=2048",
};
if (!process.argv.includes("--sin-build")) {
  const b = spawnSync("npx", ["next", "build"], { stdio: "inherit", shell: true, env: entorno });
  if (b.status !== 0) process.exit(b.status ?? 1);
}
const hijo = spawn("npx", ["next", "start", "-p", "3200"], { stdio: "inherit", shell: true, env: entorno });
hijo.on("exit", (c) => process.exit(c ?? 0));
