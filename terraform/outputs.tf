output "accommodation_saleable_topic" {
  description = "ARN of SNS topic for further processing accommodation saleable units and component events"
  value       = aws_sns_topic.accommodation_saleable_topic.arn
}
