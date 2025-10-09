const express = require('express');
const path = require('path');
const fs = require('fs');

require('./config/connection');

const { ApolloServer } = require('apollo-server-express');
const { typeDefs, resolvers } = require('./schemas');
const { authMiddleware } = require('./utils/auth');

let apolloServer;
let appPromise;

async function getApolloServer() {
  if (!apolloServer) {
    apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      context: authMiddleware,
    });

    await apolloServer.start();
  }

  return apolloServer;
}

async function createApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const app = express();

      app.use(express.urlencoded({ extended: false }));
      app.use(express.json());

      app.get('/healthz', (_req, res) => {
        res.status(200).send('OK');
      });

      const clientBuildPath = path.join(__dirname, '../client/build');
      const serveClient = process.env.SERVE_CLIENT !== 'false'
        && fs.existsSync(path.join(clientBuildPath, 'index.html'));

      if (serveClient) {
        app.use(express.static(clientBuildPath));

        app.get('*', (_req, res) => {
          res.sendFile(path.join(clientBuildPath, 'index.html'));
        });
      } else {
        app.get('/', (_req, res) => {
          res.status(200).json({ status: 'ok' });
        });
      }

      const server = await getApolloServer();
      server.applyMiddleware({ app });

      return app;
    })();
  }

  return appPromise;
}

module.exports = {
  createApp,
  getApolloServer,
};
