import { crearBaseDemo } from "./base";

// Solo vuelve a sembrar si se pide (RESEMBRAR=1): sembrar toma un rato y las
// capturas se repiten muchas veces durante el trabajo.
export default async function globalSetup() {
  if (process.env.RESEMBRAR === "1") await crearBaseDemo();
}
