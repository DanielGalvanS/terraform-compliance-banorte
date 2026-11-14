# CO-TAG-01 — Etiquetas obligatorias.
#
# Sin etiquetas no hay inventario: no se sabe quién es dueño de un recurso, qué
# datos guarda ni a qué marco responde. La política solo evalúa los tipos que
# admiten etiquetas en GCP; redes, subredes, routers y gateways NAT no exponen
# el campo y exigírselas produciría hallazgos imposibles de remediar.
package main

import data.lib

# Las claves van sin acentos: GCP solo admite minúsculas, números, guiones y
# guiones bajos en las claves de etiqueta.
etiquetas_obligatorias := {
	"duenio",
	"ambiente",
	"clasificacion_datos",
	"centro_costos",
	"marco_aplicable",
}

tipos_etiquetables := {
	"google_compute_instance",
	"google_compute_disk",
	"google_sql_database_instance",
	"google_storage_bucket",
	"google_kms_crypto_key",
	"google_secret_manager_secret",
}

deny contains msg if {
	some tipo in tipos_etiquetables
	some recurso in lib.recursos_afectados(input, tipo)

	faltantes := etiquetas_obligatorias - object.keys(etiquetas_de(recurso.change.after))
	count(faltantes) > 0

	msg := sprintf(
		"CO-TAG-01: a '%s' le faltan las etiquetas obligatorias: %s.",
		[recurso.address, concat(", ", sort(faltantes))],
	)
}

# Cloud SQL expone sus etiquetas bajo settings.user_labels; el resto usa labels.
etiquetas_de(despues) := etiquetas if {
	despues.labels
	etiquetas := despues.labels
}

etiquetas_de(despues) := etiquetas if {
	not despues.labels
	some ajustes in despues.settings
	ajustes.user_labels
	etiquetas := ajustes.user_labels
}

etiquetas_de(despues) := {} if {
	not despues.labels
	not tiene_user_labels(despues)
}

tiene_user_labels(despues) if {
	some ajustes in despues.settings
	ajustes.user_labels
}
