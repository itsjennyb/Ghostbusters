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

exports.handler = async (event, context) => {
  const handlerInstance = await getServerlessHandler();
  return handlerInstance(event, context);
};
