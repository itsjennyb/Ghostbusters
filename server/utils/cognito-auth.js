const { CognitoJwtVerifier } = require('aws-jwt-verify');

// Environment variables will be set after Terraform creates Cognito
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID;
const region = process.env.AWS_REGION || 'us-east-1';

// Create verifier for access tokens
const verifier = userPoolId && clientId ? CognitoJwtVerifier.create({
  userPoolId,
  tokenUse: 'access',
  clientId,
}) : null;

// Create verifier for ID tokens (contains user info)
const idTokenVerifier = userPoolId && clientId ? CognitoJwtVerifier.create({
  userPoolId,
  tokenUse: 'id',
  clientId,
}) : null;

module.exports = {
  authMiddleware: async function ({ req }) {
    let token = req.body.token || req.query.token || req.headers.authorization;

    if (req.headers.authorization) {
      token = token.split(' ').pop().trim();
    }

    let user = null;

    if (token && verifier && idTokenVerifier) {
      try {
        // Try to verify as ID token first (has user info)
        let payload;
        try {
          payload = await idTokenVerifier.verify(token);
        } catch (idErr) {
          // If not ID token, try access token
          payload = await verifier.verify(token);
        }

        // Extract user info from token
        user = {
          _id: payload.sub, // Cognito user ID (sub)
          email: payload.email,
          firstName: payload.given_name || payload.name || payload.email?.split('@')[0],
          cognitoUsername: payload['cognito:username'],
        };
      } catch (err) {
        console.log('Invalid Cognito token:', err.message);
      }
    } else if (token) {
      console.log('Cognito not configured - set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID');
    }

    // Return context with user
    return { user };
  },
};
