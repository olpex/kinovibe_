"use client";

import { useEffect, useRef } from "react";

const LIQPAY_CHECKOUT_URL = "https://www.liqpay.ua/api/3/checkout";

type LiqpayAutoSubmitProps = {
  data: string;
  signature: string;
  buttonLabel: string;
};

export function LiqpayAutoSubmit({ data, signature, buttonLabel }: LiqpayAutoSubmitProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.submit();
  }, []);

  return (
    <form ref={formRef} method="post" action={LIQPAY_CHECKOUT_URL} acceptCharset="utf-8">
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="signature" value={signature} />
      <button type="submit">{buttonLabel}</button>
    </form>
  );
}
