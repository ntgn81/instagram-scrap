import puppeteer = require('puppeteer');

export type Page = puppeteer.Page;
export type Response = puppeteer.Response;
export type Browser = puppeteer.Browser;

export interface Config {
  showChrome: boolean;
  numberOfPages: number;
  hashtag: string;
  dbUser: string;
}

export interface BaseUser {
  username: string;
}

export interface User extends BaseUser {
  full_name: string;
  biography: string;
  external_url: string;
  edge_followed_by: { count: number };
}

export interface UserWithAnalytics extends User {
  email: string;
  followers?: count;
}

export interface Post {
  id: string;
  shortcode: string;
  owner: BaseUser;
}

interface Edge<T> {
  node: T;
}

export interface HashtagData {
  name: string;
  edge_hashtag_to_media: {
    count: number;
    edges: Edge<Post>[];
  };
  edge_hashtag_to_top_posts: {
    edges: Edge<Post>[];
  };
}

export interface GraphqlResponse {
  data: {
    hashtag?: HashtagData;
  };
}

export interface InstagramPageData {
  PostPage?: [
    {
      graphql: {
        shortcode_media: Post;
      };
    }
  ];
  ProfilePage?: [
    {
      graphql: {
        user: User;
      };
    }
  ];
}

export interface InstagramSharedData {
  entry_data: InstagramPageData;
}
