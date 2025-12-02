# AWS Cognito Authentication Setup

This application has been migrated from custom JWT authentication to AWS Cognito for enhanced security and features.

## Features Enabled

- Email-based authentication
- Email verification for new users
- Password reset functionality
- Optional MFA (Multi-Factor Authentication)
- Secure password policies
- Account recovery via email

## Architecture

### Backend Changes

1. **Authentication Middleware** (`server/utils/cognito-auth.js`)
   - Verifies Cognito JWT tokens using `aws-jwt-verify`
   - Extracts user information from token payload
   - Populates GraphQL context with authenticated user data

2. **User Repository** (`server/models/User.js`)
   - Added `createUserProfile` method for Cognito users
   - Uses Cognito `sub` (subject) as user ID
   - No password hashing required (handled by Cognito)

3. **GraphQL Schema Changes** (`server/schemas/`)
   - Removed `login` and `addUser` mutations
   - Added `syncUser` mutation to sync Cognito users with DynamoDB
   - All existing queries and mutations continue to work

4. **Environment Variables Required**
   ```
   COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
   COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
   AWS_REGION=us-east-1
   USERS_TABLE=GhostbustersUsers
   USERS_EMAIL_INDEX=EmailIndex
   ```

### Frontend Changes

1. **AWS Amplify Integration** (`client/src/`)
   - Installed `aws-amplify` and `@aws-amplify/ui-react`
   - Configured in `aws-config.js` and initialized in `App.js`

2. **Authentication Flow**
   - **Sign Up**: Creates user in Cognito → Email verification → Auto sign-in → Sync with DynamoDB
   - **Sign In**: Authenticates with Cognito → Gets ID token → Syncs user → Redirects to profile
   - **Sign Out**: Signs out from Cognito → Clears local storage → Redirects to login

3. **Updated Components**
   - `LoginForm.js`: Uses Cognito `signIn` API
   - `SignUpForm.js`: Uses Cognito `signUp` and `confirmSignUp` APIs
   - `auth.js`: Updated logout to sign out from Cognito

4. **Environment Variables Required**
   ```
   REACT_APP_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
   REACT_APP_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
   REACT_APP_COGNITO_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   REACT_APP_AWS_REGION=us-east-1
   REACT_APP_GRAPHQL_URI=https://your-api-id.execute-api.us-east-1.amazonaws.com/graphql
   ```

### Infrastructure (Terraform)

1. **Cognito Resources** (`terraform/cognito.tf`)
   - User Pool with email verification
   - User Pool Client for web application
   - Identity Pool for AWS credentials
   - IAM roles for authenticated users
   - Hosted UI domain (optional)

2. **Lambda Configuration** (`terraform/main.tf`)
   - Environment variables automatically injected:
     - `COGNITO_USER_POOL_ID`
     - `COGNITO_CLIENT_ID`
     - `AWS_REGION`

3. **Outputs**
   - `cognito_user_pool_id`
   - `cognito_user_pool_client_id`
   - `cognito_identity_pool_id`
   - `cognito_domain`
   - `cognito_hosted_ui_url`

## Deployment

### First Time Setup

1. **Deploy Infrastructure**
   ```bash
   cd terraform
   terraform init
   terraform apply
   ```

2. **Note Cognito Values**
   After terraform apply, save these outputs:
   - `cognito_user_pool_id`
   - `cognito_user_pool_client_id`
   - `cognito_identity_pool_id`

3. **Configure GitHub Actions**
   The workflows automatically fetch Cognito configuration from AWS.
   No manual GitHub secrets needed for Cognito.

4. **Deploy Backend**
   Push to `dev` branch - triggers `terraform.yml` workflow
   - Builds and pushes Docker image to ECR
   - Updates Lambda function
   - Applies Terraform changes

5. **Deploy Frontend**
   Push changes to `client/` - triggers `deploy-frontend.yml` workflow
   - Fetches Cognito configuration from AWS
   - Builds React app with Cognito env vars
   - Deploys to S3 and invalidates CloudFront

### Local Development

1. **Backend**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env with your Cognito values
   npm install
   npm run develop
   ```

2. **Frontend**
   ```bash
   cd client
   cp .env.example .env.local
   # Edit .env.local with your Cognito values
   npm install
   npm start
   ```

## User Migration

This implementation starts fresh with no user migration from the old JWT system.

**For Future Migration:**
If you need to migrate existing users:
1. Use Cognito User Import (CSV or API)
2. Users will need to reset passwords
3. Or use Cognito User Migration Lambda trigger

## Password Policy

Configured in `terraform/cognito.tf`:
- Minimum length: 8 characters
- Requires: lowercase, uppercase, numbers, symbols
- Temporary password validity: 7 days

## MFA Configuration

Currently set to `OPTIONAL`:
- Users can enable TOTP (Google Authenticator, etc.)
- Can be changed to `REQUIRED` in `cognito.tf`

## Testing

### Test Sign Up Flow
1. Go to https://your-cloudfront-url.cloudfront.net
2. Click "Sign Up"
3. Enter first name, email, password
4. Check email for verification code
5. Enter code to verify
6. Should auto-sign in and redirect to create profile

### Test Sign In Flow
1. Click "Log In"
2. Enter email and password
3. Should redirect to /profile

### Test Sign Out
1. Click logout button in app
2. Should clear session and redirect to login

## Troubleshooting

### "User is not authorized" Errors
- Check Lambda environment variables are set
- Verify Cognito User Pool ID and Client ID match in Lambda
- Check CloudWatch logs for token verification errors

### Email Verification Not Working
- Check SES configuration if using custom email
- Verify email addresses are correct
- Check spam folder

### CORS Errors
- Ensure callback URLs in Cognito client include your CloudFront URL
- Verify API Gateway CORS configuration

### Token Expired Errors
- Token validity is 60 minutes (access/id tokens)
- Refresh tokens valid for 30 days
- Users will need to re-authenticate after expiry

## Security Best Practices

✅ Tokens verified on every GraphQL request
✅ Passwords never stored in database
✅ Email verification required for new accounts
✅ Strong password policy enforced
✅ MFA available for enhanced security
✅ Tokens have expiration times
✅ HTTPS required for all Cognito operations

## Resources

- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [Cognito User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [aws-jwt-verify](https://github.com/awslabs/aws-jwt-verify)
