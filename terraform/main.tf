resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "random_id" "api_suffix" {
  byte_length = 4
}

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Configure the AWS Provider
provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "frontend" {
  bucket = "${var.frontend_bucket_name}-${var.environment}-${random_id.bucket_suffix.hex}"
  force_destroy = true
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

# TEMP BLOCKED DUE TO BLOCKED PUBLIC ACCESS
# resource "aws_s3_bucket_policy" "frontend" {
#   bucket = aws_s3_bucket.frontend.id

#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Sid = "PublicReadGetObject"
#         Effect = "Allow"
#         Principal = "*"
#         Action = "s3:GetObject"
#         Resource = "${aws_s3_bucket.frontend.arn}/*"
#       }
#     ]
#   })
# }

resource "aws_s3_object" "frontend_assets" {
  for_each = fileset("../client/build", "**/*.*")

  bucket = aws_s3_bucket.frontend.id
  key    = each.value
  source = "../client/build/${each.value}"
  etag   = filemd5("../client/build/${each.value}")
  content_type = lookup({
    "html" = "text/html"
    "js"   = "application/javascript"
    "css"  = "text/css"
    "json" = "application/json"
    "png"  = "image/png"
    "jpg"  = "image/jpeg"
    "svg"  = "image/svg+xml"
  }, split(".", each.value)[length(split(".", each.value)) - 1], "application/octet-stream")
}

resource "aws_iam_role" "lambda_exec" {
  name = "lambda_exec_role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "backend" {
  function_name = "${var.lambda_function_name}-${var.environment}"
  role          = aws_iam_role.lambda_exec.arn
  package_type  = "Image"
  image_uri     = "888178230099.dkr.ecr.us-east-1.amazonaws.com/ghostbusters-lambda@sha256:aa943ef8b9b5ccc207854f6287aeee021ae9d77520b944ede11ef82ca1e2f98a"
  timeout       = 10
}

resource "aws_apigatewayv2_api" "api" {
  name          = "ghostbusters-lambda-API-${var.environment}-${random_id.suffix.hex}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id             = aws_apigatewayv2_api.api.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.backend.invoke_arn
  integration_method = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /graphql"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke-${var.environment}-${random_id.api_suffix.hex}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}