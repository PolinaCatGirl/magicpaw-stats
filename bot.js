const WEEK_API =
  "https://fletcher-wiki.com/api/hltv/family/1983?server=ru7&period=week";

const MONTH_API =
  "https://fletcher-wiki.com/api/hltv/family/1983?server=ru7&period=month";

const BASE_URL = "https://fletcher-wiki.com";

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!webhookUrl) {
  throw new Error("Не найден DISCORD_WEBHOOK_URL");
}


// =====================================================
// ПОЛУЧАЕМ COOKIE С FLETCHER
// =====================================================

async function getFletcherCookies() {
  const response = await fetch(
    `${BASE_URL}/players-family-stats/family/1983?server=ru7`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":
          "ru-RU,ru;q=0.9,en;q=0.8"
      },
      redirect: "follow"
    }
  );

  const cookies = response.headers.getSetCookie
    ? response.headers.getSetCookie()
    : [];

  if (!cookies.length) {
    console.log("Fletcher не выдал cookies автоматически.");
    return "";
  }

  return cookies
    .map(cookie => cookie.split(";")[0])
    .join("; ");
}


// =====================================================
// ПОЛУЧЕНИЕ СТАТИСТИКИ
// =====================================================

async function getStats(url, cookie) {
  const response = await fetch(url, {
    method: "GET",

    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36",

      "Accept":
        "application/json, text/plain, */*",

      "Accept-Language":
        "ru-RU,ru;q=0.9,en;q=0.8",

      "Referer":
        `${BASE_URL}/players-family-stats/family/1983?server=ru7`,

      "Origin":
        BASE_URL,

      "Cookie":
        cookie
    },

    redirect: "follow"
  });

  const text = await response.text();

  console.log(
    `Fletcher response ${response.status}:`,
    text.slice(0, 200)
  );

  if (!response.ok) {
    throw new Error(
      `Fletcher API: ${response.status} ${response.statusText}`
    );
  }

  if (
    text.trim().startsWith("<!DOCTYPE") ||
    text.trim().startsWith("<html")
  ) {
    throw new Error(
      "Fletcher снова вернул HTML вместо JSON. " +
      "Вероятно, API требует авторизованную сессию."
    );
  }

  const data = JSON.parse(text);

  return Array.isArray(data.roster)
    ? data.roster
    : [];
}


// =====================================================
// ФОРМАТ ЧИСЕЛ
// =====================================================

function formatNumber(value) {
  return Number(value || 0)
    .toLocaleString("ru-RU");
}


// =====================================================
// РЕЙТИНГ
// =====================================================

function buildRanking(players) {
  const sorted = players
    .filter(
      player =>
        Number(player.totalDamage) > 0
    )
    .sort(
      (a, b) =>
        Number(b.totalDamage) -
        Number(a.totalDamage)
    );

  if (sorted.length === 0) {
    return {
      text:
        "За этот период статистики пока нет.",
      count: 0,
      damage: 0,
      kills: 0
    };
  }

  let text = "";

  sorted.forEach(
    (player, index) => {
      let place = `${index + 1}.`;

      if (index === 0) {
        place = "🥇";
      }

      if (index === 1) {
        place = "🥈";
      }

      if (index === 2) {
        place = "🥉";
      }

      text +=
        `${place} **${player.name}** — ` +
        `\`${formatNumber(player.totalDamage)}\` 💥\n`;
    }
  );

  const damage = sorted.reduce(
    (sum, player) =>
      sum +
      Number(
        player.totalDamage || 0
      ),
    0
  );

  const kills = sorted.reduce(
    (sum, player) =>
      sum +
      Number(
        player.totalKills || 0
      ),
    0
  );

  return {
    text,
    count: sorted.length,
    damage,
    kills
  };
}


// =====================================================
// DISCORD
// =====================================================

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

    embeds: [
      {
        title,

        description:
          `${subtitle}\n\n` +
          `${stats.text}`,

        color: 15442658,

        fields: [
          {
            name:
              "👥 Игроков с уроном",
            value:
              String(stats.count),
            inline: true
          },

          {
            name:
              "💥 Общий урон",
            value:
              formatNumber(
                stats.damage
              ),
            inline: true
          },

          {
            name:
              "☠️ Убийств",
            value:
              formatNumber(
                stats.kills
              ),
            inline: true
          }
        ],

        footer: {
          text:
            "MagicPaw • Fletcher Wiki • Автоматическое обновление"
        },

        timestamp:
          new Date()
            .toISOString()
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
          JSON.stringify(
            payload
          )
      }
    );

  if (!response.ok) {
    throw new Error(
      `Discord: ${response.status} ` +
      `${await response.text()}`
    );
  }
}


// =====================================================
// ЗАПУСК
// =====================================================

async function main() {
  console.log(
    "Получаем cookies Fletcher..."
  );

  const cookie =
    await getFletcherCookies();

  console.log(
    cookie
      ? "Cookies получены."
      : "Cookies не получены."
  );

  console.log(
    "Получаем статистику за неделю..."
  );

  const week =
    await getStats(
      WEEK_API,
      cookie
    );

  console.log(
    "Получаем статистику за месяц..."
  );

  const month =
    await getStats(
      MONTH_API,
      cookie
    );

  await sendStats(
    "🐾 MagicPaw • Урон за неделю",
    "📅 Статистика за текущую неделю",
    week
  );

  await new Promise(
    resolve =>
      setTimeout(
        resolve,
        1500
      )
  );

  await sendStats(
    "🐾 MagicPaw • Урон за месяц",
    "🗓️ Статистика за текущий месяц",
    month
  );

  console.log(
    "Готово."
  );
}


main().catch(error => {
  console.error(error);
  process.exit(1);
});
