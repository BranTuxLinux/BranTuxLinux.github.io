/**
 * Publica lo que haya escrito en el vault.
 *
 * Las notas viven en su propio repositorio y el sitio se construye desde ahi,
 * asi que publicar es commitear el vault — no este repositorio. Aqui solo se
 * valida antes de subir y se le da un empujon al despliegue para no esperar
 * al reloj.
 *
 * El disparo sigue siendo manual a proposito: `publicar: true` en la nota dice
 * *que* se publica, este comando dice *cuando*.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const VAULT = process.env.VAULT ?? join(homedir(), "Documentos", "Obsidian");

function correr(comando, argumentos, opciones = {}) {
  return spawnSync(comando, argumentos, {
    encoding: "utf8",
    stdio: opciones.silencioso ? "pipe" : "inherit",
    ...opciones,
  });
}

function git(directorio, ...argumentos) {
  const resultado = correr("git", ["-C", directorio, ...argumentos], { silencioso: true });
  if (resultado.status !== 0) {
    process.stderr.write(resultado.stderr ?? "");
    process.exit(resultado.status ?? 1);
  }
  return resultado.stdout.trim();
}

if (!existsSync(join(VAULT, ".git"))) {
  console.error(`El vault de ${VAULT} no es un repositorio git.`);
  process.exit(1);
}

// Sincronizar antes de subir no es para dejar los archivos: es la validacion.
// Un slug repetido o una nota que no cumple el esquema falla aqui, en la
// maquina, y no a mitad del despliegue.
const sincronizacion = correr(process.execPath, ["scripts/sincronizar-vault.mjs"], { cwd: RAIZ });
if (sincronizacion.status !== 0) {
  console.error("\nLa sincronizacion fallo: no se sube nada.");
  process.exit(sincronizacion.status ?? 1);
}

const rama = git(VAULT, "rev-parse", "--abbrev-ref", "HEAD");
if (rama !== "main") {
  console.error(`El vault esta en la rama "${rama}". El sitio se construye desde main.`);
  process.exit(1);
}

const pendientes = git(VAULT, "status", "--porcelain");
if (pendientes === "") {
  console.log("\nEl vault no tiene cambios sin subir.");
} else {
  git(VAULT, "add", "-A");

  const archivos = git(VAULT, "diff", "--cached", "--name-only")
    .split("\n")
    .filter(Boolean);
  const notas = archivos
    .filter((ruta) => ruta.endsWith(".md"))
    .map((ruta) => ruta.split("/").pop().replace(/\.md$/, ""));

  const asunto =
    notas.length === 0
      ? `notas: ${archivos.length} archivo(s)`
      : `notas: ${notas.slice(0, 3).join(", ")}${notas.length > 3 ? ` y ${notas.length - 3} mas` : ""}`;

  git(VAULT, "commit", "-m", asunto.length <= 72 ? asunto : `notas: ${archivos.length} archivo(s)`);
  git(VAULT, "push", "origin", "main");
  console.log(`\nVault subido: ${asunto}`);
}

// El workflow del blog corre cada cuarto de hora por su cuenta; esto es para
// no esperarlo. Si falla —sin gh, sin permisos— no es un error: el despliegue
// va a salir igual, solo que mas tarde.
const empujon = correr("gh", ["workflow", "run", "deploy.yml", "--repo", "BranTuxLinux/BranTuxLinux.github.io"], {
  silencioso: true,
});
console.log(
  empujon.status === 0
    ? "Despliegue disparado: https://github.com/BranTuxLinux/BranTuxLinux.github.io/actions"
    : "Sin disparar a mano: el sitio se reconstruye solo en menos de 15 minutos."
);
