const { AuthenticationError } = require('apollo-server-express');
const UserRepository = require('../models/User');
const { signToken } = require('../utils/auth');

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

    login: async (parent, args) => {
      console.log("LOGIN ATTEMPT:", args.email); //added to find bug
      const userForAuth = await UserRepository.getUserForAuthByEmail(args.email);
      console.log("USER LOOKUP RESULTS:", userForAuth); //added to find bug

      if (!userForAuth) {
        throw new AuthenticationError('User not found by that email.');
      }

      const correctPw = await UserRepository.verifyPassword(userForAuth, args.password);

      if (!correctPw) {
        throw new AuthenticationError('Incorrect password.');
      }

      const user = await UserRepository.getUserById(userForAuth._id, { populate: true });
      const token = signToken(user);

      return { token, user, me: user };
    },

    addUser: async (parent, args) => {
      const user = await UserRepository.createUser(args);
      const hydratedUser = await UserRepository.getUserById(user._id, { populate: true });
      const token = signToken(hydratedUser);

      return { token, user: hydratedUser, me: hydratedUser };
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
