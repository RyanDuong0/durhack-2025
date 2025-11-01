function randomDate(startYear = 2015, endYear = 2025) {
  const start = new Date(`${startYear}-01-01`).getTime();
  const end = new Date(`${endYear}-12-31`).getTime();
  const timestamp = start + Math.random() * (end - start);
  return new Date(timestamp);
}

function randomScore(min = 0.3, max = 1) {
  return +(min + Math.random() * (max - min)).toFixed(2);
}

const topics = [
  "#AI", "#ReactJS", "#OpenAI", "#WebDev", "#NodeJS",
  "#JavaScript", "#TechNews", "#AIChatbots", "#ReactNative", "#MachineLearning",
  "#DataScience", "#OpenSource", "#TypeScript", "#FrontEnd", "#BackEnd",
  "#CloudComputing", "#DevOps", "#CyberSecurity", "#AIRevolution", "#Blockchain",
  "#BigData", "#NLP", "#DeepLearning", "#Startups", "#Coding",
  "#Programming", "#Software", "#Innovation", "#TechTrends", "#GPT"
];

export const trends = Array.from({ length: 30 }, (_, i) => ({
  date: randomDate(2015, 2025),
  topic: topics[i % topics.length],
  score: randomScore()
})).sort((a, b) => a.date - b.date); // sort by date
