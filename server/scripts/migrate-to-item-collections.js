const { ScanCommand, PutCommand, DeleteCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { documentClient } = require('../config/connection');

const USERS_TABLE = process.env.USERS_TABLE || 'GhostbustersUsers';
const BATCH_SIZE = 25; // DynamoDB batch limit

// Sort Key patterns
const SK_PATTERNS = {
  PROFILE: 'PROFILE',
  PREFERENCE: 'PREFERENCE',
  REVIEW: 'REVIEW#',
  LIKE: 'LIKE#',
  MATCH: 'MATCH#',
  DISLIKE: 'DISLIKE#'
};

function createSortKey(pattern, id = '') {
  return pattern + id;
}

async function scanAllUsers() {
  const users = [];
  let lastEvaluatedKey = null;

  do {
    const params = {
      TableName: USERS_TABLE,
      ExclusiveStartKey: lastEvaluatedKey
    };

    const response = await documentClient.send(new ScanCommand(params));

    // Filter to only get old format users (those without 'sk' attribute)
    const oldFormatUsers = (response.Items || []).filter(item => !item.sk);
    users.push(...oldFormatUsers);

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return users;
}

function convertUserToItemCollection(user) {
  const items = [];
  const userId = user._id;

  // 1. Create profile item
  const profileItem = {
    _id: userId,
    sk: SK_PATTERNS.PROFILE,
    email: user.email,
    firstName: user.firstName,
    passwordHash: user.passwordHash,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };

  // Add image if it exists
  if (user.image) {
    profileItem.image = user.image;
  }

  // Add embedded profile if it exists
  if (user.profile) {
    profileItem.profile = user.profile;
  }

  items.push(profileItem);

  // 2. Create preference item if it exists
  if (user.preference) {
    items.push({
      _id: userId,
      sk: SK_PATTERNS.PREFERENCE,
      preference_id: user.preference._id,
      ...Object.fromEntries(
        Object.entries(user.preference).filter(([key]) => key !== '_id')
      ),
      updatedAt: user.updatedAt
    });
  }

  // 3. Convert reviews array to individual items
  if (user.reviews && Array.isArray(user.reviews)) {
    for (const review of user.reviews) {
      items.push({
        _id: userId,
        sk: createSortKey(SK_PATTERNS.REVIEW, review._id),
        reviewText: review.reviewText,
        reviewer: review.reviewer,
        reviewerImage: review.image,
        reviewerId: review.reviewerId,
        createdAt: review.createdAt,
        updatedAt: user.updatedAt
      });
    }
  }

  // 4. Convert likes array to individual items
  if (user.likes && Array.isArray(user.likes)) {
    for (const likedUserId of user.likes) {
      items.push({
        _id: userId,
        sk: createSortKey(SK_PATTERNS.LIKE, likedUserId),
        likedAt: user.updatedAt,
        updatedAt: user.updatedAt
      });
    }
  }

  // 5. Convert matches array to individual items
  if (user.matches && Array.isArray(user.matches)) {
    for (const matchedUserId of user.matches) {
      items.push({
        _id: userId,
        sk: createSortKey(SK_PATTERNS.MATCH, matchedUserId),
        matchedAt: user.updatedAt,
        updatedAt: user.updatedAt
      });
    }
  }

  // 6. Convert dislikes array to individual items
  if (user.dislikes && Array.isArray(user.dislikes)) {
    for (const dislikedUserId of user.dislikes) {
      items.push({
        _id: userId,
        sk: createSortKey(SK_PATTERNS.DISLIKE, dislikedUserId),
        dislikedAt: user.updatedAt,
        updatedAt: user.updatedAt
      });
    }
  }

  return items;
}

async function batchWrite(items) {
  const chunks = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    chunks.push(items.slice(i, i + BATCH_SIZE));
  }

  for (const chunk of chunks) {
    const requestItems = {
      [USERS_TABLE]: chunk.map(item => ({
        PutRequest: { Item: item }
      }))
    };

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const response = await documentClient.send(new BatchWriteCommand({
          RequestItems: requestItems
        }));

        // Handle unprocessed items
        if (response.UnprocessedItems && Object.keys(response.UnprocessedItems).length > 0) {
          console.log(`⚠️ Retrying ${Object.keys(response.UnprocessedItems[USERS_TABLE] || {}).length} unprocessed items...`);
          requestItems[USERS_TABLE] = response.UnprocessedItems[USERS_TABLE];
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100)); // Exponential backoff
        } else {
          break; // Success
        }
      } catch (error) {
        console.error('❌ Batch write error:', error);
        retryCount++;
        if (retryCount >= maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 100));
      }
    }
  }
}

async function deleteOldUserRecord(userId) {
  try {
    await documentClient.send(new DeleteCommand({
      TableName: USERS_TABLE,
      Key: { _id: userId }
    }));
  } catch (error) {
    console.error(`❌ Error deleting old user record ${userId}:`, error);
  }
}

async function migrateUser(user) {
  try {
    console.log(`🔄 Migrating user: ${user._id} (${user.email})`);

    // Convert user to item collection format
    const items = convertUserToItemCollection(user);

    console.log(`  📝 Creating ${items.length} items for user`);

    // Write new format items
    await batchWrite(items);

    // Delete old format user record
    await deleteOldUserRecord(user._id);

    console.log(`  ✅ Successfully migrated user ${user._id}`);

    return {
      success: true,
      userId: user._id,
      itemsCreated: items.length
    };
  } catch (error) {
    console.error(`  ❌ Failed to migrate user ${user._id}:`, error);
    return {
      success: false,
      userId: user._id,
      error: error.message
    };
  }
}

async function main() {
  try {
    console.log('🚀 Starting migration to item collection pattern...');
    console.log(`📊 Table: ${USERS_TABLE}`);

    // Get all users in old format
    console.log('🔍 Scanning for users in old format...');
    const users = await scanAllUsers();

    if (users.length === 0) {
      console.log('✨ No users found in old format. Migration not needed.');
      return;
    }

    console.log(`📋 Found ${users.length} users to migrate`);

    // Migrate users one by one to handle errors gracefully
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      const result = await migrateUser(user);
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }

      // Add small delay to avoid overwhelming DynamoDB
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successful: ${successCount} users`);
    console.log(`   ❌ Failed: ${errorCount} users`);
    console.log(`   📈 Total items created: ${results.filter(r => r.success).reduce((sum, r) => sum + r.itemsCreated, 0)}`);

    if (errorCount > 0) {
      console.log('\n❌ Failed migrations:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.userId}: ${r.error}`);
      });
    }

    console.log('\n✨ Migration completed!');

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  convertUserToItemCollection,
  migrateUser,
  scanAllUsers
};