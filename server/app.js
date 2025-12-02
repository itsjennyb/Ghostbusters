const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

require('./config/connection');

const { ApolloServer } = require('apollo-server-express');
const { typeDefs, resolvers } = require('./schemas');
// Use Cognito authentication
const { authMiddleware } = require('./utils/cognito-auth');

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

      // ✅ CORS configuration
      app.use(cors({
        origin: '*', // OR your frontend URL like 'https://d21774mc1dpxvk.cloudfront.net'
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      }));

      app.use(express.urlencoded({ extended: false }));
      app.use(express.json());

      // ✅ Health check
      app.get('/healthz', (_req, res) => {
        res.status(200).send('OK');
      });

      // ✅ Serve client app if build exists
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

      // ✅ Attach Apollo middleware (AFTER CORS)
      const server = await getApolloServer();
      server.applyMiddleware({
        app,
        path: '/graphql',
        cors: false, // Let express handle CORS
      });

      return app;
    })();
  }

  return appPromise;
}

module.exports = {
  createApp,
  getApolloServer,
};