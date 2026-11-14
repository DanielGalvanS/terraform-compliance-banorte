package main

instancia_db01(configuracion_ip) := {"resource_changes": [{
	"address": "google_sql_database_instance.prueba",
	"type": "google_sql_database_instance",
	"change": {
		"actions": ["create"],
		"after": {
			"encryption_key_name": "projects/p/locations/us-central1/keyRings/r/cryptoKeys/k",
			"settings": [{"ip_configuration": [configuracion_ip]}],
		},
	},
}]}

test_rechaza_ip_publica if {
	entrada := instancia_db01({"ipv4_enabled": true})
	count(mensajes_de("CO-DB-01")) == 1 with input as entrada
}

test_permite_ip_privada if {
	entrada := instancia_db01({
		"ipv4_enabled": false,
		"private_network": "projects/p/global/networks/mdc",
	})
	count(mensajes_de("CO-DB-01")) == 0 with input as entrada
}
