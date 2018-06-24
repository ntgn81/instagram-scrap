import * as puppeteer from 'puppeteer';
import * as t from './index.d';

const sleep = ms => new Promise(r => setTimeout(r, ms));
run().then(console.log);

async function run() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 2000, deviceScaleFactor: 0.1 });

  const posts = await getHashtagPosts(page, 'fitnesstrainer', 2);

  await browser.close();
}

async function getHashtagPosts(
  page: t.Page,
  hashtag: string,
  numberOfPages: number
): Promise<t.Post[]> {
  const responses: t.Response[] = [];
  const handler = getHandler(responses);

  await page.goto(`https://www.instagram.com/explore/tags/${hashtag}/`);
  page.on('response', handler);
  while (responses.length < numberOfPages) {
    await page.keyboard.press('Space', { delay: 50 });
  }
  page.removeListener('response', handler);
  const graphqlResponses = await getGraphqlResponses(responses);

  const hashtagDataList = graphqlResponses.map(r => r.data.hashtag);
  const postsByShortcode: Record<string, t.Post> = {};
  hashtagDataList.forEach(hashtagData => {
    [
      ...hashtagData.edge_hashtag_to_media.edges,
      ...hashtagData.edge_hashtag_to_top_posts.edges
    ].map(edge => {
      postsByShortcode[edge.node.shortcode] = edge.node;
    });
  });

  return Object.values(postsByShortcode);
}

function getHandler(responses: t.Response[]) {
  return (response: t.Response) => {
    if (response.url().startsWith('https://www.instagram.com/graphql/query')) {
      responses.push(response);
    }
  };
}

function getGraphqlResponses(responses: t.Response[]): Promise<t.GraphqlResponse[]> {
  return Promise.all(responses.map(async r => JSON.parse(await r.text()) as t.GraphqlResponse));
}
