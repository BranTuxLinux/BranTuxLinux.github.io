import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { sitio } from "../lib/sitio";

export async function GET(context) {
  const posts = (await getCollection("posts", ({ data }) => !data.borrador)).sort(
    (a, b) => b.data.fecha.getTime() - a.data.fecha.getTime()
  );

  return rss({
    title: sitio.titulo,
    description: sitio.descripcion,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.titulo,
      description: post.data.resumen,
      pubDate: post.data.fecha,
      categories: post.data.tags,
      link: `/posts/${post.id}/`,
    })),
    customData: `<language>${sitio.idioma}</language>`,
  });
}
