# pipelines

Scripts que ejecuta el CI/CD. La evaluación de políticas corre **dentro del
runner**, no contra un servicio remoto, por dos razones:

1. **Falla segura.** Si un servicio externo no responde, el pipeline debe
   bloquear y notificar. Una compuerta que depende de la red deja pasar cambios
   cuando ese servicio está caído.
2. **Tiempo.** La validación no debe añadir más de 5 minutos al pipeline.
