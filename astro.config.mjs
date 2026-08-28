// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// GitHub Pages de usuario: el sitio cuelga de la raiz del dominio, asi que no
// lleva `base`. Un repo de proyecto si lo necesitaria.
export default defineConfig({
  site: "https://brantuxlinux.github.io",
  integrations: [sitemap()],
  markdown: {
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" } },
  },
});
