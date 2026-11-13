package main

regla_net02(origen, permisos) := {"resource_changes": [{
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

test_rechaza_todos_los_protocolos if {
	entrada := regla_net02("0.0.0.0/0", [{"protocol": "all"}])
	count(mensajes_de("CO-NET-02")) == 1 with input as entrada
}

test_rechaza_protocolo_sin_puertos if {
	entrada := regla_net02("0.0.0.0/0", [{"protocol": "tcp"}])
	count(mensajes_de("CO-NET-02")) == 1 with input as entrada
}

test_rechaza_rango_completo_de_puertos if {
	entrada := regla_net02("0.0.0.0/0", [{"protocol": "tcp", "ports": ["1-65535"]}])
	count(mensajes_de("CO-NET-02")) == 1 with input as entrada
}

test_permite_puerto_acotado_desde_la_subred if {
	entrada := regla_net02("10.10.1.0/24", [{"protocol": "tcp", "ports": ["443"]}])
	count(mensajes_de("CO-NET-02")) == 0 with input as entrada
}
