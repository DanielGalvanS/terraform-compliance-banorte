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

	msg := sprintf(
		"CO-DB-02: la instancia '%s' no declara una llave CMEK. Asigna encryption_key_name con una llave de KMS.",
		[instancia.address],
	)
}

sin_cmek(despues) if not despues.encryption_key_name

sin_cmek(despues) if despues.encryption_key_name == null

sin_cmek(despues) if trim_space(despues.encryption_key_name) == ""
