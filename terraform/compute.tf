resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project}-redis-subnets-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_security_group" "redis" {
  name        = "${var.project}-redis-sg-${var.environment}"
  description = "Allow Redis from app services"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${var.project}-redis-${var.environment}"
  engine               = "redis"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]
}

resource "aws_security_group" "app" {
  name        = "${var.project}-app-sg-${var.environment}"
  description = "API, AI worker, and test worker"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 5000
    to_port     = 5000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_cluster" "main" {
  name = "${var.project}-${var.environment}"
}

resource "aws_iam_role" "ecs_task" {
  name = "${var.project}-ecs-task-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project}-api-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_task.arn
  container_definitions = jsonencode([{
    name  = "api"
    image = var.api_image
    portMappings = [{ containerPort = 5000, protocol = "tcp" }]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "5000" }
    ]
    essential = true
  }])
}

resource "aws_ecs_task_definition" "ai_worker" {
  family                   = "${var.project}-ai-worker-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.ecs_task.arn
  container_definitions = jsonencode([{
    name      = "ai-worker"
    image     = var.ai_worker_image
    essential = true
    command   = ["node", "dist/workers/aiWorker.js"]
  }])
}

resource "aws_ecs_task_definition" "test_worker" {
  family                   = "${var.project}-test-worker-${var.environment}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.ecs_task.arn
  container_definitions = jsonencode([{
    name      = "test-worker"
    image     = var.test_worker_image
    essential = true
  }])
}

resource "aws_ecs_service" "api" {
  name            = "${var.project}-api-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_count
  launch_type     = "FARGATE"
  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }
}

output "redis_endpoint" { value = aws_elasticache_cluster.redis.cache_nodes[0].address }
output "ecs_cluster" { value = aws_ecs_cluster.main.name }
