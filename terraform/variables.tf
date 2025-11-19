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

# ECR repository URL for lambda container
variable "ecr_repository_url" {
  description = "ECR repository URL for lambda container (without tag)"
  default = "888178230099.dkr.ecr.us-east-1.amazonaws.com/ghostbusters-lambda"
}

