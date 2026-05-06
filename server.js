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
  const productName = req.body.productName || "beurre";

  const searchUrl =
    "https://ecourses.carrefour.pf/arue/recherche?controller=search&s=" +
    encodeURIComponent(productName);

  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox"
      ]
    });

    const page = await browser.newPage();

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForTimeout(8000);

    const pageTitle = await page.title();

    const html = await page.content();

    const bodyText = await page.evaluate(() => {
      return document.body.innerText;
    });

    const cardsCount = await page.evaluate(() => {
      return document.querySelectorAll("article").length;
    });

    const productTitles = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a"))
        .map(el => el.innerText.trim())
        .filter(t => t.length > 5)
        .slice(0, 20);
    });

    await browser.close();

    res.json({
      success: true,
      query: productName,
      url: searchUrl,
      title: pageTitle,
      cardsCount,
      productTitles,
      bodyPreview: bodyText.substring(0, 3000),
      htmlPreview: html.substring(0, 3000)
    });

  } catch (error) {

    if (browser) {
      await browser.close();
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend lancé sur le port ${PORT}`);
});
