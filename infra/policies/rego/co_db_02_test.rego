package main

instancia_db02(despues) := {"resource_changes": [{
	"address": "google_sql_database_instance.prueba",
	"type": "google_sql_database_instance",
	"change": {"actions": ["create"], "after": despues},
}]}

ip_privada := [{"ip_configuration": [{"ipv4_enabled": false}]}]

test_rechaza_sin_llave if {
	entrada := instancia_db02({"settings": ip_privada})
	count(mensajes_de("CO-DB-02")) == 1 with input as entrada
}

test_rechaza_llave_nula if {
	entrada := instancia_db02({"encryption_key_name": null, "settings": ip_privada})
	count(mensajes_de("CO-DB-02")) == 1 with input as entrada
}

test_rechaza_llave_vacia if {
	entrada := instancia_db02({"encryption_key_name": "   ", "settings": ip_privada})
	count(mensajes_de("CO-DB-02")) == 1 with input as entrada
}

test_permite_con_cmek if {
	entrada := instancia_db02({
		"encryption_key_name": "projects/p/locations/us-central1/keyRings/r/cryptoKeys/k",
		"settings": ip_privada,
	})
	count(mensajes_de("CO-DB-02")) == 0 with input as entrada
}
