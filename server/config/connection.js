const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { fromIni } = require('@aws-sdk/credential-providers');

const region = process.env.AWS_REGION || 'us-east-1';

const clientConfig = { region };

// Use dynamo-mcp profile in development
if (process.env.NODE_ENV !== 'production') {
  clientConfig.credentials = fromIni({ profile: 'default' });
}

if (process.env.DYNAMODB_ENDPOINT) {
  clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
}

const dynamoClient = new DynamoDBClient(clientConfig);

const documentClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});

module.exports = {
  dynamoClient,
  documentClient,
};
