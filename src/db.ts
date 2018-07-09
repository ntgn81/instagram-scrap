import { Collection, MongoClient } from 'mongodb';
import * as t from './definitions';

let connection: MongoClient;
let postToOwnerCol: Collection<{
  shortcode: string;
  createdDate: Date;
  owner: t.BaseUser;
}>;
let usernameToUserCol: Collection<{
  username: string;
  user: t.User;
}>;

const db = {
  async initConnection(user: string, pass: string) {
    connection = await MongoClient.connect(
      `mongodb://${user}:${pass}@ds131551.mlab.com:31551/instagram-data`,
      { useNewUrlParser: true }
    );

    postToOwnerCol = await connection.db().collection('post-to-owner');
    usernameToUserCol = await connection.db().collection('username-to-user');
  },

  async closeConnection() {
    if (connection) {
      await connection.close();
    }
  },

  postToOwner: {
    async get(shortcode: string): Promise<t.BaseUser> {
      const record = await postToOwnerCol.findOne({
        shortcode
      });
      if (record) {
        return record.owner;
      }
    },
    async save(shortcode: string, owner: t.BaseUser) {
      await postToOwnerCol.updateOne(
        { shortcode },
        { $set: { owner, createdDate: new Date() } },
        { upsert: true }
      );
    }
  },

  usernameToUser: {
    async get(username: string): Promise<t.User> {
      const record = await usernameToUserCol.findOne({
        username
      });
      if (record) {
        return record.user;
      }
    },
    async save(username: string, user: t.User) {
      await usernameToUserCol.updateOne(
        { username },
        { $set: { user, createdDate: new Date() } },
        { upsert: true }
      );
    }
  }
};

export default db;
