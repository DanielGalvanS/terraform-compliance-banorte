package main

instancia_vm(despues) := {"resource_changes": [{
	"address": "google_compute_instance.prueba",
	"type": "google_compute_instance",
	"change": {"actions": ["create"], "after": despues},
}]}

cuenta_propia := [{"email": "app-pruebas@mdc-dev.iam.gserviceaccount.com"}]

test_rechaza_ip_publica if {
	entrada := instancia_vm({
		"name": "vm-01",
		"network_interface": [{"subnetwork": "privada", "access_config": [{"nat_ip": null}]}],
		"service_account": cuenta_propia,
	})
	count(mensajes_de("CO-VM-01")) == 1 with input as entrada
}

test_rechaza_cuenta_por_defecto if {
	entrada := instancia_vm({
		"name": "vm-01",
		"network_interface": [{"subnetwork": "privada", "access_config": []}],
		"service_account": [{"email": "123456789-compute@developer.gserviceaccount.com"}],
	})
	count(mensajes_de("CO-VM-01")) == 1 with input as entrada
}

test_permite_instancia_privada if {
	entrada := instancia_vm({
		"name": "vm-01",
		"network_interface": [{"subnetwork": "privada", "access_config": []}],
		"service_account": cuenta_propia,
	})
	count(mensajes_de("CO-VM-01")) == 0 with input as entrada
}

test_permite_instancia_sin_cuenta_declarada if {
	entrada := instancia_vm({
		"name": "vm-01",
		"network_interface": [{"subnetwork": "privada", "access_config": []}],
		"service_account": [],
	})
	count(mensajes_de("CO-VM-01")) == 0 with input as entrada
}
