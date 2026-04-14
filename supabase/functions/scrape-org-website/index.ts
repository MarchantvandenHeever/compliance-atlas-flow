import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "@supabase/supabase-js/cors";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let formatted = url.trim();
    if (!formatted.startsWith("http://") && !formatted.startsWith("https://")) {
      formatted = `https://${formatted}`;
    }

    // Fetch the page HTML
    const res = await fetch(formatted, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LovableBot/1.0; +https://lovable.dev)",
        Accept: "text/html",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch website: ${res.status}`);
    }

    const html = await res.text();

    // Extract org name from <title> or og:site_name
    let name = "";
    const ogSiteName = html.match(
      /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i
    );
    if (ogSiteName) {
      name = ogSiteName[1];
    } else {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        // Take first part before separators
        name = titleMatch[1].split(/[|\-–—]/)[0].trim();
      }
    }

    // Extract primary color from theme-color meta or CSS
    let primaryColor = "";
    const themeColor = html.match(
      /<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i
    );
    if (themeColor) {
      primaryColor = themeColor[1];
    } else {
      // Try msapplication-TileColor
      const tileColor = html.match(
        /<meta[^>]*name=["']msapplication-TileColor["'][^>]*content=["']([^"']+)["']/i
      );
      if (tileColor) {
        primaryColor = tileColor[1];
      }
    }

    // Extract logo from og:image or common favicon/logo patterns
    let logoUrl = "";
    const ogImage = html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
    );
    if (ogImage) {
      logoUrl = ogImage[1];
      // Make absolute if relative
      if (logoUrl.startsWith("/")) {
        const base = new URL(formatted);
        logoUrl = `${base.origin}${logoUrl}`;
      }
    } else {
      // Try apple-touch-icon
      const appleIcon = html.match(
        /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i
      );
      if (appleIcon) {
        logoUrl = appleIcon[1];
        if (logoUrl.startsWith("/")) {
          const base = new URL(formatted);
          logoUrl = `${base.origin}${logoUrl}`;
        }
      }
    }

    return new Response(
      JSON.stringify({
        name: name || null,
        primaryColor: primaryColor || null,
        logoUrl: logoUrl || null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("scrape-org-website error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
