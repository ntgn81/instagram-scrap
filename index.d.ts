import puppeteer = require('puppeteer');

export type Page = puppeteer.Page;
export type Response = puppeteer.Response;

export interface Post {
  id: string;
  shortcode: string;
  owner: {
    id: string;
  };
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

export interface ShortcodeMediaData {
  owner: {
    id: string;
    reel: {
      owner: {
        username: string;
      };
    };
  };
}

export interface GraphqlResponse {
  data: {
    hashtag?: HashtagData;
    shortcode_media?: ShortcodeMediaData;
  };
}
