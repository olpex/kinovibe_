"use client";

import { useEffect, useRef } from "react";

const WAYFORPAY_PAY_URL = "https://secure.wayforpay.com/pay";

type WayforpayCheckoutFields = {
  merchantAccount: string;
  merchantAuthType: string;
  merchantDomainName: string;
  merchantTransactionType: string;
  merchantTransactionSecureType: string;
  merchantSignature: string;
  orderReference: string;
  orderDate: string;
  amount: string;
  currency: string;
  productName: string[];
  productPrice: string[];
  productCount: string[];
  clientEmail?: string;
  clientAccountId?: string;
  returnUrl: string;
  serviceUrl: string;
  language: string;
};

type WayforpayAutoSubmitProps = {
  fields: WayforpayCheckoutFields;
  buttonLabel: string;
};

export function WayforpayAutoSubmit({ fields, buttonLabel }: WayforpayAutoSubmitProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.submit();
  }, []);

  return (
    <form ref={formRef} method="post" action={WAYFORPAY_PAY_URL} acceptCharset="utf-8">
      <input type="hidden" name="merchantAccount" value={fields.merchantAccount} />
      <input type="hidden" name="merchantAuthType" value={fields.merchantAuthType} />
      <input type="hidden" name="merchantDomainName" value={fields.merchantDomainName} />
      <input type="hidden" name="merchantTransactionType" value={fields.merchantTransactionType} />
      <input type="hidden" name="merchantTransactionSecureType" value={fields.merchantTransactionSecureType} />
      <input type="hidden" name="merchantSignature" value={fields.merchantSignature} />
      <input type="hidden" name="orderReference" value={fields.orderReference} />
      <input type="hidden" name="orderDate" value={fields.orderDate} />
      <input type="hidden" name="amount" value={fields.amount} />
      <input type="hidden" name="currency" value={fields.currency} />
      <input type="hidden" name="clientAccountId" value={fields.clientAccountId ?? ""} />
      <input type="hidden" name="clientEmail" value={fields.clientEmail ?? ""} />
      <input type="hidden" name="returnUrl" value={fields.returnUrl} />
      <input type="hidden" name="serviceUrl" value={fields.serviceUrl} />
      <input type="hidden" name="language" value={fields.language} />
      {fields.productName.map((value, index) => (
        <input key={`name-${index}`} type="hidden" name="productName[]" value={value} />
      ))}
      {fields.productPrice.map((value, index) => (
        <input key={`price-${index}`} type="hidden" name="productPrice[]" value={value} />
      ))}
      {fields.productCount.map((value, index) => (
        <input key={`count-${index}`} type="hidden" name="productCount[]" value={value} />
      ))}
      <button type="submit">{buttonLabel}</button>
    </form>
  );
}
