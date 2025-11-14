variable "aws_region" {
  default = "us-east-1"
}

variable "aws_profile" {
  default = "cdk-ts-user"
}

# NEW — environment suffix (dev, prod, etc.)
variable "environment" {
  description = "Deployment environment (e.g., dev, staging, prod)"
  default     = "dev"
}

# Base bucket name (Terraform will append the environment)
variable "frontend_bucket_name" {
  default = "ghostbusters-react-front"
}

# Base lambda function name (Terraform will append the environment)
variable "lambda_function_name" {
  default = "ghostbusters-lambda"
}

# Existing lambda image URI (unchanged)
variable "lambda_image_uri" {
  description = "ECR image URI for lambda container"
  default = "888178230099.dkr.ecr.us-east-1.amazonaws.com/ghostbusters-lambda@sha256:aa943ef8b9b5ccc207854f6287aeee021ae9d77520b944ede11ef82ca1e2f98a"
}

