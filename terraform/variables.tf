variable "project" {
  description = "Project name prefix for all resources"
  type        = string
  default     = "testflow"
}

variable "environment" {
  description = "Deployment environment (development | staging | production)"
  type        = string
  default     = "production"
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

# ─── Database ─────────────────────────────────────────────────────────────────
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Initial RDS storage in GB"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "testflow"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "testflow_admin"
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "api_image" {
  type    = string
  default = "testflow/api:latest"
}

variable "ai_worker_image" {
  type    = string
  default = "testflow/ai-worker:latest"
}

variable "test_worker_image" {
  type    = string
  default = "testflow/test-worker:latest"
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "worker_cpu" {
  type    = number
  default = 1024
}

variable "worker_memory" {
  type    = number
  default = 2048
}

variable "api_count" {
  type    = number
  default = 1
}
