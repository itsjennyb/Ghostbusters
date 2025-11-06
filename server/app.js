const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

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

      //cors config
      app.use(cors({
        origin: 'https://d21774mc1dpxvk.cloudfront.net',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
      }));

      //handle preflight OPTIONS requests
      app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://d21774mc1dpxvk.cloudfront.net');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

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
