const serverlessExpress = require('@vendia/serverless-express').default;
const { createApp } = require('./app');

let serverlessHandler;

async function getServerlessHandler() {
  if (!serverlessHandler) {
    const app = await createApp();

    // Strip stage prefix (/default) so Express sees proper routes
    app.use((req, res, next) => {
      const stage = 'default';
      if (req.url.startsWith(`/${stage}`)) {
        req.url = req.url.slice(stage.length + 1); // Remove /default
      }
      next();
    });

    serverlessHandler = serverlessExpress({ app });
  }

  return serverlessHandler;
}

exports.handler = async (event, context) => {
  console.log("LAMBDA RECEIVED:", event?.requestContext?.http?.method, event?.requestContext?.http?.path);
  const handlerInstance = await getServerlessHandler();
  return handlerInstance(event, context);
};