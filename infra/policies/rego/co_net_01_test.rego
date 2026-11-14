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
