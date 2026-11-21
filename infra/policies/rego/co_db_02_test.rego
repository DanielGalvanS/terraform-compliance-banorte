package main

instancia_db02(despues) := {"resource_changes": [{
	"address": "google_sql_database_instance.prueba",
	"type": "google_sql_database_instance",
	"change": {"actions": ["create"], "after": despues},
}]}

# Como en un plan real: la llave se crea en el mismo apply y su nombre se
# conoce hasta entonces.
instancia_db02_desconocida(despues, desconocidos) := {"resource_changes": [{
	"address": "google_sql_database_instance.prueba",
	"type": "google_sql_database_instance",
	"change": {"actions": ["create"], "after": despues, "after_unknown": desconocidos},
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

test_permite_llave_que_se_crea_en_el_mismo_apply if {
	entrada := instancia_db02_desconocida({"settings": ip_privada}, {"encryption_key_name": true})
	count(mensajes_de("CO-DB-02")) == 0 with input as entrada
}

test_rechaza_sin_llave_aunque_otros_valores_sean_desconocidos if {
	entrada := instancia_db02_desconocida({"settings": ip_privada}, {"connection_name": true})
	count(mensajes_de("CO-DB-02")) == 1 with input as entrada
}

test_rechaza_llave_nula_aunque_otros_valores_sean_desconocidos if {
	entrada := instancia_db02_desconocida(
		{"encryption_key_name": null, "settings": ip_privada},
		{"encryption_key_name": false, "connection_name": true},
	)
	count(mensajes_de("CO-DB-02")) == 1 with input as entrada
}
