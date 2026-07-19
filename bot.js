const { chromium } = require("playwright");

const FAMILY_PAGE =
  "https://fletcher-wiki.com/players-family-stats/family/1983?server=ru7";

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!webhookUrl) {
  throw new Error("Не найден DISCORD_WEBHOOK_URL");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ru-RU");
}

function buildRanking(players) {
  const sorted = players
    .filter(player => Number(player.totalDamage) > 0)
    .sort(
      (a, b) =>
        Number(b.totalDamage) -
        Number(a.totalDamage)
    );

  if (sorted.length === 0) {
    return {
      text: "За этот период статистики пока нет.",
      count: 0,
      damage: 0,
      kills: 0
    };
  }

  let text = "";

  sorted.forEach((player, index) => {
    let place = `${index + 1}.`;

    if (index === 0) place = "🥇";
    if (index === 1) place = "🥈";
    if (index === 2) place = "🥉";

    text +=
      `${place} **${player.name}** — ` +
      `\`${formatNumber(player.totalDamage)}\` 💥\n`;
  });

  return {
    text,
    count: sorted.length,

    damage: sorted.reduce(
      (sum, player) =>
        sum + Number(player.totalDamage || 0),
      0
    ),

    kills: sorted.reduce(
      (sum, player) =>
        sum + Number(player.totalKills || 0),
      0
    )
  };
}

async function getStats(page, period) {
  console.log(`Получаем статистику: ${period}`);

  const apiPart =
    `/api/hltv/family/1983?server=ru7&period=${period}`;

  const responsePromise = page.waitForResponse(
    response =>
      response.url().includes(apiPart) &&
      response.status() === 200,
    {
      timeout: 30000
    }
  );

  // Открываем страницу сразу с нужным периодом
  await page.goto(
    `${FAMILY_PAGE}&period=${period}`,
    {
      waitUntil: "domcontentloaded",
      timeout: 60000
    }
  );

  const response =
    await responsePromise;

  const contentType =
    response.headers()["content-type"] || "";

  console.log(
    `${period} content-type: ${contentType}`
  );

  const data =
    await response.json();

  if (!Array.isArray(data.roster)) {
    console.log(
      `В ответе ${period} нет массива roster`
    );

    return [];
  }

  console.log(
    `${period}: найдено игроков ${data.roster.length}`
  );

  return data.roster;
}

async function sendStats(
  title,
  subtitle,
  players
) {
  const stats =
    buildRanking(players);

  const payload = {
    username:
      "MagicPaw • Capt Stats",

    allowed_mentions: {
      parse: []
    },

    embeds: [
      {
        title,

        description:
          `${subtitle}\n\n` +
          stats.text,

        color: 15442658,

        fields: [
          {
            name: "👥 Игроков с уроном",
            value: String(stats.count),
            inline: true
          },
          {
            name: "💥 Общий урон",
            value: formatNumber(stats.damage),
            inline: true
          },
          {
            name: "☠️ Убийств",
            value: formatNumber(stats.kills),
            inline: true
          }
        ],

        footer: {
          text:
            "MagicPaw • Fletcher Wiki • Обновлено автоматически"
        },

        timestamp:
          new Date().toISOString()
      }
    ]
  };

  const response =
    await fetch(
      webhookUrl,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(payload)
      }
    );

  if (!response.ok) {
    throw new Error(
      `Discord ${response.status}: ` +
      await response.text()
    );
  }
}

async function main() {
  console.log("Запускаем Chromium...");

  const browser =
    await chromium.launch({
      headless: true
    });

  try {
    const context =
      await browser.newContext({
        locale: "ru-RU",

        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/131.0.0.0 Safari/537.36"
      });

    const page =
      await context.newPage();

    const week =
      await getStats(
        page,
        "week"
      );

    const month =
      await getStats(
        page,
        "month"
      );

    await sendStats(
      "🐾 MagicPaw • Урон за неделю",
      "📅 Статистика за текущую неделю",
      week
    );

    await new Promise(
      resolve =>
        setTimeout(resolve, 1500)
    );

    await sendStats(
      "🐾 MagicPaw • Урон за месяц",
      "🗓️ Статистика за текущий месяц",
      month
    );

    console.log("Готово.");

  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
