const { AuthenticationError } = require('apollo-server-express');
const UserRepository = require('../models/User');

const resolvers = {

  Query: {
    getImage: async (parent, args, context) => {
      if (!context.user) {
        throw new AuthenticationError('You must be logged in.');
      }

      return UserRepository.getUserById(context.user._id);
    },
    me: async (parent, args, context) => {
      if (!context.user) {
        throw new AuthenticationError('You must be logged in.');
      }

      return UserRepository.getUserById(context.user._id, { populate: true });
    },
    users: async () => {
      return UserRepository.listUsers({ populate: true });
    },
    user: async (parent, { userId }) => {
      return UserRepository.getUserById(userId, { populate: true });
    },
  },

  Mutation: {

    // Sync Cognito user with DynamoDB profile
    syncUser: async (parent, args, context) => {
      if (!context.user) {
        throw new AuthenticationError('You must be logged in.');
      }

      // Check if user exists in DynamoDB
      try {
        const existingUser = await UserRepository.getUserById(context.user._id, { populate: false });
        if (existingUser) {
          return existingUser;
        }
      } catch (err) {
        // User doesn't exist, create new profile
      }

      // Create new user profile with Cognito data
      const newUser = {
        _id: context.user._id, // Use Cognito sub as user ID
        email: context.user.email,
        firstName: args.firstName || context.user.firstName,
      };

      // Save to DynamoDB
      await UserRepository.createUserProfile(newUser);

      return await UserRepository.getUserById(context.user._id, { populate: true });
    },

    addProfile: async (parent, args, context) => {
      if (context.user) {
        const profile = await UserRepository.setProfile(context.user._id, args.profile);
        return profile;
      }
      throw new AuthenticationError('You must be logged in.');
    },

    editProfile: async (parent, args, context) => {
      if (context.user) {
        const profile = await UserRepository.updateProfile(context.user._id, args.profile);
        return profile;
      }
      throw new AuthenticationError('You must be logged in.');
    },

    addPreference: async (parent, args, context) => {
      if (context.user) {
        const preference = await UserRepository.setPreference(context.user._id, args.preference);
        return preference;
      }
      throw new AuthenticationError('You must be logged in.');
    },

    editPreference: async (parent, args, context) => {
      if (context.user) {
        const preference = await UserRepository.updatePreference(context.user._id, args.preference);
        return preference;
      }
      throw new AuthenticationError('You must be logged in.');
    },

    addReview: async (parent, { userId, reviewText }, context) => {
      if (context.user) {
        return UserRepository.addReview({
          targetUserId: userId,
          reviewText,
          reviewer: context.user,
        });
      }
      throw new AuthenticationError('You must be logged in.');
    },

    uploadImage: async (parent, args, context) => {
      if (!context.user) {
        throw new AuthenticationError('You must be logged in.');
      }
      const newImage = args.image;
      return UserRepository.updateUserImage(context.user._id, newImage);
    },
    addLike: async (parent, args, context) => {
      if (!context.user) {
        throw new AuthenticationError('You must be logged in.')
      }
      return UserRepository.addLike({
        currentUserId: context.user._id,
        likedUserId: args.userId,
      });
    },

    addDislike: async (parent, args, context) => {
      if (!context.user) {
        throw new AuthenticationError('You must be logged in.')
      }
      return UserRepository.addDislike({
        currentUserId: context.user._id,
        dislikedUserId: args.userId,
      });
    }
  },
};

module.exports = resolvers;
