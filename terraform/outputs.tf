output "frontend_bucket_url" {
  value = "http://${aws_s3_bucket.frontend.bucket}.s3-website-${var.aws_region}.amazonaws.com"
}

output "api_gateway_url" {
  value = aws_apigatewayv2_api.api.api_endpoint
}

output "frontend_bucket_name_actual" {
  value = aws_s3_bucket.frontend.bucket
}

output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}