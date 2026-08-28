# Blog

Sitio estático con [Astro](https://astro.build), publicado en GitHub Pages en
<https://brantuxlinux.github.io>.

Los posts no se escriben aquí. Se escriben en el vault de Obsidian, que vive en
su propio repositorio privado —[`obsidian-vault`](https://github.com/BranTuxLinux/obsidian-vault)—
y de ahí los toma el despliegue.

```
Obsidian  ──►  obsidian-vault (privado)  ──►  Actions  ──►  brantuxlinux.github.io
   nota            git push                  sync + build
```

`src/content/posts/` es una carpeta **generada** y está en `.gitignore`: existe
en local para poder previsualizar, y en CI se rehace desde cero. Editar algo ahí
a mano no publica nada.

## Publicar una nota

1. En la nota del vault, agregar `publicar: true` al frontmatter.
2. `pnpm publicar`

Eso valida las notas, commitea y sube el vault, y dispara el despliegue. Sin ese
empujón el sitio se reconstruye solo: el workflow revisa el vault cada quince
minutos.

Quitar `publicar: true` y volver a publicar borra el post del sitio.

Para ver una nota antes de subirla: `pnpm sync:vault` y `pnpm dev`.

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
  en vez de que una pise a la otra en silencio. Falla en la máquina, antes de
  subir nada.

## Comandos

```bash
pnpm publicar     # valida, sube el vault y dispara el despliegue
pnpm dev          # servidor local en :4321
pnpm sync:vault   # solo trae las notas publicables, sin publicar
pnpm build        # genera dist/
pnpm preview      # sirve dist/ como lo verá el visitante
```

El vault se busca en `~/Documentos/Obsidian`. Para otro sitio:
`VAULT=/ruta/al/vault pnpm publicar`.

## Cómo lee CI un repositorio privado

Con una llave de despliegue **de solo lectura** en `obsidian-vault`, cuya mitad
privada es el secreto `VAULT_DEPLOY_KEY` de este repositorio. Si este runner se
compromete, no puede escribir en las notas.

## Publicar desde el teléfono

Instalando el plugin **Obsidian Git** en la app de Obsidian y apuntándolo a
`obsidian-vault`: al guardar la nota con `publicar: true`, el plugin commitea y
sube, y el workflow la recoge en el siguiente cuarto de hora. Esta máquina no
necesita estar encendida.
