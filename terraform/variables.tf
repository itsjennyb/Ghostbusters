variable "aws_region" {
  default = "us-east-1"
}

variable "aws_profile" {
  default = "cdk-ts-user"
}

variable "frontend_bucket_name" {
  default = "ghostbusters-react-front"
}

variable "lambda_function_name" {
  default = "ghostbusters-lambda"
}

variable "lambda_image_uri" {
  description = "ECR image URI for lambda container"
  default = "888178230099.dkr.ecr.us-east-1.amazonaws.com/ghostbusters-lambda@sha256:aa943ef8b9b5ccc207854f6287aeee021ae9d77520b944ede11ef82ca1e2f98a"
}