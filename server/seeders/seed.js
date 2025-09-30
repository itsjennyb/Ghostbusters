const { DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { documentClient } = require('../config/connection');
const UserRepository = require('../models/User');
const userSeeds = require('./userSeeds.json');

const USERS_TABLE = process.env.USERS_TABLE || 'GhostbustersUsers';

async function clearUsers() {
  let lastEvaluatedKey;

  do {
    const { Items = [], LastEvaluatedKey } = await documentClient.send(
      new ScanCommand({
        TableName: USERS_TABLE,
        ExclusiveStartKey: lastEvaluatedKey,
        ProjectionExpression: '#id, sk',
        ExpressionAttributeNames: { '#id': '_id' },
      })
    );

    if (Items.length) {
      await Promise.all(
        Items.map((item) => {
          const key = { _id: item._id };
          if (typeof item.sk !== 'undefined') {
            key.sk = item.sk;
          }
          return documentClient.send(
            new DeleteCommand({
              TableName: USERS_TABLE,
              Key: key,
            })
          );
        })
      );
    }

    lastEvaluatedKey = LastEvaluatedKey;
  } while (lastEvaluatedKey);
}

async function seedUsers() {
  const createdUsers = new Map();

  for (const seed of userSeeds) {
    const { email, password, firstName, image, profile, preference } = seed;

    const user = await UserRepository.createUser({ email, password, firstName });

    if (profile) {
      await UserRepository.setProfile(user._id, profile);
    }

    if (preference) {
      await UserRepository.setPreference(user._id, preference);
    }

    if (image) {
      await UserRepository.updateUserImage(user._id, image);
    }

    const hydrated = await UserRepository.getUserById(user._id, { populate: true });
    createdUsers.set(email, hydrated);
  }

  for (const seed of userSeeds) {
    const targetUser = createdUsers.get(seed.email);
    if (!targetUser) {
      continue;
    }

    if (Array.isArray(seed.reviews)) {
      for (const review of seed.reviews) {
        if (!review.reviewText) {
          continue;
        }

        const reviewerSource = review.reviewerEmail
          ? createdUsers.get(review.reviewerEmail)
          : null;

        const reviewer = reviewerSource
          ? {
              _id: reviewerSource._id,
              firstName: reviewerSource.firstName,
              image: reviewerSource.image || null,
            }
          : {
              _id: 'seed-script',
              firstName: review.firstName || 'Anonymous',
              image: review.image || null,
            };

        await UserRepository.addReview({
          targetUserId: targetUser._id,
          reviewText: review.reviewText,
          reviewer,
        });
      }
    }

    if (Array.isArray(seed.likes)) {
      for (const likedEmail of seed.likes) {
        const likedUser = createdUsers.get(likedEmail);
        if (!likedUser) {
          continue;
        }

        await UserRepository.addLike({
          currentUserId: targetUser._id,
          likedUserId: likedUser._id,
        });
      }
    }

    if (Array.isArray(seed.dislikes)) {
      for (const dislikedEmail of seed.dislikes) {
        const dislikedUser = createdUsers.get(dislikedEmail);
        if (!dislikedUser) {
          continue;
        }

        await UserRepository.addDislike({
          currentUserId: targetUser._id,
          dislikedUserId: dislikedUser._id,
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
