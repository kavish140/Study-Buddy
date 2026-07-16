import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = import.meta.env.VITE_SITE_URL || "https://aceprep.app";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const today = new Date().toISOString().split("T")[0];
        const entries = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/syllabus", changefreq: "weekly", priority: "0.8" },
          { path: "/quiz", changefreq: "weekly", priority: "0.8" },
          { path: "/planner", changefreq: "weekly", priority: "0.8" },
          { path: "/notes", changefreq: "weekly", priority: "0.7" },
          { path: "/review", changefreq: "daily", priority: "0.8" },
          { path: "/mock-test", changefreq: "weekly", priority: "0.8" },
          { path: "/focus", changefreq: "weekly", priority: "0.7" },
          { path: "/pyq", changefreq: "weekly", priority: "0.8" },
          { path: "/chat", changefreq: "daily", priority: "0.9" },
          { path: "/analytics", changefreq: "weekly", priority: "0.6" },
          { path: "/leaderboard", changefreq: "daily", priority: "0.6" },
          { path: "/community", changefreq: "daily", priority: "0.7" },
          { path: "/login", changefreq: "monthly", priority: "0.5" },
        ];
        const urls = entries.map(
          (e) =>
            `  <url>\n    <loc>${BASE_URL}${e.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
        );
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
