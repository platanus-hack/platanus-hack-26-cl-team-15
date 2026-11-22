variable "region_principal" {
  description = "Región de los jobs de datos y de predicción."
  type        = string
}

variable "regiones_satelite" {
  description = "Regiones donde corre caudal-chile-satelite, con el índice de la primera parte (PARTE_BASE) de cada una."
  type        = map(number)
}

variable "hilos_satelite" {
  description = "Hilos de lectura por tarea en la etapa satelital."
  type        = number
}

variable "imagen" {
  description = "Imagen completa de los contenedores, con etiqueta (repositorio/pipeline:version)."
  type        = string
}

variable "corrida" {
  description = "Identificador de la corrida (variable CORRIDA)."
  type        = string
}

variable "cuenta_servicio" {
  description = "Cuenta de servicio con la que corren los jobs."
  type        = string
}

variable "bucket" {
  description = "Bucket que se monta en /datos."
  type        = string
}

variable "secreto_cds" {
  description = "Secreto de Secret Manager con la clave de CDS (variable CDS_API_KEY)."
  type        = string
}

variable "regiones_prediccion_extra" {
  description = "Regiones adicionales para caudal-chile-prediccion (además de la principal), para correr varias regiones de Chile en paralelo."
  type        = list(string)
  default     = []
}
