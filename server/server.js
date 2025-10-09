const { createApp, getApolloServer } = require('./app');

const PORT = process.env.PORT || 3001;

async function startServer() {
  const app = await createApp();
  const apolloServer = await getApolloServer();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API server running on port ${PORT}!`);
    console.log(`Use GraphQL at http://0.0.0.0:${PORT}${apolloServer.graphqlPath}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
};
