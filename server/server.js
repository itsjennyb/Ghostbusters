const express = require('express');
const path = require('path');
const fs = require('fs');
require('./config/connection');
// IMPORT APOLLO SERVER AND OUR TYPEDEFS/RESOLVERS
const { ApolloServer } = require('apollo-server-express');
const { typeDefs, resolvers } = require('./schemas')
const { authMiddleware } = require('./utils/auth')

const app = express();
const PORT = process.env.PORT || 3001;

// CREATE THE APOLLO SERVER WITH OUR TYPEDEFS/RESOLVERS AND CONTEXT
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: authMiddleware,
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const clientBuildPath = path.join(__dirname, '../client/build');
const serveClient = process.env.SERVE_CLIENT !== 'false'
  && fs.existsSync(path.join(clientBuildPath, 'index.html'));

if (serveClient) {
  app.use(express.static(clientBuildPath));

  // Redirect unhandled routes to the React app when client assets are available
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
}

// START THE APOLLO SERVER USING EXPRESS AS OUR MIDDLEWARE
const startApolloServer = async (typeDefs, resolvers) => {
  await server.start();
  server.applyMiddleware({ app });

  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}!`);
    console.log(`Use GraphQL at http://localhost:${PORT}${server.graphqlPath}`)
  });
}

// SIMPLE HEALTH CHECK ENDPOINT
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// START THE APOLLO SERVER
startApolloServer(typeDefs, resolvers);
