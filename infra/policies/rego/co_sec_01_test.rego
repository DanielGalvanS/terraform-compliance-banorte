package main

recurso_con(tipo, despues) := {"resource_changes": [{
	"address": sprintf("%s.prueba", [tipo]),
	"type": tipo,
	"change": {"actions": ["create"], "after": despues},
}]}

test_rechaza_contrasena_de_usuario_sql if {
	entrada := recurso_con("google_sql_user", {
		"name": "app",
		"password": "cualquier-cosa-aqui",
	})
	count(mensajes_de("CO-SEC-01")) == 1 with input as entrada
}

test_rechaza_version_de_secreto_con_contenido if {
	entrada := recurso_con("google_secret_manager_secret_version", {
		"secret": "contrasena-sql",
		"secret_data": "valor-en-claro",
	})
	count(mensajes_de("CO-SEC-01")) == 1 with input as entrada
}

test_rechaza_llave_de_cuenta_de_servicio if {
	entrada := recurso_con("google_service_account_key", {
		"private_key": "-----BEGIN PRIVATE KEY-----",
	})
	count(mensajes_de("CO-SEC-01")) == 1 with input as entrada
}

# Ocultar el valor no lo quita del estado.
test_rechaza_valor_marcado_como_sensible if {
	entrada := {"resource_changes": [{
		"address": "google_sql_user.prueba",
		"type": "google_sql_user",
		"change": {
			"actions": ["create"],
			"after": {"name": "app"},
			"after_sensitive": {"password": true},
		},
	}]}
	count(mensajes_de("CO-SEC-01")) == 1 with input as entrada
}

test_permite_usuario_sin_contrasena if {
	entrada := recurso_con("google_sql_user", {"name": "app", "type": "CLOUD_IAM_USER"})
	count(mensajes_de("CO-SEC-01")) == 0 with input as entrada
}

# El contenedor del secreto es correcto; lo que no debe declararse es su valor.
test_permite_contenedor_de_secreto if {
	entrada := recurso_con("google_secret_manager_secret", {"secret_id": "contrasena-sql"})
	count(mensajes_de("CO-SEC-01")) == 0 with input as entrada
}
