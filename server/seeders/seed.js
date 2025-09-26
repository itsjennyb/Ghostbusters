const { DeleteCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { documentClient } = require('../config/connection');
const UserRepository = require('../models/User');
const userSeeds = require('./userSeeds.json');

const USERS_TABLE = process.env.USERS_TABLE || 'GhostbustersUsers';

async function clearUsers() {
  const scan = await documentClient.send(new ScanCommand({ TableName: USERS_TABLE }));
  const items = scan.Items || [];

  for (const item of items) {
    await documentClient.send(
      new DeleteCommand({
        TableName: USERS_TABLE,
        Key: { _id: item._id, sk: item.sk || item._id }, // Handle both old and new format
      })
    );
  }
}

async function seedUsers() {
  for (const seed of userSeeds) {
    const { email, password, firstName, image, reviews } = seed;

    const user = await UserRepository.createUser({ email, password, firstName });

    if (image) {
      await UserRepository.updateUserImage(user._id, image);
    }

    if (Array.isArray(reviews)) {
      for (const review of reviews) {
        if (!review.reviewText) {
          continue;
        }

        await UserRepository.addReview({
          targetUserId: user._id,
          reviewText: review.reviewText,
          reviewer: {
            _id: 'seed-script',
            firstName: review.firstName || 'Anonymous',
            image: review.image || null,
          },
        });
      }
    }
  }
}

(async () => {
  try {
    await clearUsers();
    await seedUsers();
    console.log('DynamoDB seed completed.');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
