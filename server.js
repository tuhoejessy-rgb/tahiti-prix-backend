const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Tahiti Prix backend actif"
  });
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

    await page.goto(searchUrl, {
      waitUntil: "networkidle",
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    const results = await page.$$eval("article", (items) =>
      items.slice(0, 10).map((item) => {
        const name =
          item.querySelector(".product-title, h2, h3, a")?.innerText?.trim() || "";

        const priceText =
          item.querySelector(".price")?.innerText?.trim() ||
          item.innerText.match(/\d+\s?XPF/)?.[0] ||
          "";

        const price =
          priceText.replace(/[^\d]/g, "");

        const image =
          item.querySelector("img")?.src || "";

        const url =
          item.querySelector("a")?.href || "";

        return {
          name,
          price: price ? Number(price) : null,
          priceText,
          image,
          url,
          store: "Carrefour Arue"
        };
      })
    );

    await browser.close();

    res.json({
      success: true,
      query: productName,
      source: searchUrl,
      store: "Carrefour Arue",
      count: results.length,
      results: results.filter((r) => r.name && r.price)
    });

  } catch (error) {
    if (browser) {
      await browser.close();
    }

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
