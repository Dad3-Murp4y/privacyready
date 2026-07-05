package app.access

default allow := false

allow {
  input.user.tenant_id == input.resource.tenant_id
  input.resource.action == "read"
}

allow {
  input.user.is_platform_admin == true
}
