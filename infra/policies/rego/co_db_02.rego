# CO-DB-02 — Cloud SQL sin llave administrada por el cliente.
#
# Sin CMEK el cifrado en reposo lo controla Google por completo, y la
# organización no puede revocar el acceso a los datos ni demostrar custodia de
# la llave.
package main

import data.lib

deny contains msg if {
	some instancia in lib.recursos_afectados(input, "google_sql_database_instance")
	despues := instancia.change.after
	sin_cmek(despues)
	not llave_por_crear(instancia)

	msg := sprintf(
		"CO-DB-02: la instancia '%s' no declara una llave CMEK. Asigna encryption_key_name con una llave de KMS.",
		[instancia.address],
	)
}

sin_cmek(despues) if not despues.encryption_key_name

sin_cmek(despues) if despues.encryption_key_name == null

sin_cmek(despues) if trim_space(despues.encryption_key_name) == ""

# Cuando la llave de KMS se crea en el mismo apply, Terraform todavía no conoce
# su nombre: lo omite de `after` y lo marca en `after_unknown`. La instancia sí
# declara una llave, así que no se rechaza. Una llave omitida o nula no aparece
# en `after_unknown` y se sigue rechazando.
llave_por_crear(instancia) if instancia.change.after_unknown.encryption_key_name == true
