const serverlessExpress = require('@vendia/serverless-express');
const { createApp } = require('./app');

let serverlessHandler;

async function getServerlessHandler() {
  if (!serverlessHandler) {
    const app = await createApp();
    serverlessHandler = serverlessExpress({ app });
  }

  return serverlessHandler;
}

async function handler(event, context) {
  const handlerInstance = await getServerlessHandler();
  return handlerInstance(event, context);
}

module.exports = {
  getServerlessHandler,
  handler,
};
