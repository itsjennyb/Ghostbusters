const { default: serverlessExpress } = require('@vendia/serverless-express');
const { createApp } = require('./app');

let serverlessHandler;

async function getServerlessHandler() {
  if (!serverlessHandler) {
    const app = await createApp();

    app.use((req, res, next) => {
      if (req.url.startsWith('/default')) {
        req.url = req.url.replace('/default', '');
      }
      next();
    });

    serverlessHandler = serverlessExpress({ app });
  }

  return serverlessHandler;
}

exports.handler = async (event, context) => {
  console.log(
    "LAMBDA RECEIVED:",
    event.requestContext?.http?.method || event.httpMethod,
    event.requestContext?.http?.path || event.path
  );

  const handlerInstance = await getServerlessHandler();
  return handlerInstance(event, context);
};