# OpenBao Agent — Auth Service VM (VM2)
#
# Questo Agent si autentica con AppRole 'nestjs-app' e espone
# un proxy locale su 127.0.0.1:8100 per l'Auth Service NestJS.
# Porta 8100 per evitare conflitto con OpenBao Server sulla stessa VM.
#
# Installazione:
#   cp agent-auth-vm.hcl /etc/openbao/agent-auth.hcl
#   echo "<role_id>" > /etc/openbao/auth-role-id
#   echo "<secret_id>" > /etc/openbao/auth-secret-id
#   chmod 640 /etc/openbao/auth-role-id /etc/openbao/auth-secret-id

vault {
  address = "https://openbao.curandis.cloud"
}

auto_auth {
  method "approle" {
    config = {
      role_id_file_path   = "/etc/openbao/auth-role-id"
      secret_id_file_path = "/etc/openbao/auth-secret-id"
      remove_secret_id_file_after_reading = false
    }
  }

  sink "file" {
    config = {
      path = "/var/run/openbao-agent/auth-token"
      mode = 0640
    }
  }
}

cache {
  use_auto_auth_token = true
}

listener "tcp" {
  address     = "127.0.0.1:8100"
  tls_disable = true
}
