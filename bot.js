const { chromium } = require("playwright");
const fs = require("fs");

const FAMILY_PAGE =
  "https://fletcher-wiki.com/players-family-stats/family/1983?server=ru7";

async function getStats(page, period) {
  console.log(`Получаем статистику: ${period}`);

  await page.goto(FAMILY_PAGE, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  await page.waitForTimeout(3000);

  const result = await page.evaluate(
    async ({ period }) => {
      const url =
        `/api/hltv/family/1983?server=ru7&period=${period}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });

      return {
        status: response.status,
        text: await response.text()
      };
    },
    { period }
  );

  console.log(`${period} status: ${result.status}`);

  if (
    result.text.trim().startsWith("<!DOCTYPE") ||
    result.text.trim().startsWith("<html")
  ) {
    throw new Error(
      `Fletcher вернул HTML для периода ${period}`
    );
  }

  const data = JSON.parse(result.text);

  const roster = Array.isArray(data.roster)
    ? data.roster
    : [];

  console.log(
    `${period}: найдено игроков ${roster.length}`
  );

  // Сохраняем только нужные нам данные
  return roster.map(player => ({
    id: player.id,
    name: player.name,
    avgDamage: Number(player.avgDamage) || 0,
    totalDamage: Number(player.totalDamage) || 0,
    totalKills: Number(player.totalKills) || 0,
    captsPlayed: Number(player.captsPlayed) || 0
  }));
}

async function main() {
  console.log("Запускаем Chromium...");

  const browser = await chromium.launch({
    headless: true
  });

  try {
    const context = await browser.newContext({
      locale: "ru-RU",

      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/131.0.0.0 Safari/537.36"
    });

    const page = await context.newPage();

    // Получаем неделю
    const week = await getStats(
      page,
      "week"
    );

    // Получаем месяц
    const month = await getStats(
      page,
      "month"
    );

    const stats = {
      updatedAt: new Date().toISOString(),
      week,
      month
    };

    fs.writeFileSync(
      "stats.json",
      JSON.stringify(stats, null, 2),
      "utf8"
    );

    console.log(
      `Готово. Неделя: ${week.length}, месяц: ${month.length}`
    );

  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
