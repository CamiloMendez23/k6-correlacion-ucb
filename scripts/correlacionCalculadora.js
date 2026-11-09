import http from 'k6/http';
import { check, sleep } from 'k6';

/*
 * DIPLOMADO EN TESTING DE SOFTWARE - UNIVERSIDAD CATÓLICA BOLIVIANAA
 * Práctica: Correlación de 2 Pasos (3 Peticiones Encadenadas)
 * Servicio Bajo Prueba (SUT): http://www.dneonline.com/calculator.asmx
 */

// 1. CONDICIONES Y CRITERIOS DE ACEPTACIÓN (SLA / THRESHOLDS)
export const options = {
  vus: 10,           
  duration: '30s',   
  thresholds: {
    
    http_req_duration: ['p(95)<1500'],
    
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const url = 'http://www.dneonline.com/calculator.asmx';

  const valorInicialA = Math.floor(Math.random() * 50) + 1;
  const valorInicialB = Math.floor(Math.random() * 50) + 1;
  const factorMultiplicacion = 4;
  const divisor = 2;

  const sumaEsperada = valorInicialA + valorInicialB;
  const multiplicacionEsperada = sumaEsperada * factorMultiplicacion;
  const divisionEsperada = Math.floor(multiplicacionEsperada / divisor);

  // =========================================================================
  // PETICIÓN 1: Operación SOAP "Add" (Sumar valorInicialA + valorInicialB)
  // =========================================================================
  const payloadAdd = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Add xmlns="http://tempuri.org/">
      <intA>${valorInicialA}</intA>
      <intB>${valorInicialB}</intB>
    </Add>
  </soap:Body>
</soap:Envelope>`;

  const paramsAdd = {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://tempuri.org/Add',
    },
  };

  const resAdd = http.post(url, payloadAdd, paramsAdd);

  check(resAdd, {
    'Paso 1 (Add) - Estado es 200 OK': (r) => r.status === 200,
    'Paso 1 (Add) - Contiene etiqueta AddResult': (r) => r.body.includes('<AddResult>'),
  });

  // -------------------------------------------------------------------------
  // CORRELACIÓN 1: Extraer el dato de la 1ra respuesta (<AddResult>)
  // -------------------------------------------------------------------------
  const matchAdd = resAdd.body.match(/<AddResult>(-?\d+)<\/AddResult>/);
  const datoCorrelacionado1 = matchAdd ? matchAdd[1] : sumaEsperada;

  console.log(
    `[PASO 1 - Add] ${valorInicialA} + ${valorInicialB} -> Dato extraído para 2da petición: ${datoCorrelacionado1}`
  );

  // =========================================================================
  // PETICIÓN 2: Operación SOAP "Multiply" (Usa datoCorrelacionado1 * 4)
  // =========================================================================
  const payloadMultiply = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Multiply xmlns="http://tempuri.org/">
      <intA>${datoCorrelacionado1}</intA>
      <intB>${factorMultiplicacion}</intB>
    </Multiply>
  </soap:Body>
</soap:Envelope>`;

  const paramsMultiply = {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://tempuri.org/Multiply',
    },
  };

  const resMultiply = http.post(url, payloadMultiply, paramsMultiply);

  check(resMultiply, {
    'Paso 2 (Multiply) - Estado es 200 OK': (r) => r.status === 200,
    'Paso 2 (Multiply) - Contiene etiqueta MultiplyResult': (r) => r.body.includes('<MultiplyResult>'),
  });

  // -------------------------------------------------------------------------
  // CORRELACIÓN 2: Extraer el dato de la 2da respuesta (<MultiplyResult>)
  // -------------------------------------------------------------------------
  const matchMultiply = resMultiply.body.match(/<MultiplyResult>(-?\d+)<\/MultiplyResult>/);
  const datoCorrelacionado2 = matchMultiply ? matchMultiply[1] : multiplicacionEsperada;

  console.log(
    `[PASO 2 - Multiply] ${datoCorrelacionado1} * ${factorMultiplicacion} -> Dato extraído para 3ra petición: ${datoCorrelacionado2}`
  );

  // =========================================================================
  // PETICIÓN 3: Operación SOAP "Divide" (Usa datoCorrelacionado2 / 2)
  // =========================================================================
  const payloadDivide = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Divide xmlns="http://tempuri.org/">
      <intA>${datoCorrelacionado2}</intA>
      <intB>${divisor}</intB>
    </Divide>
  </soap:Body>
</soap:Envelope>`;

  const paramsDivide = {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://tempuri.org/Divide',
    },
  };

  const resDivide = http.post(url, payloadDivide, paramsDivide);

  check(resDivide, {
    'Paso 3 (Divide) - El estado es 200 Ok y Todo Ok': (r) => r.status === 200,
    'Paso 3 (Divide) - Resultado final correlacionado es correcto': (r) =>
      r.body.includes(`<DivideResult>${divisionEsperada}</DivideResult>`),
    'Paso 3 (Divide) - Tiempo de respuesta menor a 1500ms': (r) => r.timings.duration < 1500,
  });

  console.log(
    `[PASO 3 - Divide] ${datoCorrelacionado2} / ${divisor} -> Status: ${resDivide.status} | Resultado final verificado: ${divisionEsperada}`
  );

  sleep(1);
}