/**
 * Sincroniza el vault y publica lo que haya cambiado, en un solo paso.
 *
 * Es deliberadamente manual: la publicacion es una accion hacia afuera y se
 * dispara cuando uno decide, no cuando el editor guarda. `publicar: true` en
 * la nota dice *que* se publica; este comando dice *cuando*.
 *
 * Solo toca `src/content/posts`. Cualquier otro cambio del repositorio se
 * queda sin commitear: publicar un post no es el momento de arrastrar una
 * edicion de estilos a medio hacer.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const POSTS = "src/content/posts";

function correr(comando, argumentos, opciones = {}) {
  const resultado = spawnSync(comando, argumentos, {
    cwd: RAIZ,
    encoding: "utf8",
    stdio: opciones.silencioso ? "pipe" : "inherit",
    ...opciones,
  });
  if (resultado.error) throw resultado.error;
  return resultado;
}

function git(...argumentos) {
  const resultado = correr("git", argumentos, { silencioso: true });
  if (resultado.status !== 0) {
    process.stderr.write(resultado.stderr ?? "");
    process.exit(resultado.status ?? 1);
  }
  return resultado.stdout.trim();
}

const rama = git("rev-parse", "--abbrev-ref", "HEAD");
if (rama !== "main") {
  console.error(`Estas en la rama "${rama}". El despliegue sale de main.`);
  process.exit(1);
}

const sincronizacion = correr(process.execPath, ["scripts/sincronizar-vault.mjs"]);
if (sincronizacion.status !== 0) process.exit(sincronizacion.status ?? 1);

const cambios = git("status", "--porcelain", "--", POSTS);
if (cambios === "") {
  console.log("\nEl sitio ya esta al dia: no cambio ningun post.");
  process.exit(0);
}

git("add", "--", POSTS);

// El resumen del commit sale de lo que git dice que cambio, no de lo que el
// script cree haber escrito: si algo no llego al indice, el mensaje no miente.
const preparados = git("diff", "--cached", "--name-status", "--", POSTS)
  .split("\n")
  .filter(Boolean)
  .map((linea) => {
    const [estado, ruta] = linea.split(/\t/);
    const slug = ruta.replace(`${POSTS}/`, "").replace(/\.md$/, "");
    return { estado: estado[0], slug };
  });

const nuevos = preparados.filter((c) => c.estado === "A");
const editados = preparados.filter((c) => c.estado === "M");
const borrados = preparados.filter((c) => c.estado === "D");

const partes = [];
if (nuevos.length) partes.push(`publica ${nuevos.map((c) => c.slug).join(", ")}`);
if (editados.length) partes.push(`actualiza ${editados.map((c) => c.slug).join(", ")}`);
if (borrados.length) partes.push(`retira ${borrados.map((c) => c.slug).join(", ")}`);

const asunto = `content: ${partes.join("; ")}`;
const mensaje =
  asunto.length <= 72 ? asunto : `content: ${preparados.length} post(s) del vault\n\n${partes.join("\n")}`;

git("commit", "-m", mensaje);
console.log(`\n${mensaje.split("\n")[0]}`);

git("push", "origin", "main");

const remoto = git("remote", "get-url", "origin")
  .replace(/^git@github\.com:/, "https://github.com/")
  .replace(/\.git$/, "");
console.log(`\nDesplegando: ${remoto}/actions`);
