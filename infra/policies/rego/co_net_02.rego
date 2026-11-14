# CO-NET-02 — Firewall que permite todo desde internet.
#
# Una regla que abre todos los protocolos, o un rango de puertos sin acotar,
# desde 0.0.0.0/0 anula la segmentación de la red.
package main

import data.lib

deny contains msg if {
	some regla in lib.recursos_afectados(input, "google_compute_firewall")
	despues := regla.change.after
	despues.direction == "INGRESS"

	some rango in despues.source_ranges
	lib.abierto_a_internet(rango)

	some permiso in despues.allow
	permite_todo(permiso)

	msg := sprintf(
		"CO-NET-02: la regla '%s' permite todo el tráfico desde %s. Acota protocolo, puertos y origen.",
		[regla.address, rango],
	)
}

# protocol = "all" abre cualquier protocolo.
permite_todo(permiso) if lower(permiso.protocol) == "all"

# Un protocolo sin lista de puertos abre el rango completo.
permite_todo(permiso) if {
	lower(permiso.protocol) != "all"
	not permiso.ports
}

# Un rango declarado que cubre los 65535 puertos.
permite_todo(permiso) if {
	some declarado in permiso.ports
	contains(declarado, "-")
	partes := split(declarado, "-")
	to_number(partes[0]) <= 1
	to_number(partes[1]) >= 65535
}
