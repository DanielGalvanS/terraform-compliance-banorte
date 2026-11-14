# CO-DB-01 — Cloud SQL con dirección IP pública.
#
# Una base de datos alcanzable desde internet expone datos personales aunque
# exija contraseña. El acceso debe ser por IP privada dentro de la VPC.
package main

import data.lib

deny contains msg if {
	some instancia in lib.recursos_afectados(input, "google_sql_database_instance")
	despues := instancia.change.after

	some ajustes in despues.settings
	some configuracion in ajustes.ip_configuration
	configuracion.ipv4_enabled == true

	msg := sprintf(
		"CO-DB-01: la instancia '%s' tiene IP pública habilitada. Usa ipv4_enabled = false con private_network.",
		[instancia.address],
	)
}
