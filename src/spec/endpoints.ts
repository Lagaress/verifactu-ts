/**
 * Direcciones de los servicios de la AEAT.
 *
 * Fuentes: WSDL `SistemaFacturacion.wsdl` (servicios `sfVerifactu` y `sfRequerimiento`) y
 * especificación del QR v0.5.0 §5. Si la AEAT cambia alguna dirección, este es el único sitio
 * que hay que tocar.
 */

/** Entorno de la AEAT: producción o pruebas (Portal de Pruebas Externas). */
export type Environment = 'production' | 'test';

/**
 * Tipo de certificado de cliente. Determina el servidor:
 *
 * - `personal`: certificado de persona física, representante o persona jurídica (www1/prewww1).
 * - `seal`: certificado de sello electrónico (www10/prewww10).
 */
export type CertificateType = 'personal' | 'seal';

/**
 * Servicio de suministro:
 *
 * - `verifactu`: remisión voluntaria VERI*FACTU y consulta (`VerifactuSOAP`).
 * - `requirement`: remisión de registros NO VERI*FACTU tras un requerimiento (`RequerimientoSOAP`).
 */
export type Service = 'verifactu' | 'requirement';

const SOAP_HOSTS: Readonly<Record<Environment, Readonly<Record<CertificateType, string>>>> = {
  production: {
    personal: 'https://www1.agenciatributaria.gob.es',
    seal: 'https://www10.agenciatributaria.gob.es',
  },
  test: {
    personal: 'https://prewww1.aeat.es',
    seal: 'https://prewww10.aeat.es',
  },
};

const SOAP_PATHS: Readonly<Record<Service, string>> = {
  verifactu: '/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
  requirement: '/wlpl/TIKE-CONT/ws/SistemaFacturacion/RequerimientoSOAP',
};

/** Servidores del servicio de cotejo de facturas (QR). */
export const QR_HOSTS: Readonly<Record<Environment, string>> = {
  production: 'https://www2.agenciatributaria.gob.es',
  test: 'https://prewww2.aeat.es',
};

/** URL del servicio SOAP para un entorno, tipo de certificado y servicio. */
export function soapEndpoint(environment: Environment, certificateType: CertificateType, service: Service): string {
  return SOAP_HOSTS[environment][certificateType] + SOAP_PATHS[service];
}
