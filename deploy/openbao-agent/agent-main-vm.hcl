# OpenBao Agent — Main App VM (VM1)
#
# Questo Agent si autentica con AppRole 'nestjs-main-app' e espone
# un proxy locale su 127.0.0.1:8200 per la Main App NestJS.
#
# Installazione:
#   cp agent-main-vm.hcl /etc/openbao/agent-main.hcl
#   echo "<role_id>" > /etc/openbao/main-role-id
#   echo "<secret_id>" > /etc/openbao/main-secret-id
#   chmod 640 /etc/openbao/main-role-id /etc/openbao/main-secret-id

vault {
  address = "https://openbao.curandis.cloud"
}

auto_auth {
  method "approle" {
    config = {
      role_id_file_path   = "/etc/openbao/main-role-id"
      secret_id_file_path = "/etc/openbao/main-secret-id"
      remove_secret_id_file_after_reading = false
    }
  }

  sink "file" {
    config = {
      path = "/var/run/openbao-agent/main-token"
      mode = 0640
    }
  }
}

cache {
  use_auto_auth_token = true
}

listener "tcp" {
  address     = "127.0.0.1:8200"
  tls_disable = true
}
