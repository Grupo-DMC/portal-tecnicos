import { BASE_E2E, crearBaseE2E, entornoDeLaApp } from "../e2e/base";
import { sembrarVolumen } from "./volumen";

// Base local para comparar React con la demo panel-operacion.html: la siembra
// mínima de los E2E más el volumen de tests/demo/volumen.ts. Pasa por la misma
// guarda (solo localhost y solo `dmc_test_*`). Nunca apunta a producción.
export const BASE_DEMO = "dmc_test_demo0001";
export const PUERTO_DEMO = 3200;

export const crearBaseDemo = () => crearBaseE2E(BASE_DEMO, sembrarVolumen);
export const entornoDemo = () => ({ ...entornoDeLaApp(BASE_DEMO), NEXT_DIST_DIR: ".next-demo", SESSION_SECRET: "demo-local-".padEnd(64, "0") });
void BASE_E2E;
