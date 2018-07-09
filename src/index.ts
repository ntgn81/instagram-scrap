import * as fs from 'fs';
import * as puppeteer from 'puppeteer';
import { promisify } from 'util';
import db from './db';
import * as t from './definitions';
const writeFileAsync = promisify(fs.writeFile);

/* ========= COFIGURATIONS START ========= */
const NUMBER_OF_PAGES = 1;
const SHOW_CHROME = true;
const HASHTAG = 'fitnesstrainer';
/* ========= COFIGURATIONS END ========= */

const sleep = ms => new Promise(r => setTimeout(r, ms));
const escapeForCsv = str => str.replace(/"/g, '""');

(async () => {
  try {
    await run();
    console.log('Done');
  } catch (e) {
    console.error('Failed', e.message);
  } finally {
    await db.closeConnection();
    process.exit();
  }
})();

async function run() {
  await db.initConnection();

  const browser = await puppeteer.launch({ headless: !SHOW_CHROME });
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 2000, deviceScaleFactor: 0.1 });

  const posts = await getHashtagPosts(page, HASHTAG, NUMBER_OF_PAGES);

  const owners = await getUniquePostOwners(page, posts);

  const users = await getUsers(page, owners);

  const usersWithAnalytics = await extractEmail(users);

  await exportToCsv(usersWithAnalytics);
  // await writeFileAsync(
  //   'users.json',
  //   JSON.stringify(
  //     usersWithAnalytics.map(({ username, email, biography, external_url, followers }) => ({
  //       biography,
  //       email,
  //       external_url,
  //       followers,
  //       username
  //     }))
  //   )
  // );

  await browser.close();
}

async function getUsers(page: t.Page, users: t.BaseUser[]): Promise<t.User[]> {
  const resolvedUsers: t.User[] = [];

  for (const { username } of users) {
    const user = await getUser(page, username);
    if (user) {
      resolvedUsers.push(user);
    }
  }
  return resolvedUsers;
}

async function getUser(page: t.Page, username: string): Promise<t.User> {
  let user = await db.usernameToUser.get(username);

  if (user) {
    return user;
  }

  const pageData = await extractPageData(page, `https://www.instagram.com/${username}/`);
  try {
    user = pageData.ProfilePage[0].graphql.user;
    db.usernameToUser.save(username, user);

    return user;
  } catch (e) {
    console.log(
      'Failed for getUsers ',
      `https://www.instagram.com/${username}/`,
      JSON.stringify(pageData),
      e.message
    );
  }
}

async function getUniquePostOwners(page: t.Page, posts: t.Post[]): Promise<t.BaseUser[]> {
  const postOwnersByName: Record<string, t.BaseUser> = {};

  for (const { shortcode } of posts) {
    const owner = await getPostOwner(page, shortcode);

    if (owner) {
      postOwnersByName[owner.username] = owner;
    }

    await sleep(300);
  }

  return Object.values(postOwnersByName);
}

async function getPostOwner(page: t.Page, shortcode: string): Promise<t.BaseUser> {
  let baseUser = await db.postToOwner.get(shortcode);

  const pageData = await extractPageData(page, `https://www.instagram.com/p/${shortcode}/`);

  try {
    baseUser = pageData.PostPage[0].graphql.shortcode_media.owner;
    db.postToOwner.save(shortcode, baseUser);

    return baseUser;
  } catch (e) {
    console.log(
      'Failed for getPostOwner ',
      `https://www.instagram.com/p/${shortcode}/`,
      JSON.stringify(pageData),
      e.message
    );
  }
}

async function getHashtagPosts(
  page: t.Page,
  hashtag: string,
  numberOfPages: number
): Promise<t.Post[]> {
  const responses: t.Response[] = [];
  const handler = (response: t.Response) => {
    if (response.url().startsWith('https://www.instagram.com/graphql/query')) {
      responses.push(response);
    }
  };

  page.on('response', handler);
  await page.goto(`https://www.instagram.com/explore/tags/${hashtag}/`);
  while (responses.length < numberOfPages) {
    await page.keyboard.press('Space', { delay: 50 });
  }
  page.removeListener('response', handler);

  const graphqlResponses = await Promise.all(
    responses.map(async r => JSON.parse(await r.text()) as t.GraphqlResponse)
  );

  const hashtagDataList = graphqlResponses.map(r => r.data.hashtag);
  const postsByShortcode: Record<string, t.Post> = {};
  hashtagDataList.forEach(({ edge_hashtag_to_media, edge_hashtag_to_top_posts }) => {
    [
      ...((edge_hashtag_to_media && edge_hashtag_to_media.edges) || []),
      ...((edge_hashtag_to_top_posts && edge_hashtag_to_top_posts.edges) || [])
    ].map(edge => {
      postsByShortcode[edge.node.shortcode] = edge.node;
    });
  });

  return Object.values(postsByShortcode);
}

async function extractPageData(page: t.Page, url: string): Promise<t.InstagramPageData> {
  const resp = await page.goto(`view-source:${url}`);

  // parseable data comes from window._sharedData that comes down as part of html response
  const regexp = /window._sharedData = (\{.*\});<\/script>/;
  const text = await resp.text();
  const match = regexp.exec(text);
  const sharedData = JSON.parse(match[1]) as t.InstagramSharedData;
  return sharedData.entry_data;
}

const emailRegexp = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
async function extractEmail(users: t.User[]): Promise<t.UserWithAnalytics[]> {
  const usersWithAnalytics: t.UserWithAnalytics[] = [];
  for (const user of users) {
    const match = user.biography && user.biography.match(emailRegexp);
    const email = (match && match[0]) || null;
    const followers = (user.edge_followed_by && user.edge_followed_by.count) || 0;
    usersWithAnalytics.push({
      ...user,
      email,
      followers
    });
  }
  return usersWithAnalytics;
}

async function exportToCsv(users: t.UserWithAnalytics[]) {
  const userRows = users.map(
    ({ username, full_name, email, external_url, followers, biography }) =>
      `"${username}","${full_name}","${followers}","${email}","${external_url}","${escapeForCsv(
        biography
      )}"`
  );
  await writeFileAsync(
    '../users.csv',
    ['Username,Full Name,Followers,Email,ExternalUrl,Bio', ...userRows].join('\n')
  );
}