import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Los posts los escribe el vault de Obsidian y los deja aqui
 * `scripts/sincronizar-vault.mjs`. Este esquema es el contrato entre los dos:
 * si una nota no lo cumple, la sincronizacion falla antes de commitear en vez
 * de romper el despliegue.
 */
const posts = defineCollection({
  loader: glob({ base: "./src/content/posts", pattern: "**/*.md" }),
  schema: z.object({
    titulo: z.string(),
    resumen: z.string(),
    fecha: z.coerce.date(),
    actualizado: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    borrador: z.boolean().default(false),
    origen: z.string().optional(),
  }),
});

export const collections = { posts };
