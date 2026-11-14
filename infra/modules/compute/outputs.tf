output "instancias" {
  description = "Nombres de las instancias creadas."
  value       = sort(keys(google_compute_instance.estas))
}

output "ips_privadas" {
  description = "Direcciones privadas, por nombre. Son los extremos de las pruebas con iperf3."
  value       = { for n, i in google_compute_instance.estas : n => i.network_interface[0].network_ip }
}
