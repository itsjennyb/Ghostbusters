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
  console.log("LAMBDA RECEIVED:", event.requestContext?.http?.method, event.requestContext?.http?.path);
  try {
    const handlerInstance = await getServerlessHandler();
    return await handlerInstance(event, context);
  } catch (err) {
    console.error("🔥 UNCAUGHT ERROR IN LAMBDA:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error", detail: err.message }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*'
      }
    };
  }
};