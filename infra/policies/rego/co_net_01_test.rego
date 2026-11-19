package main

# Fábrica de un cambio de firewall, para que cada prueba declare solo lo que
# está ejercitando.
regla_net01(origen, permisos) := {"resource_changes": [{
	"address": "google_compute_firewall.prueba",
	"type": "google_compute_firewall",
	"change": {
		"actions": ["create"],
		"after": {
			"direction": "INGRESS",
			"source_ranges": [origen],
			"allow": permisos,
		},
	},
}]}

test_rechaza_ssh_desde_internet if {
	entrada := regla_net01("0.0.0.0/0", [{"protocol": "tcp", "ports": ["22"]}])
	count(mensajes_de("CO-NET-01")) == 1 with input as entrada
}

test_rechaza_rdp_desde_internet if {
	entrada := regla_net01("0.0.0.0/0", [{"protocol": "tcp", "ports": ["3389"]}])
	count(mensajes_de("CO-NET-01")) == 1 with input as entrada
}

# Un rango 20-25 incluye el 22 aunque no lo nombre.
test_rechaza_rango_que_cubre_ssh if {
	entrada := regla_net01("0.0.0.0/0", [{"protocol": "tcp", "ports": ["20-25"]}])
	count(mensajes_de("CO-NET-01")) == 1 with input as entrada
}

test_permite_ssh_desde_iap if {
	entrada := regla_net01("35.235.240.0/20", [{"protocol": "tcp", "ports": ["22"]}])
	count(mensajes_de("CO-NET-01")) == 0 with input as entrada
}

# El 443 abierto a internet es una decisión de producto, no un hallazgo de este
# control: CO-NET-01 solo vigila administración remota.
test_permite_https_desde_internet if {
	entrada := regla_net01("0.0.0.0/0", [{"protocol": "tcp", "ports": ["443"]}])
	count(mensajes_de("CO-NET-01")) == 0 with input as entrada
}

# ICMP no tiene puertos: la regla se bloquea igual, pero por CO-NET-02 y con su
# motivo verdadero. Antes CO-NET-01 afirmaba que exponía el 22 y el 3389.
test_icmp_no_se_reporta_como_administracion_remota if {
	entrada := regla_net01("0.0.0.0/0", [{"protocol": "icmp"}])
	count(mensajes_de("CO-NET-01")) == 0 with input as entrada
}

# Lo anterior no debe aflojar la compuerta: ICMP abierto a internet sigue
# rechazado, y aquí se deja escrito de quién es el trabajo.
test_icmp_desde_internet_lo_rechaza_net02 if {
	entrada := regla_net01("0.0.0.0/0", [{"protocol": "icmp"}])
	count(mensajes_de("CO-NET-02")) == 1 with input as entrada
}

# El protocolo escrito por número vale igual que por nombre.
test_icmp_por_numero_tampoco_es_administracion_remota if {
	entrada := regla_net01("0.0.0.0/0", [{"protocol": "1"}])
	count(mensajes_de("CO-NET-01")) == 0 with input as entrada
}

# La red de seguridad del arreglo: TCP sin puertos sí abre el 22 y el 3389, y
# debe seguir rechazándose. Es lo que se rompería al excluir protocolos de más.
test_rechaza_tcp_sin_puertos_desde_internet if {
	entrada := regla_net01("0.0.0.0/0", [{"protocol": "tcp"}])
	count(mensajes_de("CO-NET-01")) == 2 with input as entrada
}

# Un protocolo que la lista no reconoce se trata como si tuviera puertos: ante
# la duda, el control avisa. Con una lista de protocolos permitidos en vez de
# una de excepciones, este caso pasaría inadvertido.
test_protocolo_desconocido_sigue_avisando if {
	entrada := regla_net01("0.0.0.0/0", [{"protocol": "6"}])
	count(mensajes_de("CO-NET-01")) == 2 with input as entrada
}
