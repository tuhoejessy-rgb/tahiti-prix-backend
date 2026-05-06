const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Tahiti Prix backend actif" });
});

app.post("/api/search-price", async (req, res) => {
  const productName = req.body.productName || "beurre anchor";

  const searchUrl =
    "https://ecourses.carrefour.pf/arue/recherche?controller=search&s=" +
    encodeURIComponent(productName);

  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);

    const results = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(
        ".product-miniature, article, .js-product-miniature, .product"
      ));

      return cards.map((card) => {
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

        const image = card.querySelector("img")?.src || "";
        const url = card.querySelector("a")?.href || "";

        return {
          name,
          price: price ? Number(price) : null,
          priceText: priceText.includes("XPF") ? priceText : price ? `${price} XPF` : "",
          image,
          url,
          store: "Carrefour Arue"
        };
      }).filter((p) => p.name && p.price);
    });

    await browser.close();

    res.json({
      success: true,
      query: productName,
      source: searchUrl,
      store: "Carrefour Arue",
      count: results.length,
      results
    });

  } catch (error) {
    if (browser) await browser.close();

    res.status(500).json({
      success: false,
      message: "Erreur pendant la recherche Carrefour",
      error: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend lancé sur le port ${PORT}`);
});