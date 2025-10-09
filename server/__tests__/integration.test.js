jest.mock('../config/connection', () => {
  const send = jest.fn().mockResolvedValue({});
  return {
    dynamoClient: { send },
    documentClient: { send },
  };
});

const { createApp } = require('../app');
const { handler } = require('../lambda');

async function callLambda(event) {
  const response = await handler(event, {});
  return {
    statusCode: response.statusCode,
    body: response.body,
    headers: response.headers || {},
  };
}

describe('Express/Lambda bridge', () => {
  beforeAll(async () => {
    await createApp();
  });

  it('returns OK for /healthz via Lambda', async () => {
    const { statusCode, body, headers } = await callLambda({
      httpMethod: 'GET',
      path: '/healthz',
      resource: '/healthz',
      requestContext: {
        httpMethod: 'GET',
        path: '/healthz',
      },
      headers: {},
      queryStringParameters: null,
      pathParameters: null,
      body: null,
      isBase64Encoded: false,
    });

    expect(statusCode).toBe(200);
    expect(body).toBe('OK');
    expect(headers).toBeDefined();
  });

  it('falls back to JSON status when client bundle absent', async () => {
    const { statusCode, body } = await callLambda({
      httpMethod: 'GET',
      path: '/',
      resource: '/',
      requestContext: {
        httpMethod: 'GET',
        path: '/',
      },
      headers: {},
      queryStringParameters: null,
      pathParameters: null,
      body: null,
      isBase64Encoded: false,
    });

    expect(statusCode).toBe(200);
    expect(JSON.parse(body)).toEqual({ status: 'ok' });
  });
});
