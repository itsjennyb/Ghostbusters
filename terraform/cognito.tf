# AWS Cognito User Pool for Ghostbusters authentication
resource "aws_cognito_user_pool" "main" {
  name = "ghostbusters-users-${var.environment}"

  # Allow users to sign in with email
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  # MFA configuration (optional)
  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Email verification message
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your Ghostbusters verification code"
    email_message        = "Your verification code is {####}"
  }

  # User attributes
  schema {
    attribute_data_type      = "String"
    name                     = "email"
    required                 = true
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    attribute_data_type      = "String"
    name                     = "given_name"
    required                 = false
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # Lambda triggers (optional - for custom workflows)
  # Uncomment and configure if needed
  # lambda_config {
  #   pre_sign_up = aws_lambda_function.pre_signup.arn
  # }

  tags = {
    Environment = var.environment
    Application = "Ghostbusters"
  }
}

# Cognito User Pool Client for web app
resource "aws_cognito_user_pool_client" "web" {
  name         = "ghostbusters-web-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id

  # OAuth flows
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile", "aws.cognito.signin.user.admin"]

  # Callback URLs (update these with your CloudFront URL)
  callback_urls = [
    "https://${aws_cloudfront_distribution.frontend.domain_name}/",
    "https://${aws_cloudfront_distribution.frontend.domain_name}/profile",
    "http://localhost:3000/",
    "http://localhost:3000/profile"
  ]

  logout_urls = [
    "https://${aws_cloudfront_distribution.frontend.domain_name}/",
    "http://localhost:3000/"
  ]

  # Token validity
  refresh_token_validity = 30
  access_token_validity  = 60
  id_token_validity      = 60

  token_validity_units {
    refresh_token = "days"
    access_token  = "minutes"
    id_token      = "minutes"
  }

  # Explicit auth flows
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  # Prevent user existence errors
  prevent_user_existence_errors = "ENABLED"

  # Read and write attributes
  read_attributes = [
    "email",
    "email_verified",
    "given_name",
  ]

  write_attributes = [
    "email",
    "given_name",
  ]
}

# Cognito User Pool Domain for hosted UI
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "ghostbusters-${var.environment}-${random_string.cognito_domain_suffix.result}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# Random string for unique domain suffix
resource "random_string" "cognito_domain_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Cognito Identity Pool for AWS credentials (optional, for S3 uploads etc)
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "ghostbusters_identity_pool_${var.environment}"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.web.id
    provider_name           = aws_cognito_user_pool.main.endpoint
    server_side_token_check = false
  }
}

# IAM role for authenticated users
resource "aws_iam_role" "cognito_authenticated" {
  name = "cognito-authenticated-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })
}

# Attach policy to authenticated role (for future S3 access, etc)
resource "aws_iam_role_policy" "cognito_authenticated_policy" {
  name = "cognito-authenticated-policy-${var.environment}"
  role = aws_iam_role.cognito_authenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "mobileanalytics:PutEvents",
          "cognito-sync:*",
          "cognito-identity:*"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach authenticated role to identity pool
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    authenticated = aws_iam_role.cognito_authenticated.arn
  }
}

# Outputs for frontend configuration
output "cognito_user_pool_id" {
  value       = aws_cognito_user_pool.main.id
  description = "Cognito User Pool ID"
}

output "cognito_user_pool_client_id" {
  value       = aws_cognito_user_pool_client.web.id
  description = "Cognito User Pool Client ID"
}

output "cognito_identity_pool_id" {
  value       = aws_cognito_identity_pool.main.id
  description = "Cognito Identity Pool ID"
}

output "cognito_user_pool_endpoint" {
  value       = aws_cognito_user_pool.main.endpoint
  description = "Cognito User Pool Endpoint"
}

output "cognito_domain" {
  value       = aws_cognito_user_pool_domain.main.domain
  description = "Cognito Hosted UI Domain"
}

output "cognito_hosted_ui_url" {
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
  description = "Cognito Hosted UI URL"
}
