
const {
  fetchBorderNews,
} = require("../services/borderNewsSyncService");

async function main() {
  try {
    const articles = await fetchBorderNews();

    console.log(`Articole identificate: ${articles.length}`);

    console.table(
      articles.slice(0, 10).map((article) => ({
        title: article.title,
        url: article.url,
        image: Boolean(article.image_url),
      }))
    );
  } catch (error) {
    console.error(
      "Eroare la extragerea știrilor:",
      error.message
    );

    process.exitCode = 1;
  }
}

main();
