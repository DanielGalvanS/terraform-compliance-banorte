package main

etiquetas_completas := {
	"duenio": "plataforma",
	"ambiente": "dev",
	"clasificacion_datos": "confidencial",
	"centro_costos": "cc-1042",
	"marco_aplicable": "cis-gcp",
}

recurso(tipo, despues) := {"resource_changes": [{
	"address": sprintf("%s.prueba", [tipo]),
	"type": tipo,
	"change": {"actions": ["create"], "after": despues},
}]}

test_rechaza_instancia_sin_etiquetas if {
	entrada := recurso("google_compute_instance", {"machine_type": "e2-micro"})
	count(mensajes_de("CO-TAG-01")) == 1 with input as entrada
}

test_rechaza_etiqueta_faltante if {
	parciales := object.remove(etiquetas_completas, {"centro_costos"})
	entrada := recurso("google_compute_instance", {"labels": parciales})
	count(mensajes_de("CO-TAG-01")) == 1 with input as entrada
}

test_permite_instancia_con_etiquetas if {
	entrada := recurso("google_compute_instance", {"labels": etiquetas_completas})
	count(mensajes_de("CO-TAG-01")) == 0 with input as entrada
}

# Cloud SQL expone sus etiquetas bajo settings.user_labels, no bajo labels.
test_permite_sql_con_user_labels if {
	entrada := recurso(
		"google_sql_database_instance",
		{"settings": [{"user_labels": etiquetas_completas}]},
	)
	count(mensajes_de("CO-TAG-01")) == 0 with input as entrada
}

# Una VPC no admite etiquetas: exigírselas generaría un hallazgo imposible de
# remediar, así que queda fuera del alcance del control.
test_ignora_recurso_no_etiquetable if {
	entrada := recurso("google_compute_network", {"name": "mdc-dev"})
	count(mensajes_de("CO-TAG-01")) == 0 with input as entrada
}

# Un recurso que solo se destruye no puede violar el control.
test_ignora_destruccion if {
	entrada := {"resource_changes": [{
		"address": "google_compute_instance.vieja",
		"type": "google_compute_instance",
		"change": {"actions": ["delete"], "after": null},
	}]}
	count(mensajes_de("CO-TAG-01")) == 0 with input as entrada
}
