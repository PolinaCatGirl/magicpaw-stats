const WEEK_API =
  "https://fletcher-wiki.com/api/hltv/family/1983?server=ru7&period=week";

const MONTH_API =
  "https://fletcher-wiki.com/api/hltv/family/1983?server=ru7&period=month";

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!webhookUrl) {
  throw new Error("Не найден DISCORD_WEBHOOK_URL");
}

async function getStats(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Fletcher API: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  return Array.isArray(data.roster)
    ? data.roster
    : [];
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ru-RU");
}

function buildRanking(players) {
  const sorted = players
    .filter(player => Number(player.totalDamage) > 0)
    .sort(
      (a, b) =>
        Number(b.totalDamage) - Number(a.totalDamage)
    );

  if (sorted.length === 0) {
    return {
      text: "За этот период статистики пока нет.",
      count: 0,
      damage: 0
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

  const damage = sorted.reduce(
    (sum, player) =>
      sum + Number(player.totalDamage || 0),
    0
  );

  return {
    text,
    count: sorted.length,
    damage
  };
}

async function sendStats(title, players) {
  const stats = buildRanking(players);

  const payload = {
    username: "MagicPaw • Capt Stats",
    embeds: [
      {
        title,
        description: stats.text,
        color: 15442658,
        fields: [
          {
            name: "👥 Игроков",
            value: String(stats.count),
            inline: true
          },
          {
            name: "💥 Общий урон",
            value: formatNumber(stats.damage),
            inline: true
          }
        ],
        footer: {
          text: "MagicPaw • Fletcher Wiki"
        },
        timestamp: new Date().toISOString()
      }
    ]
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(
      `Discord: ${response.status} ${await response.text()}`
    );
  }
}

async function main() {
  const week = await getStats(WEEK_API);
  const month = await getStats(MONTH_API);

  await sendStats(
    "🐾 MagicPaw • Урон за неделю",
    week
  );

  await sendStats(
    "🐾 MagicPaw • Урон за месяц",
    month
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
