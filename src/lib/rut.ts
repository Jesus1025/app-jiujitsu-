// RUT chileno: validación del dígito verificador y formato 12.345.678-5.

function clean(rut: string) {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

export function isValidRut(rut: string) {
  const value = clean(rut);
  if (value.length < 2) return false;
  const body = value.slice(0, -1);
  const dv = value.slice(-1);
  if (!/^\d+$/.test(body)) return false;

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expected = 11 - (sum % 11);
  const expectedDv = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);
  return dv === expectedDv;
}

export function formatRut(rut: string) {
  const value = clean(rut);
  if (value.length < 2) return value;
  const body = value.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${body}-${value.slice(-1)}`;
}
