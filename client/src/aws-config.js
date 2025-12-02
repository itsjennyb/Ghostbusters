const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID,
      userPoolClientId: process.env.REACT_APP_COGNITO_CLIENT_ID,
      identityPoolId: process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID,
      region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
      loginWith: {
        email: true,
      },
    },
  },
};

export default awsConfig;
