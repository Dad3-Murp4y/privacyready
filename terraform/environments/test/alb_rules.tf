resource "aws_lb_listener_rule" "scanner" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 110

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.scanner.arn
  }

  condition {
    path_pattern {
      values = ["/api/scanner/*", "/scanner/*"]
    }
  }
}


