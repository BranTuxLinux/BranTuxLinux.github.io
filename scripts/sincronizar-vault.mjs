/**
 * Lleva las notas publicables del vault de Obsidian a `src/content/posts`.
 *
 * El vault no viaja por git y GitHub Actions no lo ve, asi que esto corre en
 * local: se sincroniza, se commitea el resultado y el push dispara el
 * despliegue. Lo que esta en `src/content/posts` es siempre una copia
 * generada — la carpeta es propiedad de este script y se reescribe entera en
 * cada corrida.
 *
 * Se publica una nota que lleve `publicar: true` en su frontmatter. Nada mas.
 * Una nota sin esa marca no sale del vault ni por accidente.
 */

import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative, extname, basename } from "node:path";
import { homedir } from "node:os";
import matter from "gray-matter";

const VAULT = process.env.VAULT ?? join(homedir(), "Documentos", "Obsidian");
const DESTINO = new URL("../src/content/posts/", import.meta.url).pathname;

/** Carpetas y archivos que nunca se miran, publiquen o no. */
const IGNORADAS = new Set([".obsidian", ".git", ".trash", "node_modules"]);
/** `agent.md` es contexto para la IA, no contenido del vault. */
const ARCHIVOS_IGNORADOS = new Set(["agent.md"]);
/** Tags estructurales del vault que no dicen nada a un lector del blog. */
const TAGS_ESTRUCTURALES = new Set(["index", "indice"]);

async function* recorrer(directorio) {
  for (const entrada of await readdir(directorio, { withFileTypes: true })) {
    if (entrada.isDirectory()) {
      if (IGNORADAS.has(entrada.name)) continue;
      yield* recorrer(join(directorio, entrada.name));
    } else if (extname(entrada.name) === ".md" && !ARCHIVOS_IGNORADOS.has(entrada.name)) {
      yield join(directorio, entrada.name);
    }
  }
}

/** Un titulo legible se vuelve un slug de URL: sin tildes, sin espacios. */
function comoSlug(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function comoFecha(valor, respaldo) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor;
  if (typeof valor === "string") {
    const fecha = new Date(valor.length === 10 ? `${valor}T12:00:00Z` : valor);
    if (!Number.isNaN(fecha.getTime())) return fecha;
  }
  return respaldo;
}

/** El primer parrafo de prosa, para cuando la nota no declara un resumen. */
function primerParrafo(cuerpo) {
  const parrafo = cuerpo
    .split(/\n{2,}/)
    .map((bloque) => bloque.trim())
    .find(
      (bloque) =>
        bloque.length > 0 &&
        !bloque.startsWith("#") &&
        !bloque.startsWith("```") &&
        !bloque.startsWith(">") &&
        !bloque.startsWith("|") &&
        !bloque.startsWith("- ")
    );
  if (!parrafo) return "";
  const plano = parrafo.replace(/\s+/g, " ").replace(/[*_`]/g, "");
  return plano.length > 180 ? `${plano.slice(0, 177).trimEnd()}…` : plano;
}

/**
 * Los `[[wikilink]]` de Obsidian no existen fuera del vault. Si el destino
 * tambien se publica, se vuelve un enlace real; si no, se queda el texto —
 * nunca un enlace roto que mande al lector a un 404.
 */
function resolverWikilinks(cuerpo, slugsPorTitulo) {
  return cuerpo.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, destino, alias) => {
    const texto = (alias ?? destino).trim();
    const slug = slugsPorTitulo.get(destino.trim().toLowerCase());
    return slug ? `[${texto}](/posts/${slug}/)` : texto;
  });
}

/** Una tabla ancha necesita su propio contenedor para desplazarse sola. */
function envolverTablas(cuerpo) {
  return cuerpo.replace(
    /(^\|.*\|[ \t]*\n\|[ \t:|-]+\|[ \t]*\n(?:\|.*\|[ \t]*\n?)+)/gm,
    (tabla) => `<div class="tabla-scroll">\n\n${tabla}\n</div>\n`
  );
}

function limpiarCuerpo(cuerpo, titulo) {
  let texto = cuerpo.trimStart();
  // El layout ya pinta el titulo: un H1 identico saldria dos veces.
  const primeraLinea = texto.split("\n", 1)[0];
  if (/^#\s+/.test(primeraLinea) && primeraLinea.replace(/^#\s+/, "").trim() === titulo) {
    texto = texto.slice(primeraLinea.length).trimStart();
  }
  return texto;
}

async function main() {
  if (!existsSync(VAULT)) {
    console.error(`No encuentro el vault en ${VAULT}. Define VAULT si esta en otro sitio.`);
    process.exit(1);
  }

  const candidatas = [];
  for await (const ruta of recorrer(VAULT)) {
    const crudo = await readFile(ruta, "utf8");
    const { data, content } = matter(crudo);
    if (data.publicar !== true) continue;
    candidatas.push({ ruta, data, content });
  }

  // Primero los slugs de todas, y despues los cuerpos: un wikilink puede
  // apuntar a una nota que se procesa despues.
  const slugsPorTitulo = new Map();
  for (const nota of candidatas) {
    const nombre = basename(nota.ruta, ".md");
    nota.titulo = nota.data.titulo ?? nombre;
    nota.slug = nota.data.slug ?? comoSlug(nombre);
    slugsPorTitulo.set(nombre.toLowerCase(), nota.slug);
    slugsPorTitulo.set(nota.titulo.toLowerCase(), nota.slug);
  }

  const repetidos = new Map();
  for (const nota of candidatas) {
    repetidos.set(nota.slug, [...(repetidos.get(nota.slug) ?? []), nota.ruta]);
  }
  const colisiones = [...repetidos.entries()].filter(([, rutas]) => rutas.length > 1);
  if (colisiones.length > 0) {
    for (const [slug, rutas] of colisiones) {
      console.error(`Dos notas quieren la URL /posts/${slug}/:`);
      for (const ruta of rutas) console.error(`  ${relative(VAULT, ruta)}`);
    }
    console.error("Agrega `slug:` al frontmatter de una de ellas.");
    process.exit(1);
  }

  // Los posts son generados: se borran todos y se reescriben, para que
  // despublicar una nota —quitarle `publicar: true`— la borre del sitio de
  // verdad. Se van solo los `.md`: `.gitkeep` sostiene la carpeta en git y
  // borrarlo dejaba una baja espuria en cada sincronizacion.
  await mkdir(DESTINO, { recursive: true });
  for (const previo of await readdir(DESTINO)) {
    if (extname(previo) === ".md") await rm(join(DESTINO, previo));
  }

  for (const nota of candidatas) {
    const cuerpo = envolverTablas(
      resolverWikilinks(limpiarCuerpo(nota.content, nota.titulo), slugsPorTitulo)
    );

    const tags = (Array.isArray(nota.data.tags) ? nota.data.tags : [])
      .filter((tag) => typeof tag === "string" && !TAGS_ESTRUCTURALES.has(tag))
      .map((tag) => tag.trim());

    const frontmatter = {
      titulo: nota.titulo,
      resumen: nota.data.resumen ?? primerParrafo(cuerpo),
      fecha: comoFecha(nota.data.creado, new Date()).toISOString().slice(0, 10),
      ...(nota.data.actualizado
        ? { actualizado: comoFecha(nota.data.actualizado, new Date()).toISOString().slice(0, 10) }
        : {}),
      tags,
      borrador: nota.data.status === "borrador",
      origen: relative(VAULT, nota.ruta),
    };

    const yaml = [
      "---",
      `titulo: ${JSON.stringify(frontmatter.titulo)}`,
      `resumen: ${JSON.stringify(frontmatter.resumen)}`,
      `fecha: ${frontmatter.fecha}`,
      ...(frontmatter.actualizado ? [`actualizado: ${frontmatter.actualizado}`] : []),
      `tags: [${tags.map((tag) => JSON.stringify(tag)).join(", ")}]`,
      `borrador: ${frontmatter.borrador}`,
      `origen: ${JSON.stringify(frontmatter.origen)}`,
      "---",
      "",
    ].join("\n");

    await writeFile(join(DESTINO, `${nota.slug}.md`), yaml + cuerpo.trimEnd() + "\n", "utf8");
    const marca = frontmatter.borrador ? " (borrador)" : "";
    console.log(`  /posts/${nota.slug}/${marca}  ←  ${frontmatter.origen}`);
  }

  if (candidatas.length === 0) {
    console.log(`Ninguna nota de ${VAULT} lleva \`publicar: true\`.`);
    return;
  }
  console.log(`\n${candidatas.length} nota(s) sincronizadas desde ${VAULT}.`);
}

await main();
