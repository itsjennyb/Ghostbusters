const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  CreateTableCommand,
  DescribeTableCommand,
  UpdateTableCommand,
  waitUntilTableExists
} = require('@aws-sdk/client-dynamodb');

const region = process.env.AWS_REGION || 'us-east-1';
const tableName = process.env.USERS_TABLE || 'GhostbustersUsers';
const emailIndexName = process.env.USERS_EMAIL_INDEX || 'EmailIndex';

const clientConfig = { region };
if (process.env.DYNAMODB_ENDPOINT) {
  clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
}

const client = new DynamoDBClient(clientConfig);

async function createTable() {
  const params = {
    TableName: tableName,
    KeySchema: [
      { AttributeName: '_id', KeyType: 'HASH' },  // Partition key
      { AttributeName: 'sk', KeyType: 'RANGE' }   // Sort key
    ],
    AttributeDefinitions: [
      { AttributeName: '_id', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: emailIndexName,
        KeySchema: [
          { AttributeName: 'email', KeyType: 'HASH' }
        ],
        Projection: {
          ProjectionType: 'KEYS_ONLY'  // Cost-optimized: only project keys
        },
        BillingMode: 'PAY_PER_REQUEST'
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'  // Serverless billing
  };

  try {
    const command = new CreateTableCommand(params);
    const result = await client.send(command);
    console.log('✅ Table created successfully:', result.TableDescription.TableName);

    // Wait for table to be active
    console.log('⏳ Waiting for table to become active...');
    await waitUntilTableExists({ client, maxWaitTime: 300 }, { TableName: tableName });
    console.log('✅ Table is now active and ready to use');

    return result;
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log('ℹ️ Table already exists, checking if GSI needs to be added...');
      await ensureEmailIndexExists();
    } else {
      console.error('❌ Error creating table:', error);
      throw error;
    }
  }
}

async function ensureEmailIndexExists() {
  try {
    const describeCommand = new DescribeTableCommand({ TableName: tableName });
    const description = await client.send(describeCommand);

    const existingGSIs = description.Table.GlobalSecondaryIndexes || [];
    const emailIndexExists = existingGSIs.some(gsi => gsi.IndexName === emailIndexName);

    if (emailIndexExists) {
      console.log('✅ EmailIndex GSI already exists');
      return;
    }

    console.log('📝 Adding EmailIndex GSI to existing table...');

    // Add the GSI to existing table
    const updateParams = {
      TableName: tableName,
      AttributeDefinitions: [
        { AttributeName: 'email', AttributeType: 'S' }
      ],
      GlobalSecondaryIndexUpdates: [
        {
          Create: {
            IndexName: emailIndexName,
            KeySchema: [
              { AttributeName: 'email', KeyType: 'HASH' }
            ],
            Projection: {
              ProjectionType: 'KEYS_ONLY'
            },
            BillingMode: 'PAY_PER_REQUEST'
          }
        }
      ]
    };

    const updateCommand = new UpdateTableCommand(updateParams);
    await client.send(updateCommand);

    console.log('✅ EmailIndex GSI added successfully');
    console.log('⏳ GSI is being created in the background...');

  } catch (error) {
    console.error('❌ Error checking/adding EmailIndex GSI:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log(`🚀 Setting up DynamoDB table: ${tableName}`);
    console.log(`📧 Email index name: ${emailIndexName}`);
    console.log(`🌍 Region: ${region}`);

    await createTable();

    console.log('✨ DynamoDB setup completed successfully!');
    console.log('\n📋 Configuration summary:');
    console.log(`   Table Name: ${tableName}`);
    console.log(`   Email GSI: ${emailIndexName}`);
    console.log(`   Partition Key: _id (String)`);
    console.log(`   Sort Key: sk (String)`);
    console.log(`   Billing Mode: PAY_PER_REQUEST`);
    console.log('\n🎯 Next steps:');
    console.log('   1. Run migration script to convert existing data');
    console.log('   2. Update environment variables if needed');
    console.log('   3. Test the application');

  } catch (error) {
    console.error('💥 Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createTable, ensureEmailIndexExists };