# Blog

Sitio estático con [Astro](https://astro.build), publicado en GitHub Pages en
<https://brantuxlinux.github.io>.

Los posts no se escriben aquí: se escriben en el vault de Obsidian y se traen
con un script. `src/content/posts/` es una carpeta **generada** — cualquier
cosa que se edite ahí a mano se pierde en la siguiente sincronización.

## Publicar una nota

1. En la nota del vault, agregar `publicar: true` al frontmatter.
2. `pnpm publicar`

Eso sincroniza, commitea y hace push; Actions construye y despliega. Para
revisar antes de que salga: `pnpm sync:vault` y `pnpm dev`.

Quitar `publicar: true` y volver a publicar borra el post del sitio.

`pnpm publicar` solo toca `src/content/posts/`: una edición de estilos a medio
hacer no se cuela en el commit del post. Y solo corre desde `main`, que es la
rama de la que sale el despliegue.

## Frontmatter que lee el script

| Campo del vault | Qué hace | Si falta |
| --- | --- | --- |
| `publicar` | **Obligatorio.** Solo se publica con `true` | La nota no sale del vault |
| `titulo` | Título del post | Se usa el nombre del archivo |
| `resumen` | Bajada en el índice, RSS y metadatos | Se toma el primer párrafo |
| `creado` | Fecha de publicación | La fecha de hoy |
| `actualizado` | Se muestra bajo el título | No se muestra nada |
| `tags` | Etiquetas del post (`index` se descarta) | Sin etiquetas |
| `status` | Con `borrador` el post tiene URL pero no se lista | Se publica normal |
| `slug` | URL a la medida | Se deriva del nombre del archivo |

## Lo que el script resuelve por su cuenta

- **Wikilinks.** `[[Nota]]` se vuelve un enlace real si esa nota también se
  publica; si no, queda como texto plano. Nunca se genera un enlace roto.
- **Título duplicado.** El `# H1` inicial se quita: la plantilla ya lo pinta.
- **Tablas anchas.** Se envuelven para que se desplacen solas y la página nunca
  se desplace en horizontal.
- **Colisiones de URL.** Dos notas con el mismo slug abortan la sincronización
  en vez de que una pise a la otra en silencio.

## Comandos

```bash
pnpm publicar     # sincroniza + commit + push, en un paso
pnpm dev          # servidor local en :4321
pnpm sync:vault   # solo trae las notas publicables, sin publicar
pnpm build        # genera dist/
pnpm preview      # sirve dist/ como lo verá el visitante
```

El vault se busca en `~/Documentos/Obsidian`. Para otro sitio:
`VAULT=/ruta/al/vault pnpm sync:vault`.
