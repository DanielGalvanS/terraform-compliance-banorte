# CO-NET-01 — Administración remota expuesta a internet.
#
# Una regla de firewall que permita SSH (22) o RDP (3389) desde 0.0.0.0/0 deja
# el plano de administración al alcance de cualquiera. El acceso debe pasar por
# Identity-Aware Proxy o por un rango corporativo.
package main

import data.lib

# Puertos de administración remota que nunca deben quedar abiertos.
puertos_administracion := {"22", "3389"}

deny contains msg if {
	some regla in lib.recursos_afectados(input, "google_compute_firewall")
	despues := regla.change.after
	despues.direction == "INGRESS"

	some rango in despues.source_ranges
	lib.abierto_a_internet(rango)

	some permiso in despues.allow
	some puerto in puertos_expuestos(permiso)
	puerto in puertos_administracion

	msg := sprintf(
		"CO-NET-01: la regla '%s' expone el puerto %s a %s. Usa el rango de IAP (35.235.240.0/20) o un rango corporativo.",
		[regla.address, puerto, rango],
	)
}

# Un permiso sin lista de puertos abre el protocolo completo, así que incluye
# los puertos de administración.
puertos_expuestos(permiso) := puertos if {
	not permiso.ports
	puertos := puertos_administracion
}

puertos_expuestos(permiso) := puertos if {
	permiso.ports
	puertos := {p |
		some declarado in permiso.ports
		some p in expandir_rango(declarado)
	}
}

# "22" queda igual; "20-25" se expande para detectar rangos que cubren el 22.
expandir_rango(declarado) := {declarado} if {
	not contains(declarado, "-")
}

expandir_rango(declarado) := puertos if {
	contains(declarado, "-")
	partes := split(declarado, "-")
	inicio := to_number(partes[0])
	fin := to_number(partes[1])
	puertos := {p |
		some candidato in puertos_administracion
		to_number(candidato) >= inicio
		to_number(candidato) <= fin
		p := candidato
	}
}
