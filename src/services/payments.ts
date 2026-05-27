type CreatePagBankCheckoutInput = {
  uid: string;
  email: string;
  name?: string;
  taxId: string;
};

type CreatePagBankCheckoutResponse = {
  success: boolean;
  paymentUrl?: string | null;
  pixCode?: string | null;
  pixQrCodeBase64?: string | null;
  pixTicketUrl?: string | null;
  referenceId: string;
  orderId?: string;
  checkoutId?: string;
  checkoutStatus?: string;
  error?: string;
  details?: {
    message?: string;
    error_messages?: Array<{
      code?: string;
      description?: string;
      parameter_name?: string;
    }>;
  };
};

const PAYMENTS_API_BASE = import.meta.env.VITE_PAYMENTS_API_BASE_URL || 'http://localhost:8787';

async function readJsonOrText(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!text) {
    return {};
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

type MercadoPagoResponseLike = {
  error?: string;
  raw?: string;
  details?: {
    message?: string;
    error_messages?: Array<{
      code?: string;
      description?: string;
      parameter_name?: string;
    }>;
  };
};

function getPagBankErrorMessage(data: MercadoPagoResponseLike) {
  const firstPagBankError = data.details?.error_messages?.[0];
  const detailedMessage = firstPagBankError
    ? `Mercado Pago: ${firstPagBankError.description || 'Erro de validacao'}${firstPagBankError.parameter_name ? ` (${firstPagBankError.parameter_name})` : ''}`
    : data.details?.message;

  if (typeof data.raw === 'string' && data.raw.includes('<!DOCTYPE')) {
    return 'O servidor de pagamentos nao respondeu como JSON. Verifique se o payments-server esta rodando e se a VITE_PAYMENTS_API_BASE_URL aponta para ele.';
  }

  return detailedMessage || data.error || 'Nao foi possivel completar a operacao no Mercado Pago.';
}

export async function createPagBankCheckout(input: CreatePagBankCheckoutInput): Promise<{
  paymentUrl?: string | null;
  pixCode?: string | null;
  pixQrCodeBase64?: string | null;
  pixTicketUrl?: string | null;
  referenceId: string;
  orderId?: string;
}> {
  const response = await fetch(`${PAYMENTS_API_BASE}/api/payments/pagbank/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = (await readJsonOrText(response)) as CreatePagBankCheckoutResponse & MercadoPagoResponseLike;

  if (!response.ok || !data.success || (!data.paymentUrl && !data.pixCode) || !data.referenceId) {
    throw new Error(getPagBankErrorMessage(data));
  }

  return {
    paymentUrl: data.paymentUrl,
    pixCode: data.pixCode,
    pixQrCodeBase64: data.pixQrCodeBase64,
    pixTicketUrl: data.pixTicketUrl,
    referenceId: data.referenceId,
    orderId: data.orderId,
  };
}

export async function createPagBankPixCheckout(input: CreatePagBankCheckoutInput): Promise<{
  pixCode: string;
  pixQrCodeBase64?: string | null;
  pixTicketUrl?: string | null;
  referenceId: string;
  paymentId?: string | null;
  status?: string;
}> {
  const response = await fetch(`${PAYMENTS_API_BASE}/api/payments/mercadopago/pix-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = (await readJsonOrText(response)) as CreatePagBankCheckoutResponse & MercadoPagoResponseLike & {
    pixQrCodeBase64?: string | null;
    pixTicketUrl?: string | null;
    paymentId?: string | null;
    status?: string;
  };

  if (!response.ok || !data.success || !data.pixCode || !data.referenceId) {
    throw new Error(getPagBankErrorMessage(data));
  }

  return {
    pixCode: data.pixCode,
    pixQrCodeBase64: data.pixQrCodeBase64,
    pixTicketUrl: data.pixTicketUrl,
    referenceId: data.referenceId,
    paymentId: data.paymentId,
    status: data.status,
  };
}

type VerifyPagBankPaymentInput = {
  uid: string;
  orderId?: string;
  checkoutId?: string;
  referenceId?: string;
};

type VerifyPagBankPaymentResponse = {
  success: boolean;
  paid?: boolean;
  status?: string;
  orderId?: string;
  referenceId?: string;
  error?: string;
  details?: {
    message?: string;
    error_messages?: Array<{
      code?: string;
      description?: string;
      parameter_name?: string;
    }>;
  };
};

export async function verifyPagBankPayment(input: VerifyPagBankPaymentInput): Promise<{
  paid: boolean;
  status: string;
}> {
  const response = await fetch(`${PAYMENTS_API_BASE}/api/payments/pagbank/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = (await readJsonOrText(response)) as VerifyPagBankPaymentResponse & MercadoPagoResponseLike;

  if (!response.ok || !data.success) {
    throw new Error(getPagBankErrorMessage(data));
  }

  return {
    paid: Boolean(data.paid),
    status: data.status || 'UNKNOWN',
  };
}

export async function createPagBankCardCheckout(input: CreatePagBankCheckoutInput): Promise<{
  paymentUrl: string;
  referenceId: string;
  checkoutId?: string;
  checkoutStatus?: string;
}> {
  const response = await fetch(`${PAYMENTS_API_BASE}/api/payments/pagbank/card-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = (await readJsonOrText(response)) as CreatePagBankCheckoutResponse & MercadoPagoResponseLike;

  if (!response.ok || !data.success || !data.paymentUrl || !data.referenceId) {
    throw new Error(getPagBankErrorMessage(data));
  }

  return {
    paymentUrl: data.paymentUrl,
    referenceId: data.referenceId,
    checkoutId: data.checkoutId,
    checkoutStatus: data.checkoutStatus,
  };
}
