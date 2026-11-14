# CO-VM-01 — Instancia con dirección IP pública.
#
# Una VM con IP externa queda expuesta a internet y depende por completo del
# firewall para no ser alcanzable. El acceso debe ser por Identity-Aware Proxy
# y la salida por Cloud NAT.
package main

import data.lib

deny contains msg if {
	some instancia in lib.recursos_afectados(input, "google_compute_instance")
	despues := instancia.change.after

	some interfaz in despues.network_interface
	count(interfaz.access_config) > 0

	msg := sprintf(
		"CO-VM-01: la instancia '%s' tiene IP pública. Quita el bloque access_config y usa IAP para el acceso.",
		[instancia.address],
	)
}

# La cuenta por defecto de Compute Engine trae rol de editor sobre el proyecto
# entero: una instancia comprometida se convierte en control del proyecto.
deny contains msg if {
	some instancia in lib.recursos_afectados(input, "google_compute_instance")
	despues := instancia.change.after

	some cuenta in despues.service_account
	endswith(cuenta.email, "-compute@developer.gserviceaccount.com")

	msg := sprintf(
		"CO-VM-01: la instancia '%s' usa la cuenta de servicio por defecto de Compute, que tiene rol de editor. Asigna una cuenta con permisos acotados.",
		[instancia.address],
	)
}
