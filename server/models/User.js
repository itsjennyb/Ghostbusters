const { BatchGetCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');
const { documentClient } = require('../config/connection');

const USERS_TABLE = process.env.USERS_TABLE || 'GhostbustersUsers';
const USERS_EMAIL_INDEX = process.env.USERS_EMAIL_INDEX || 'EmailIndex';
const DEFAULT_RELATION_DEPTH = 1;


// Sort Key patterns for item collection
const SK_PATTERNS = {
  PROFILE: 'PROFILE',
  PREFERENCE: 'PREFERENCE',
  REVIEW: 'REVIEW#',
  LIKE: 'LIKE#',
  MATCH: 'MATCH#',
  DISLIKE: 'DISLIKE#'
};

function ensureUserDefaults(user) {
  if (!user) {
    return user;
  }

  const copy = { ...user };
  copy.profile = copy.profile || null;
  copy.preference = copy.preference || null;
  copy.reviews = copy.reviews || [];
  copy.likes = copy.likes || [];
  copy.matches = copy.matches || [];
  copy.dislikes = copy.dislikes || [];

  return copy;
}

// Helper to create item collection sort keys
function createSortKey(pattern, id = '') {
  return pattern + id;
}

// Helper to parse sort key to get type and id
function parseSortKey(sortKey) {
  if (!sortKey) {
    return { type: 'PROFILE', id: '' };
  }

  for (const [type, pattern] of Object.entries(SK_PATTERNS)) {
    if (sortKey.startsWith(pattern)) {
      return {
        type,
        id: sortKey.replace(pattern, '')
      };
    }
  }
  return { type: 'UNKNOWN', id: sortKey };
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...safe } = user;
  return ensureUserDefaults(safe);
}

async function saveUserRecord(user, options = {}) {
  const now = new Date().toISOString();
  const record = { ...user, updatedAt: now };
  const input = {
    TableName: USERS_TABLE,
    Item: record,
  };

  if (options.conditionExpression) {
    input.ConditionExpression = options.conditionExpression;
  }

  if (options.expressionAttributeValues) {
    input.ExpressionAttributeValues = options.expressionAttributeValues;
  }

  if (options.expressionAttributeNames) {
    input.ExpressionAttributeNames = options.expressionAttributeNames;
  }

  await documentClient.send(new PutCommand(input));
  return record;
}

// Save item in item collection pattern
async function saveItemCollectionRecord(userId, sortKey, data, options = {}) {
  const now = new Date().toISOString();
  const record = {
    _id: userId,
    sk: sortKey,
    ...data,
    updatedAt: now
  };

  const input = {
    TableName: USERS_TABLE,
    Item: record,
  };

  if (options.conditionExpression) {
    input.ConditionExpression = options.conditionExpression;
  }

  if (options.expressionAttributeValues) {
    input.ExpressionAttributeValues = options.expressionAttributeValues;
  }

  if (options.expressionAttributeNames) {
    input.ExpressionAttributeNames = options.expressionAttributeNames;
  }

  await documentClient.send(new PutCommand(input));
  return record;
}

// Get user profile only (core user data)
async function getUserProfileById(userId) {
  if (!userId) {
    return null;
  }

  const command = new GetCommand({
    TableName: USERS_TABLE,
    Key: { _id: userId, sk: SK_PATTERNS.PROFILE },
  });

  const response = await documentClient.send(command);
  return response.Item || null;
}

// Get all user data (item collection query)
async function getUserRecordById(userId) {
  if (!userId) {
    return null;
  }

  const command = new QueryCommand({
    TableName: USERS_TABLE,
    KeyConditionExpression: '#id = :userId',
    ExpressionAttributeNames: { '#id': '_id' },
    ExpressionAttributeValues: { ':userId': userId },
  });

  const response = await documentClient.send(command);
  const items = response.Items || [];

  if (items.length === 0) {
    return null;
  }

  // Reconstruct user object from item collection
  return reconstructUserFromItems(items);
}

// Helper to reconstruct user object from item collection items
function reconstructUserFromItems(items) {
  const user = {
    reviews: [],
    likes: [],
    matches: [],
    dislikes: []
  };

  for (const item of items) {
    const { type, id } = parseSortKey(item.sk);

    switch (type) {
      case 'PROFILE':
        Object.assign(user, {
          _id: item._id,
          email: item.email,
          firstName: item.firstName,
          image: item.image,
          passwordHash: item.passwordHash,
          profile: item.profile || null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        });
        break;
      case 'PREFERENCE':
        user.preference = {
          _id: item.preference_id || item._id,
          ...Object.fromEntries(
            Object.entries(item).filter(([key]) =>
              !['_id', 'sk', 'preference_id', 'updatedAt'].includes(key)
            )
          )
        };
        break;
      case 'REVIEW':
        user.reviews.push({
          _id: id,
          reviewText: item.reviewText,
          reviewer: item.reviewer,
          image: item.reviewerImage,
          reviewerId: item.reviewerId,
          createdAt: item.createdAt
        });
        break;
      case 'LIKE':
        user.likes.push(id);
        break;
      case 'MATCH':
        user.matches.push(id);
        break;
      case 'DISLIKE':
        user.dislikes.push(id);
        break;
    }
  }

  return ensureUserDefaults(user);
}

async function getUserRecordByEmail(email) {
  if (!email) {
    return null;
  }
  console.log("QUERYING EMAIL:", email); //finding bug


  try {
    // Use GSI to find user ID by email
    const command = new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: USERS_EMAIL_INDEX,
      KeyConditionExpression: '#email = :email',
      ExpressionAttributeNames: { '#email': 'email' },
      ExpressionAttributeValues: { ':email': email },
      Limit: 1,
    });

    const response = await documentClient.send(command);

    console.log("DDB RESPONSE:", response.Items); //bugging
    
    const [item] = response.Items || [];

    if (!item) {
      return null;
    }

    // Get full user record using the user ID
    return getUserRecordById(item._id);
  } catch (error) {
    console.error('Error looking up user by email:', error.message);
    return null;
  }
}

async function populateUsersByIds(ids, depth) {
  if (!ids || !ids.length) {
    return [];
  }

  const uniqueIds = Array.from(new Set(ids));
  const users = await batchGetUsers(uniqueIds);
  const userMap = new Map(users.map((user) => [user._id, user]));

  const populated = await Promise.all(ids.map(async (id) => {
    const user = userMap.get(id);

    if (!user) {
      return null;
    }

    return depth > 0 ? populateUser(user, depth) : sanitizeUser({ ...user, likes: [], matches: [], dislikes: [] });
  }));

  return populated.filter(Boolean);
}

async function batchGetUsers(ids) {
  if (!ids || !ids.length) {
    return [];
  }

  // For the item collection pattern, we need to get full user records
  // So we'll use individual getUserRecordById calls in parallel
  const userPromises = ids.map(id => getUserRecordById(id));
  const users = await Promise.all(userPromises);

  // Filter out null results and return sanitized users
  return users.filter(Boolean).map(sanitizeUser);
}

async function populateUser(user, depth = DEFAULT_RELATION_DEPTH) {
  const hydrated = sanitizeUser(user);

  if (depth <= 0) {
    return {
      ...hydrated,
      likes: [],
      matches: [],
      dislikes: [],
    };
  }

  const nextDepth = depth - 1;

  hydrated.likes = await populateUsersByIds(hydrated.likes, nextDepth);
  hydrated.matches = await populateUsersByIds(hydrated.matches, nextDepth);
  hydrated.dislikes = await populateUsersByIds(hydrated.dislikes, nextDepth);

  return hydrated;
}

async function getUserById(userId, { populate = false, depth = DEFAULT_RELATION_DEPTH } = {}) {
  const record = await getUserRecordById(userId);

  if (!record) {
    return null;
  }

  return populate ? populateUser(record, depth) : sanitizeUser(record);
}

async function getUserByEmail(email, { populate = false, depth = DEFAULT_RELATION_DEPTH } = {}) {
  const record = await getUserRecordByEmail(email);

  if (!record) {
    return null;
  }

  return populate ? populateUser(record, depth) : sanitizeUser(record);
}
/// fixing bug ///////////////////////////////////////////////
const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient();

async function getUserForAuthByEmail(email) {
    console.log("🔍 getUserForAuthByEmail called with email:", email);

  const params = {
    TableName: "GhostbustersUsers",
    IndexName: "EmailIndex",
    KeyConditionExpression: "email = :email",
    ExpressionAttributeValues: {
      ":email": email,
    },
  };

  console.log("🧾 DynamoDB query params:", JSON.stringify(params, null, 2));

  try {
    const result = await docClient.query(params).promise();
    console.log("📦 DynamoDB query result:", JSON.stringify(result.Items, null, 2));
    return result.Items?.[0] || null;
  } catch (err) {
    console.error("❌ DynamoDB query error:", err);
    return null;
  }
}

/////////////////////////////////////////////

async function listUsers({ populate = false, depth = DEFAULT_RELATION_DEPTH } = {}) {
  const command = new ScanCommand({ TableName: USERS_TABLE });
  const response = await documentClient.send(command);

  const items = response.Items || [];
  if (!items.length) {
    return [];
  }

  // Group item collection entries by user so we can rebuild full user documents
  const groupedByUserId = items.reduce((acc, item) => {
    const userId = item?._id;
    if (!userId) {
      return acc;
    }

    if (!acc[userId]) {
      acc[userId] = [];
    }

    acc[userId].push(item);
    return acc;
  }, {});

  const reconstructedUsers = Object.values(groupedByUserId)
    .map((collection) => reconstructUserFromItems(collection))
    .filter(Boolean)
    .map(sanitizeUser);

  if (!populate) {
    return reconstructedUsers;
  }

  return Promise.all(reconstructedUsers.map((user) => populateUser(user, depth)));
}

async function createUser({ email, password, firstName }) {
  const userId = randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user record
  const userRecord = {
    _id: userId,
    email,
    firstName,
    passwordHash,
    reviews: [],
    likes: [],
    matches: [],
    dislikes: [],
    profile: null,
    preference: null,
    createdAt: now,
    updatedAt: now,
  };


  // Use transaction to ensure email uniqueness and create user profile atomically
  const transactionItems = [
    {
      Put: {
        TableName: USERS_TABLE,
        Item: {
          _id: userId,
          sk: SK_PATTERNS.PROFILE,
          email,
          firstName,
          passwordHash,
          createdAt: now,
          updatedAt: now,
        },
        ConditionExpression: 'attribute_not_exists(#id) AND attribute_not_exists(#sk)',
        ExpressionAttributeNames: { '#id': '_id', '#sk': 'sk' }
      }
    }
  ];

  try {
    await documentClient.send(new TransactWriteCommand({
      TransactItems: transactionItems
    }));

    return sanitizeUser(userRecord);
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      throw new Error('A user already exists with that email.');
    }
    console.error('Error creating user:', error.message);
    throw error;
  }
}

async function setProfile(userId, profileInput) {
  const userProfile = await getUserProfileById(userId);

  if (!userProfile) {
    return null;
  }

  const profile = {
    _id: randomUUID(),
    ...profileInput,
  };

  // Update user profile record with embedded profile data
  await saveItemCollectionRecord(userId, SK_PATTERNS.PROFILE, {
    ...userProfile,
    profile
  });

  return profile;
}

async function updateProfile(userId, profileInput) {
  const userProfile = await getUserProfileById(userId);

  if (!userProfile || !userProfile.profile) {
    return null;
  }

  const profile = {
    ...userProfile.profile,
    ...profileInput,
  };

  // Update user profile record
  await saveItemCollectionRecord(userId, SK_PATTERNS.PROFILE, {
    ...userProfile,
    profile
  });

  return profile;
}

async function setPreference(userId, preferenceInput) {
  const userProfile = await getUserProfileById(userId);

  if (!userProfile) {
    return null;
  }

  const preference = {
    _id: randomUUID(),
    ...preferenceInput,
  };

  // Create separate preference item in collection
  await saveItemCollectionRecord(userId, SK_PATTERNS.PREFERENCE, {
    preference_id: preference._id,
    ...preferenceInput
  });

  return preference;
}

async function updatePreference(userId, preferenceInput) {
  // Get existing preference
  const command = new GetCommand({
    TableName: USERS_TABLE,
    Key: { _id: userId, sk: SK_PATTERNS.PREFERENCE },
  });

  const response = await documentClient.send(command);
  const existingPreference = response.Item;

  if (!existingPreference) {
    return null;
  }

  const preference = {
    _id: existingPreference.preference_id,
    ...Object.fromEntries(
      Object.entries(existingPreference).filter(([key]) =>
        !['_id', 'sk', 'preference_id', 'updatedAt'].includes(key)
      )
    ),
    ...preferenceInput,
  };

  // Update preference item
  await saveItemCollectionRecord(userId, SK_PATTERNS.PREFERENCE, {
    preference_id: preference._id,
    ...preferenceInput
  });

  return preference;
}

async function updateUserImage(userId, image) {
  const userProfile = await getUserProfileById(userId);

  if (!userProfile) {
    return null;
  }

  // Update user profile with image
  await saveItemCollectionRecord(userId, SK_PATTERNS.PROFILE, {
    ...userProfile,
    image
  });

  // Return populated user
  const updated = await getUserRecordById(userId);
  return populateUser(updated);
}

async function addReview({ targetUserId, reviewText, reviewer }) {
  const userProfile = await getUserProfileById(targetUserId);

  if (!userProfile) {
    return null;
  }

  const reviewId = randomUUID();
  const review = {
    reviewText,
    reviewer: reviewer.firstName,
    reviewerImage: reviewer.image || null,
    reviewerId: reviewer._id,
    createdAt: new Date().toISOString(),
  };

  // Add review as separate item in collection
  await saveItemCollectionRecord(targetUserId, createSortKey(SK_PATTERNS.REVIEW, reviewId), review);

  // Return populated user
  const updated = await getUserRecordById(targetUserId);
  return populateUser(updated);
}

async function addLike({ currentUserId, likedUserId }) {
  if (currentUserId === likedUserId) {
    return null;
  }

  const [likedUser, currentUser] = await Promise.all([
    getUserRecordById(likedUserId),
    getUserRecordById(currentUserId),
  ]);

  if (!likedUser || !currentUser) {
    return null;
  }

  const myId = currentUser._id;
  const likedUserLikes = new Set(likedUser.likes || []);
  const likedUserMatches = new Set(likedUser.matches || []);
  const myLikes = new Set(currentUser.likes || []);
  const myMatches = new Set(currentUser.matches || []);

  // Check if it's a mutual like (match)
  if (likedUserLikes.has(myId)) {
    // It's a match! Create match records and remove the like
    const transactionItems = [
      // Remove like from liked user
      {
        Delete: {
          TableName: USERS_TABLE,
          Key: { _id: likedUserId, sk: createSortKey(SK_PATTERNS.LIKE, myId) }
        }
      },
      // Add match to liked user
      {
        Put: {
          TableName: USERS_TABLE,
          Item: {
            _id: likedUserId,
            sk: createSortKey(SK_PATTERNS.MATCH, myId),
            matchedAt: new Date().toISOString()
          }
        }
      },
      // Add match to current user
      {
        Put: {
          TableName: USERS_TABLE,
          Item: {
            _id: currentUserId,
            sk: createSortKey(SK_PATTERNS.MATCH, likedUserId),
            matchedAt: new Date().toISOString()
          }
        }
      }
    ];

    await documentClient.send(new TransactWriteCommand({
      TransactItems: transactionItems
    }));

    return populateUser(await getUserRecordById(likedUserId));
  }

  // Just add like
  await saveItemCollectionRecord(currentUserId, createSortKey(SK_PATTERNS.LIKE, likedUserId), {
    likedAt: new Date().toISOString()
  });

  return populateUser(likedUser);
}

async function addDislike({ currentUserId, dislikedUserId }) {
  const userProfile = await getUserProfileById(currentUserId);

  if (!userProfile) {
    return null;
  }

  // Add dislike as separate item in collection
  await saveItemCollectionRecord(currentUserId, createSortKey(SK_PATTERNS.DISLIKE, dislikedUserId), {
    dislikedAt: new Date().toISOString()
  });

  const updated = await getUserRecordById(currentUserId);
  return populateUser(updated);
}

async function verifyPassword(userRecord, candidatePassword) {
  if (!userRecord || !userRecord.passwordHash) {
    return false;
  }

  return bcrypt.compare(candidatePassword, userRecord.passwordHash);
}

module.exports = {
  addDislike,
  addLike,
  addReview,
  createUser,
  getUserByEmail,
  getUserById,
  getUserForAuthByEmail,
  listUsers,
  populateUser,
  setPreference,
  setProfile,
  updatePreference,
  updateProfile,
  updateUserImage,
  verifyPassword,
};
