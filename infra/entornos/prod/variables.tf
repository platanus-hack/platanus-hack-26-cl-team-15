variable "proyecto" {
  description = "ID del proyecto de GCP."
  type        = string
  default     = "ph-26-caudal"
}

variable "region" {
  description = "Región principal: bucket, job de datos y job de predicción."
  type        = string
  default     = "us-west1"
}

variable "bucket_chile" {
  description = "Nombre del bucket con código, datos y resultados de la corrida nacional."
  type        = string
  default     = "ph-26-caudal-chile"
}

variable "cuenta_servicio_web" {
  description = "Cuenta de servicio con la que corre caudal-web (hoy la de Compute por defecto). Recibe solo lectura del bucket."
  type        = string
  default     = "170658673954-compute@developer.gserviceaccount.com"
}

variable "version_imagen" {
  description = "Etiqueta de la imagen de los jobs en Artifact Registry: el commit corto que imprime infra/imagen/construir.sh."
  type        = string
  default     = "88934d2a6044"
}

variable "corrida" {
  description = "Identificador de la corrida (variable CORRIDA de los jobs)."
  type        = string
  default     = "chile-2025-26"
}

variable "regiones_satelite" {
  description = "Regiones donde corre caudal-chile-satelite, con el índice de la primera parte (PARTE_BASE). Cada región maneja 10 partes."
  type        = map(number)
  default = {
    "us-west1" = 0
    "us-west2" = 10
    "us-west4" = 20
  }
}

variable "hilos_satelite" {
  description = "Hilos de lectura por tarea en la etapa satelital."
  type        = number
  default     = 10
}

variable "correo_contacto" {
  description = "Correo de contacto que exige Google para pedir más cuota. Si es null no se pide cuota. No se guarda en git: pasarlo con TF_VAR_correo_contacto."
  type        = string
  default     = null
}

variable "cuota_cpu_milli" {
  description = "Cuota de CPU de Cloud Run pedida, en milli-vCPU (200000 = 200 vCPU)."
  type        = number
  default     = 200000
}

variable "cuota_memoria_bytes" {
  description = "Cuota de memoria de Cloud Run pedida, en bytes (429496729600 = 400 GiB)."
  type        = number
  default     = 429496729600
}

variable "cuenta_servicio_build" {
  description = "Cuenta de servicio con la que corre Cloud Build (en proyectos nuevos, la de Compute por defecto). Recibe escritura en el repositorio de imágenes."
  type        = string
  default     = "170658673954-compute@developer.gserviceaccount.com"
}

variable "regiones_prediccion_extra" {
  description = "Regiones donde se repite caudal-chile-prediccion para correr la etapa region en paralelo (la principal es var.region)."
  type        = list(string)
  default     = ["us-west2", "us-west4"]
}
