/** Los datos que se repiten en cabeceras, RSS y sitemap. Un solo lugar. */
export const sitio = {
  titulo: "Brandon · notas",
  descripcion:
    "Notas sobre Linux, Rust, TypeScript y las herramientas que uso todos los dias.",
  autor: "Brandon Quintero",
  idioma: "es",
  url: "https://brantuxlinux.github.io",
  enlaces: [
    { texto: "GitHub", href: "https://github.com/BranTuxLinux" },
    { texto: "RSS", href: "/rss.xml" },
  ],
} as const;

/** Fecha larga en español, estable entre servidor y navegador. */
export function fechaLarga(fecha: Date): string {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(fecha);
}
