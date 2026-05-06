const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;

const CARREFOUR_BASE = "https://ecourses.carrefour.pf";
const STORE = "Carrefour Arue";

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Tahiti Prix backend actif"
  });
});

app.post("/api/search-price", async (req, res) => {
  const productName = (req.body.productName || "").trim();

  if (!productName) {
    return res.status(400).json({
      success: false,
      message: "Nom du produit manquant"
    });
  }

  const searchUrl =
    `${CARREFOUR_BASE}/arue/recherche?controller=search&s=${encodeURIComponent(productName)}`;

  let browser;

  try {
    const launchOptions = {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    };

    // Plus tard, si tu as un proxy PF Railway :
    // Variables Railway :
    // PROXY_SERVER=http://ip:port
    // PROXY_USERNAME=...
    // PROXY_PASSWORD=...
    if (process.env.PROXY_SERVER) {
      launchOptions.proxy = {
        server: process.env.PROXY_SERVER,
        username: process.env.PROXY_USERNAME || undefined,
        password: process.env.PROXY_PASSWORD || undefined
      };
    }

    browser = await chromium.launch(launchOptions);

    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      locale: "fr-FR",
      timezoneId: "Pacific/Tahiti"
    });

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForTimeout(5000);

    const bodyText = await page.evaluate(() => document.body.innerText || "");

    if (
      bodyText.includes("403 Interdit") ||
      bodyText.includes("Vous ne pouvez pas accéder") ||
      bodyText.includes("depuis votre pays")
    ) {
      await browser.close();

      return res.json({
        success: false,
        blocked: true,
        query: productName,
        store: STORE,
        message:
          "Carrefour bloque l'accès car le serveur n'a pas une IP située en Polynésie française.",
        solution:
          "Ajouter un proxy ou serveur avec IP Polynésie française dans les variables Railway."
      });
    }

    const results = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll(".product-miniature, article, .js-product-miniature, .product")
      );

      return cards
        .map((card) => {
          const text = card.innerText || "";

          const name =
            card.querySelector(".product-title")?.innerText?.trim() ||
            card.querySelector("h2")?.innerText?.trim() ||
            card.querySelector("h3")?.innerText?.trim() ||
            card.querySelector("a")?.innerText?.trim() ||
            "";

          const priceText =
            card.querySelector(".price")?.innerText?.trim() ||
            card.querySelector("[itemprop='price']")?.getAttribute("content") ||
            text.match(/\d[\d\s]*\s*XPF/i)?.[0] ||
            "";

          const price = priceText.replace(/[^\d]/g, "");

          return {
            name,
            price: price ? Number(price) : null,
            priceText: priceText.includes("XPF") ? priceText : price ? `${price} XPF` : "",
            image: card.querySelector("img")?.src || "",
            url: card.querySelector("a")?.href || "",
            store: "Carrefour Arue"
          };
        })
        .filter((p) => p.name && p.price);
    });

    await browser.close();

    return res.json({
      success: true,
      blocked: false,
      query: productName,
      source: searchUrl,
      store: STORE,
      count: results.length,
      results
    });
  } catch (error) {
    if (browser) await browser.close();

    return res.status(500).json({
      success: false,
      blocked: false,
      message: "Erreur pendant la recherche Carrefour",
      error: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend lancé sur le port ${PORT}`);
});