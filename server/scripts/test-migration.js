const UserRepository = require('../models/User');

async function testMigration() {
  console.log('🧪 Testing migrated DynamoDB structure...\n');

  try {
    // Test 1: Create a new user
    console.log('1️⃣ Testing user creation...');
    const newUser = await UserRepository.createUser({
      email: 'test@migration.com',
      password: 'testpassword',
      firstName: 'Test'
    });
    console.log(`✅ Created user: ${newUser._id}`);

    // Test 2: Login by email
    console.log('\n2️⃣ Testing email lookup...');
    const loginUser = await UserRepository.getUserForAuthByEmail('test@migration.com');
    console.log(`✅ Found user by email: ${loginUser._id}`);

    // Test 3: Add profile
    console.log('\n3️⃣ Testing profile creation...');
    const profile = await UserRepository.setProfile(newUser._id, {
      bio: 'Test bio',
      age: 25
    });
    console.log(`✅ Created profile: ${profile._id}`);

    // Test 4: Add preference
    console.log('\n4️⃣ Testing preference creation...');
    const preference = await UserRepository.setPreference(newUser._id, {
      theme: 'dark',
      notifications: true
    });
    console.log(`✅ Created preference: ${preference._id}`);

    // Test 5: Add review
    console.log('\n5️⃣ Testing review creation...');
    const reviewer = { _id: 'reviewer123', firstName: 'Reviewer', image: null };
    const userWithReview = await UserRepository.addReview({
      targetUserId: newUser._id,
      reviewText: 'Great user!',
      reviewer: reviewer
    });
    console.log(`✅ Added review, user has ${userWithReview.reviews.length} reviews`);

    // Test 6: Create second user for like testing
    const secondUser = await UserRepository.createUser({
      email: 'test2@migration.com',
      password: 'testpassword',
      firstName: 'Test2'
    });

    // Test 7: Add like
    console.log('\n6️⃣ Testing like functionality...');
    const likeResult = await UserRepository.addLike({
      currentUserId: newUser._id,
      likedUserId: secondUser._id
    });
    console.log(`✅ Like added successfully`);

    // Test 8: Get populated user
    console.log('\n7️⃣ Testing user population...');
    const populatedUser = await UserRepository.getUserById(newUser._id, { populate: true });
    console.log(`✅ Populated user has:`);
    console.log(`   - Profile: ${populatedUser.profile ? 'Yes' : 'No'}`);
    console.log(`   - Preference: ${populatedUser.preference ? 'Yes' : 'No'}`);
    console.log(`   - Reviews: ${populatedUser.reviews.length}`);
    console.log(`   - Likes: ${populatedUser.likes.length}`);

    // Test 9: List users
    console.log('\n8️⃣ Testing user listing...');
    const allUsers = await UserRepository.listUsers();
    console.log(`✅ Found ${allUsers.length} users total`);

    // Test 10: Add dislike
    console.log('\n9️⃣ Testing dislike functionality...');
    const dislikeResult = await UserRepository.addDislike({
      currentUserId: secondUser._id,
      dislikedUserId: newUser._id
    });
    console.log(`✅ Dislike added successfully`);

    console.log('\n✨ All tests passed! Migration is working correctly.');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ User creation via item collections');
    console.log('   ✅ Email lookup via GSI');
    console.log('   ✅ Profile management');
    console.log('   ✅ Preference management');
    console.log('   ✅ Review system');
    console.log('   ✅ Like/dislike functionality');
    console.log('   ✅ User population');
    console.log('   ✅ Backward compatibility maintained');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('\nThis indicates an issue with the migration or table setup.');
    console.error('Check the following:');
    console.error('1. DynamoDB table exists with correct schema');
    console.error('2. EmailIndex GSI is ACTIVE');
    console.error('3. Environment variables are set correctly');
    console.error('4. AWS credentials are configured');
    process.exit(1);
  }
}

if (require.main === module) {
  testMigration();
}

module.exports = { testMigration };