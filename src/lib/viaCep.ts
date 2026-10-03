import { cleanDigits } from "./masks";

export interface ViaCepResult {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: boolean;
}

/**
 * Consulta CEP na API pública gratuita do ViaCEP.
 * Retorna null caso o CEP seja inválido ou não encontrado.
 */
export async function fetchAddressByCep(cep: string): Promise<ViaCepResult | null> {
  const digits = cleanDigits(cep);
  if (digits.length !== 8) {
    return null;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ViaCepResult;
    if (data.erro) {
      return null;
    }

    return data;
  } catch (error) {
    console.warn("Erro ao consultar ViaCEP:", error);
    return null;
  }
}
